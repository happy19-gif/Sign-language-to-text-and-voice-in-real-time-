import { useCallback, useEffect, useRef, useState } from 'react';
import { createRecognizer, type Landmark, type MPHands, type Recognizer, type UpdateState } from '../lib/engine';
import { cameraFailure, openCamera, type CamFailure } from '../lib/camera';
import { speak } from '../lib/speech';

export type SourceKind = 'none' | 'camera' | 'image' | 'video';
export type Status = {
  source: SourceKind; sourceLabel: string; modelReady: boolean; modelLoading: boolean; modelError: string | null;
  camFailure: CamFailure | null; fps: number; latencyMs: number; mirror: boolean;
};

const BASE = import.meta.env.BASE_URL;

export function useSign2Speech(opts: { letterHold?: number; controlHold?: number } = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const handsRef = useRef<MPHands | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<Recognizer | null>(null);
  const loopToken = useRef(0);
  const frameTimes = useRef<number[]>([]);
  const landmarksRef = useRef<Landmark[] | null>(null);
  const mirrorRef = useRef(true);
  const voiceRef = useRef(true);

  const [state, setState] = useState<UpdateState | null>(null);
  const [transcript, setTranscript] = useState('');
  const [word, setWord] = useState('');
  const [voice, setVoiceState] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({
    source: 'none', sourceLabel: '', modelReady: false, modelLoading: false, modelError: null,
    camFailure: null, fps: 0, latencyMs: 0, mirror: true,
  });
  const patch = (p: Partial<Status>) => setStatus((s) => ({ ...s, ...p }));

  const showToast = useCallback((t: string) => {
    setToast(t);
    window.clearTimeout((showToast as unknown as { tid?: number }).tid);
    (showToast as unknown as { tid?: number }).tid = window.setTimeout(() => setToast(null), 1600);
  }, []);

  /* ---------------- recognizer (engine) ---------------- */
  if (!recRef.current) {
    recRef.current = createRecognizer({
      letterHold: opts.letterHold ?? 8,
      controlHold: opts.controlHold ?? 18,
      onUpdate: (s) => setState(s),
      onCommit: (c) => {
        if (c.action === 'letter') showToast('✍️ ' + c.word);
        else if (c.action === 'word') showToast((c.gesture.emoji ?? '') + ' ' + c.gesture.name);
        else if (c.action === 'space') showToast('␣ word saved');
        else if (c.action === 'clear') showToast('🗑️ cleared');
        else if (c.action === 'speak') showToast('🔊 speaking');
      },
      onTranscript: (t) => {
        setTranscript(t.transcript); setWord(t.word);
        if (t.speak === true) speak(t.transcript);
        else if (typeof t.speak === 'string' && voiceRef.current) speak(t.speak);
      },
    });
  }
  const rec = recRef.current;

  /* ---------------- drawing ---------------- */
  const draw = useCallback((lm: Landmark[] | null) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const src: HTMLVideoElement | HTMLImageElement | null = imageRef.current ?? videoRef.current;
    if (!src) return;
    const w = src instanceof HTMLVideoElement ? src.videoWidth || 640 : src.naturalWidth || 640;
    const h = src instanceof HTMLVideoElement ? src.videoHeight || 480 : src.naturalHeight || 480;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    if (src instanceof HTMLImageElement) {
      if (mirrorRef.current) { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(src, -w, 0, w, h); ctx.restore(); }
      else ctx.drawImage(src, 0, 0, w, h);
    }
    if (!lm) return;
    ctx.lineWidth = Math.max(2, w / 320); ctx.strokeStyle = '#5eead4'; ctx.lineCap = 'round';
    const BONES: [number, number][] = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
    ctx.beginPath();
    for (const [a, b] of BONES) { ctx.moveTo(lm[a].x * w, lm[a].y * h); ctx.lineTo(lm[b].x * w, lm[b].y * h); }
    ctx.stroke();
    for (let i = 0; i < lm.length; i++) {
      ctx.beginPath(); ctx.arc(lm[i].x * w, lm[i].y * h, Math.max(3, w / 220), 0, Math.PI * 2);
      ctx.fillStyle = i % 4 === 0 ? '#14b8a6' : '#0b1020'; ctx.fill(); ctx.strokeStyle = '#5eead4'; ctx.stroke();
    }
  }, []);

  /* ---------------- model ---------------- */
  const initModel = useCallback(async () => {
    if (handsRef.current) return handsRef.current;
    patch({ modelLoading: true, modelError: null });
    try {
      const hands = new window.Hands({ locateFile: (f) => `${BASE}vendor/hands/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6, selfieMode: mirrorRef.current });
      hands.onResults((r) => {
        const now = performance.now();
        frameTimes.current.push(now);
        while (frameTimes.current.length && now - frameTimes.current[0] > 1000) frameTimes.current.shift();
        const lm = r.multiHandLandmarks?.[0] ?? null;
        landmarksRef.current = lm;
        draw(lm);
        rec.push(lm, now);
        patch({ fps: frameTimes.current.length });
      });
      await hands.initialize();
      handsRef.current = hands;
      patch({ modelReady: true, modelLoading: false });
      return hands;
    } catch (e) {
      patch({ modelLoading: false, modelError: String(e) });
      throw e;
    }
  }, [draw, rec]);

  const runLoop = useCallback((hands: MPHands) => {
    const token = ++loopToken.current;
    const tick = async () => {
      if (token !== loopToken.current) return;
      const src: HTMLVideoElement | HTMLImageElement | null = imageRef.current ?? videoRef.current;
      const ready = src instanceof HTMLVideoElement ? src.readyState >= 2 && src.videoWidth > 0 : !!src && src.complete && src.naturalWidth > 0;
      if (src && ready) {
        const t0 = performance.now();
        try { await hands.send({ image: src }); } catch { /* transient */ }
        patch({ latencyMs: Math.round(performance.now() - t0) });
      }
      requestAnimationFrame(tick);
    };
    tick();
  }, []);

  /* ---------------- mirror ---------------- */
  const setMirror = useCallback((on: boolean) => {
    mirrorRef.current = on;
    handsRef.current?.setOptions({ selfieMode: on });
    patch({ mirror: on });
  }, []);

  /* ---------------- sources ---------------- */
  const stopStream = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };

  const startCamera = useCallback(async () => {
    const video = videoRef.current; if (!video) return;
    patch({ camFailure: null });
    stopStream();
    try {
      streamRef.current = await openCamera();
    } catch (e) {
      patch({ camFailure: cameraFailure(e), source: 'none' });
      return;
    }
    imageRef.current = null;
    video.pause(); video.removeAttribute('src'); video.loop = false;
    video.srcObject = streamRef.current;
    await video.play().catch(() => {});
    setMirror(true);
    rec.reset();
    patch({ source: 'camera', sourceLabel: 'Camera' });
    try { runLoop(await initModel()); } catch { /* status already set */ }
  }, [initModel, runLoop, setMirror, rec]);

  const startImage = useCallback(async (url: string, label: string) => {
    stopStream();
    const img = new Image(); img.src = url;
    try { await img.decode(); } catch { showToast('Could not load that image'); return; }
    const video = videoRef.current; if (video) { video.pause(); video.srcObject = null; }
    imageRef.current = img;
    setMirror(false);
    rec.reset();
    patch({ source: 'image', sourceLabel: label, camFailure: null });
    try { runLoop(await initModel()); } catch { /* status already set */ }
  }, [initModel, runLoop, setMirror, rec, showToast]);

  const startVideoFile = useCallback(async (url: string, label: string) => {
    stopStream();
    const video = videoRef.current; if (!video) return;
    imageRef.current = null;
    video.srcObject = null; video.src = url; video.loop = true; video.muted = true;
    await video.play().catch(() => {});
    setMirror(false);
    rec.reset();
    patch({ source: 'video', sourceLabel: label, camFailure: null });
    try { runLoop(await initModel()); } catch { /* status already set */ }
  }, [initModel, runLoop, setMirror, rec]);

  const openFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) startVideoFile(url, file.name); else startImage(url, file.name);
  }, [startImage, startVideoFile]);

  /* ---------------- actions ---------------- */
  const speakAll = useCallback(() => { rec.commitWord(); speak(rec.transcript); showToast('🔊 speaking'); }, [rec, showToast]);
  const clearAll = useCallback(() => { rec.clear(); showToast('🗑️ cleared'); }, [rec, showToast]);
  const commitWord = useCallback(() => { rec.commitWord(); }, [rec]);
  const setVoice = useCallback((on: boolean) => { voiceRef.current = on; setVoiceState(on); showToast(on ? '🔊 Voice on' : '🔇 Voice off'); }, [showToast]);

  // auto-start camera on mount; keyboard fallback
  useEffect(() => {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") startCamera();
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Enter') speakAll();
      else if (e.key === 'Backspace') { e.preventDefault(); clearAll(); }
      else if (e.key === ' ') { e.preventDefault(); commitWord(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); loopToken.current++; stopStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef, canvasRef, state, transcript, word, status, toast, voice, landmarksRef,
    startCamera, startImage, startVideoFile, openFile, setMirror, speakAll, clearAll, commitWord, setVoice,
    gestures: rec.GESTURES, order: rec.ORDER,
  };
}
