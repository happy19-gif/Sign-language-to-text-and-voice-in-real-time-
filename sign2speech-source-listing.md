# Sign2Speech — complete source listing (frontend · engine · backend)

Repo: `happy19-gif/Sign-language-to-text-and-voice-in-real-time` · Team: happy19-gif · Praneet007-47 · siddamodar06-dotcom

Not listed (binary / generated / vendored): `frontend/public/icons/*.png`, `frontend/package-lock.json`, `frontend/public/{engine,vendor,samples}` (copied in by `scripts/sync-assets.mjs`), MediaPipe Hands model bundle in `prototype/vendor/hands/`, `engine/test/fixtures/landmarks.json`.


## File tree
```text
backend/.env.example
backend/Dockerfile
backend/app/__init__.py
backend/app/catalogue.py
backend/app/db.py
backend/app/main.py
backend/app/schemas.py
backend/requirements.txt
backend/tests/test_api.py
engine/package.json
engine/scripts/check-sync.js
engine/src/gestures.js
engine/src/index.js
engine/src/recognizer.js
engine/test/classify.test.js
engine/test/fixtures/landmarks.json
frontend/README.md
frontend/index.html
frontend/package.json
frontend/public/icons/apple-touch-icon.png
frontend/public/icons/favicon.svg
frontend/public/icons/icon-192.png
frontend/public/icons/icon-512.png
frontend/scripts/sync-assets.mjs
frontend/src/App.tsx
frontend/src/components/CameraStage.tsx
frontend/src/components/InstallPrompt.tsx
frontend/src/components/ReferenceGrid.tsx
frontend/src/components/SourceBar.tsx
frontend/src/components/StatusBar.tsx
frontend/src/components/TranscriptPanel.tsx
frontend/src/hooks/useSign2Speech.ts
frontend/src/lib/camera.ts
frontend/src/lib/engine.ts
frontend/src/lib/speech.ts
frontend/src/main.tsx
frontend/src/styles.css
frontend/tsconfig.json
frontend/vite.config.ts
```


---

# Frontend — React + TypeScript app (`frontend/`)


## `frontend/package.json`

```json
{
  "name": "sign2speech-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "sync": "node scripts/sync-assets.mjs",
    "dev": "npm run sync && vite --host 0.0.0.0",
    "build": "npm run sync && tsc --noEmit && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^5.4.11",
    "vite-plugin-pwa": "^0.21.1"
  }
}
```


## `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```


## `frontend/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from GitHub Pages under /<repo>/ ; override with VITE_BASE=/ for root hosting (Netlify, Vercel).
const base = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VITE_BASE ?? '/Sign-language-to-text-and-voice-in-real-time/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'samples/*.jpg', 'engine/*.js'],
      manifest: {
        name: 'Sign2Speech — sign language to text & voice',
        short_name: 'Sign2Speech',
        description: 'Real-time sign language to text and voice, 100% on-device.',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // the MediaPipe bundle (~13 MB) is precached so the app works fully offline after first load
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,wasm,tflite,binarypb,data}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
  ],
  server: { port: 3000, strictPort: false, allowedHosts: true },
  preview: { port: 3000, allowedHosts: true },
});
```


## `frontend/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b1020" />
    <meta name="description" content="Sign2Speech — real-time sign language to text and voice, 100% on-device." />
    <link rel="icon" href="icons/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
    <title>Sign2Speech — sign language → text & voice</title>
    <!-- shared engine (classic scripts so the same files serve the prototype, tests and this app) -->
    <script src="engine/gestures.js"></script>
    <script src="engine/recognizer.js"></script>
    <!-- MediaPipe Hands, vendored (offline-capable) -->
    <script src="vendor/hands/hands.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```


## `frontend/scripts/sync-assets.mjs`

```js
// Copies shared assets into public/ before dev/build:
//   ../engine/src/*.js          → public/engine/        (classifier + recognizer, loaded as classic scripts)
//   ../prototype/vendor/hands   → public/vendor/hands/  (MediaPipe Hands wasm + models, offline-capable)
//   ../prototype/samples        → public/samples/       (verified demo images)
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const pub = join(here, '..', 'public');
const pairs = [
  [join(root, 'engine', 'src'), join(pub, 'engine')],
  [join(root, 'prototype', 'vendor', 'hands'), join(pub, 'vendor', 'hands')],
  [join(root, 'prototype', 'samples'), join(pub, 'samples')],
];
for (const [from, to] of pairs) {
  if (!existsSync(from)) { console.error('missing', from); process.exit(1); }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log('synced', from.replace(root, '.'), '→', to.replace(root, '.'));
}
```


## `frontend/src/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```


## `frontend/src/App.tsx`

```tsx
import { useState } from 'react';
import { useSign2Speech } from './hooks/useSign2Speech';
import { CameraStage } from './components/CameraStage';
import { SourceBar } from './components/SourceBar';
import { TranscriptPanel } from './components/TranscriptPanel';
import { ReferenceGrid } from './components/ReferenceGrid';
import { StatusBar } from './components/StatusBar';
import { InstallPrompt } from './components/InstallPrompt';

export default function App() {
  const s2s = useSign2Speech();
  const [debug, setDebug] = useState(false);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">✋</span>
          <div><h1>Sign2Speech</h1><p>Real-time sign language → text &amp; voice · 100% on-device</p></div>
        </div>
        <div className="topbar-right"><InstallPrompt /><StatusBar status={s2s.status} /></div>
      </header>

      <main className="layout">
        <section className="card camera-card">
          <CameraStage videoRef={s2s.videoRef} canvasRef={s2s.canvasRef} state={s2s.state} status={s2s.status}
            onRetry={s2s.startCamera} onSample={s2s.startImage} onFile={s2s.openFile} />
          <SourceBar mirror={s2s.status.mirror} onCamera={s2s.startCamera} onMirror={s2s.setMirror}
            onSample={s2s.startImage} onFile={s2s.openFile} debug={debug} onDebug={setDebug} />
          {debug && <pre className="debug">{JSON.stringify({ id: s2s.state?.id, stable: s2s.state?.stable, ...s2s.state?.features, ...s2s.state?.motion }, (_, v) => (typeof v === 'number' ? +v.toFixed(3) : v), 1)}</pre>}
        </section>

        <aside className="side">
          <TranscriptPanel transcript={s2s.transcript} word={s2s.word} voice={s2s.voice} onVoice={s2s.setVoice}
            onSpeak={s2s.speakAll} onClear={s2s.clearAll} onSpace={s2s.commitWord} />
          <ReferenceGrid gestures={s2s.gestures} order={s2s.order} activeId={s2s.state?.id ?? null} />
        </aside>
      </main>

      {s2s.toast && <div className="toast">{s2s.toast}</div>}
    </div>
  );
}
```


## `frontend/src/hooks/useSign2Speech.ts`

```ts
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
```


## `frontend/src/lib/engine.ts`

```ts
/* Typed bridge to the shared engine (loaded as classic scripts in index.html). */
export type Landmark = { x: number; y: number; z?: number };
export type GestureKind = 'letter' | 'word' | 'control';
export type Gesture = { kind: GestureKind; name: string; label: string; emoji?: string; note?: string; action?: 'space' | 'clear' | 'speak' };
export type Features = {
  hs: number; ext: { index: boolean; middle: boolean; ring: boolean; pinky: boolean };
  thumbOut: boolean; thumbUp: boolean; thumbDown: boolean; pinch: boolean; anyFinger: boolean;
  spread: number; openHand: boolean; flatHand: boolean; sepIM: number; crossed: boolean;
};
export type Motion = { hello: boolean; thanks: boolean; signChanges: number; xRange: number; yRange: number; sizeGrow: number };
export type UpdateState = { id: string | null; gesture: Gesture | null; progress: number; stable: number; features: Features | null; motion: Motion };
export type CommitEvent = { id: string; gesture: Gesture; action: 'letter' | 'word' | 'space' | 'clear' | 'speak' | null; word: string; transcript: string };
export type TranscriptEvent = { word: string; transcript: string; speak: string | true | null };

export interface Recognizer {
  push(lm: Landmark[] | null, t?: number): UpdateState;
  on(type: 'update', fn: (s: UpdateState) => void): Recognizer;
  on(type: 'commit', fn: (c: CommitEvent) => void): Recognizer;
  on(type: 'transcript', fn: (t: TranscriptEvent) => void): Recognizer;
  reset(): void; clear(): void; commitWord(): void;
  readonly word: string; readonly transcript: string;
  GESTURES: Record<string, Gesture>; ORDER: string[];
}
export interface RecognizerOptions {
  letterHold?: number; controlHold?: number; motionWindowMs?: number;
  onUpdate?: (s: UpdateState) => void; onCommit?: (c: CommitEvent) => void; onTranscript?: (t: TranscriptEvent) => void;
}

declare global {
  interface Window {
    Sign2SpeechRecognizer: { createRecognizer(o?: RecognizerOptions): Recognizer; GESTURES: Record<string, Gesture>; ORDER: string[] };
    Hands: new (cfg: { locateFile: (f: string) => string }) => MPHands;
  }
}
export interface MPHands {
  setOptions(o: Partial<{ maxNumHands: number; modelComplexity: 0 | 1; minDetectionConfidence: number; minTrackingConfidence: number; selfieMode: boolean }>): void;
  onResults(cb: (r: { multiHandLandmarks?: Landmark[][]; multiHandedness?: { label: string; score: number }[] }) => void): void;
  initialize(): Promise<void>;
  send(i: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>;
  close(): Promise<void>;
}

export function createRecognizer(o?: RecognizerOptions): Recognizer {
  if (!window.Sign2SpeechRecognizer) throw new Error('engine scripts not loaded (engine/gestures.js, engine/recognizer.js)');
  return window.Sign2SpeechRecognizer.createRecognizer(o);
}
export const GESTURES = () => window.Sign2SpeechRecognizer.GESTURES;
export const ORDER = () => window.Sign2SpeechRecognizer.ORDER;

/** Bones of the MediaPipe hand skeleton (pairs of landmark indices). */
export const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
```


## `frontend/src/lib/camera.ts`

```ts
export type CamFailure = { code: string; message: string; openInTab: boolean };

/** Map a getUserMedia failure to a human-readable reason and remedy. */
export function cameraFailure(e: unknown): CamFailure {
  const name = (e as { name?: string })?.name ?? '';
  const inFrame = window.self !== window.top;
  let policyBlocked = false;
  try {
    const pp = (document as unknown as { permissionsPolicy?: { allowsFeature(f: string): boolean }; featurePolicy?: { allowsFeature(f: string): boolean } });
    const p = pp.permissionsPolicy ?? pp.featurePolicy;
    if (p) policyBlocked = !p.allowsFeature('camera');
  } catch { /* ignore */ }
  if (!window.isSecureContext) return { code: 'InsecureContext', message: 'Camera needs a secure page (HTTPS or localhost).', openInTab: false };
  if (!navigator.mediaDevices?.getUserMedia) return { code: 'NoMediaDevices', message: 'This browser cannot access the camera here.', openInTab: inFrame };
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return { code: name, message: 'No webcam was found. Plug one in and retry.', openInTab: false };
  if (name === 'NotReadableError' || name === 'TrackStartError') return { code: name, message: 'The webcam is in use by another app. Close it and retry.', openInTab: false };
  if (policyBlocked || (inFrame && name === 'NotAllowedError')) return { code: 'BlockedByEmbedPolicy', message: 'The page embedding this app does not allow camera access. Open it in its own tab, or try a sample image.', openInTab: true };
  if (name === 'NotAllowedError') return { code: name, message: 'Camera access was blocked. Click the camera icon in the address bar → Allow → retry.', openInTab: false };
  return { code: name || 'Unknown', message: 'Could not start the camera.', openInTab: inFrame };
}

export async function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
}
```


## `frontend/src/lib/speech.ts`

```ts
let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  if (voice || !('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => /en-IN/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? vs[0] ?? null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

export const speechSupported = 'speechSynthesis' in window;
export function speak(text: string) {
  if (!speechSupported || !text.trim()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 1; u.pitch = 1;
  speechSynthesis.speak(u);
}
```


## `frontend/src/components/CameraStage.tsx`

```tsx
import type { RefObject } from 'react';
import type { UpdateState } from '../lib/engine';
import type { Status } from '../hooks/useSign2Speech';
import { SAMPLES } from './SourceBar';

type Props = {
  videoRef: RefObject<HTMLVideoElement>; canvasRef: RefObject<HTMLCanvasElement>;
  state: UpdateState | null; status: Status;
  onRetry: () => void; onSample: (url: string, label: string) => void; onFile: (f: File) => void;
};

export function CameraStage({ videoRef, canvasRef, state, status, onRetry, onSample, onFile }: Props) {
  const g = state?.gesture ?? null;
  const showOverlay = status.source === 'none';
  return (
    <div className="stage">
      <video ref={videoRef} className={`stage-video ${status.mirror ? 'mirrored' : ''} ${status.source === 'image' ? 'hidden' : ''}`} playsInline muted autoPlay />
      <canvas ref={canvasRef} className="stage-canvas" />

      <div className={`chip ${g ? 'chip-' + g.kind : ''}`}>
        <span className="chip-emoji">{g ? (g.kind === 'letter' ? g.name : g.emoji) : '✋'}</span>
        <span className="chip-text">
          <strong>{g ? (g.kind === 'letter' ? g.label : g.name) : '—'}</strong>
          <em>{g ? `${g.kind} · hold` : 'show a sign to the camera'}</em>
        </span>
      </div>
      <div className="hold-track"><div className="hold-fill" style={{ width: `${Math.round((state?.progress ?? 0) * 100)}%` }} /></div>

      {showOverlay && (
        <div className="start-overlay">
          <button className="btn primary big" onClick={onRetry}>📷 {status.camFailure ? 'Retry camera' : 'Enable camera & start signing'}</button>
          <p className="start-msg">
            {status.camFailure ? `${status.camFailure.message} (${status.camFailure.code})`
              : 'Requesting webcam access… Video never leaves your device — recognition runs locally in your browser.'}
          </p>
          {status.camFailure?.openInTab && <a className="btn" href={window.location.href} target="_blank" rel="noopener">↗ Open in a new tab</a>}
          <div className="alt-input">
            <span className="alt-label">No camera here? Try it anyway:</span>
            {SAMPLES.map((s) => <button key={s.url} className="btn" onClick={() => onSample(s.url, s.label)}>{s.emoji} Sample: {s.label}</button>)}
            <label className="btn file-btn">📁 Upload image / video<input type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
          </div>
        </div>
      )}
      {status.modelLoading && <div className="model-banner">Loading hand model…</div>}
      {status.modelError && <div className="model-banner bad">Could not load the hand model — reload the page.</div>}
    </div>
  );
}
```


## `frontend/src/components/SourceBar.tsx`

```tsx
const BASE = import.meta.env.BASE_URL;
export const SAMPLES = [
  { url: `${BASE}samples/thumbs_up.jpg`, label: 'YES', emoji: '👍' },
  { url: `${BASE}samples/i_love_you.jpg`, label: 'I LOVE YOU', emoji: '🤟' },
  { url: `${BASE}samples/letter_l.jpg`, label: 'letter L', emoji: 'L' },
  { url: `${BASE}samples/open_palm.jpg`, label: 'open palm', emoji: '🖐️' },
];

type Props = {
  mirror: boolean; onCamera: () => void; onMirror: (on: boolean) => void;
  onSample: (url: string, label: string) => void; onFile: (f: File) => void;
  debug: boolean; onDebug: (on: boolean) => void;
};

export function SourceBar({ mirror, onCamera, onMirror, onSample, onFile, debug, onDebug }: Props) {
  return (
    <div className="source-bar">
      <span className="hint">💡 Hold a sign ~0.5 s to commit · control gestures ~1.2 s</span>
      <span className="actions">
        <button className="btn small" onClick={onCamera} title="Use the webcam">📷 Camera</button>
        <button className={`btn small ${mirror ? 'active' : ''}`} onClick={() => onMirror(!mirror)} title="Flip the view horizontally">🔁 Mirror</button>
        {SAMPLES.map((s) => <button key={s.url} className="btn small" title={`Sample: ${s.label}`} onClick={() => onSample(s.url, s.label)}>{s.emoji}</button>)}
        <label className="btn small file-btn" title="Upload image or video">📁<input type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        <label className="debug-toggle"><input type="checkbox" checked={debug} onChange={(e) => onDebug(e.target.checked)} /> Debug</label>
      </span>
    </div>
  );
}
```


## `frontend/src/components/TranscriptPanel.tsx`

```tsx
type Props = { transcript: string; word: string; voice: boolean; onVoice: (on: boolean) => void; onSpeak: () => void; onClear: () => void; onSpace: () => void };

export function TranscriptPanel({ transcript, word, voice, onVoice, onSpeak, onClear, onSpace }: Props) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>Transcript</h2>
        <label className="toggle"><input type="checkbox" checked={voice} onChange={(e) => onVoice(e.target.checked)} /> 🔊 Voice</label>
      </header>
      <div className={`transcript ${transcript ? '' : 'empty'}`} aria-live="polite">{transcript || 'Your signed words will appear here…'}</div>
      <div className="word-now">{word ? <>✍️ <b>{word}</b></> : <span>&nbsp;</span>}</div>
      <div className="btn-row">
        <button className="btn primary" onClick={onSpeak}>🔊 Speak</button>
        <button className="btn" onClick={onSpace}>␣ Space</button>
        <button className="btn" onClick={onClear}>🗑️ Clear</button>
      </div>
      <p className="help">Hand-operated: <b>☝️ point</b> = space · <b>✊ fist</b> = clear · <b>👌 OK</b> = speak aloud<br />Keyboard: <b>Enter</b> speak · <b>Space</b> commit word · <b>Backspace</b> clear</p>
    </section>
  );
}
```


## `frontend/src/components/ReferenceGrid.tsx`

```tsx
import type { Gesture } from '../lib/engine';

export function ReferenceGrid({ gestures, order, activeId }: { gestures: Record<string, Gesture>; order: string[]; activeId: string | null }) {
  return (
    <section className="card">
      <header className="card-head"><h2>Sign reference</h2><span className="muted">hold to commit</span></header>
      <div className="ref-grid">
        {order.map((id) => {
          const g = gestures[id];
          return (
            <div key={id} className={`ref-item ${g.kind} ${activeId === id ? 'active' : ''}`}>
              {g.kind === 'letter' ? <span className="ref-emoji letter-badge">{g.name}</span> : <span className="ref-emoji">{g.emoji}</span>}
              <span className="ref-name">{g.kind === 'letter' ? g.label : g.name}{g.note && <small>{g.note}</small>}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```


## `frontend/src/components/StatusBar.tsx`

```tsx
import type { Status } from '../hooks/useSign2Speech';

export function StatusBar({ status }: { status: Status }) {
  const cam = status.camFailure ? ['● Camera denied', 'bad'] : status.source === 'none' ? ['● Camera', ''] : [`● ${status.sourceLabel}`, 'ok'];
  const model = status.modelError ? ['● Model failed', 'bad'] : status.modelReady ? ['● Model ready', 'ok'] : status.modelLoading ? ['● Loading model…', ''] : ['● Model idle', ''];
  return (
    <div className="status">
      <span className={`pill ${cam[1]}`}>{cam[0]}</span>
      <span className={`pill ${model[1]}`}>{model[0]}</span>
      <span className="pill mono">{status.fps} fps</span>
      <span className="pill mono">{status.latencyMs} ms</span>
    </div>
  );
}
```


## `frontend/src/components/InstallPrompt.tsx`

```tsx
import { useEffect, useState } from 'react';

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/** "Install app" button — shows only when the browser offers PWA installation. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (!evt) return null;
  return <button className="btn small install" onClick={async () => { await evt.prompt(); setEvt(null); }}>⬇️ Install app</button>;
}
```


## `frontend/src/styles.css`

```css
:root {
  --bg: #0b1020; --card: #141b34; --card2: #0f1530; --edge: #2a3560; --txt: #e8ecff; --muted: #94a1c9;
  --teal: #14b8a6; --indigo: #6366f1; --amber: #f59e0b; --rose: #f43f5e; --radius: 16px;
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: radial-gradient(1200px 600px at 80% -10%, #121a3c 0%, var(--bg) 60%); color: var(--txt); -webkit-font-smoothing: antialiased; }
button, input, label { font: inherit; }
h1, h2 { margin: 0; }

.app { min-height: 100%; display: flex; flex-direction: column; padding: max(12px, env(safe-area-inset-top)) 16px 24px; gap: 14px; max-width: 1400px; margin: 0 auto; }

/* top bar */
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 12px; }
.logo { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, var(--teal), var(--indigo)); display: grid; place-items: center; font-size: 22px; }
.brand h1 { font-size: 1.25rem; letter-spacing: .2px; }
.brand p { margin: 2px 0 0; color: var(--muted); font-size: .8rem; }
.topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.status { display: flex; gap: 6px; flex-wrap: wrap; }
.pill { padding: 5px 11px; border-radius: 999px; border: 1px solid var(--edge); background: var(--card); font-size: .78rem; color: var(--muted); }
.pill.ok { color: #5eead4; border-color: rgba(20,184,166,.5); background: rgba(20,184,166,.1); }
.pill.bad { color: #fda4af; border-color: rgba(244,63,94,.5); background: rgba(244,63,94,.1); }
.pill.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

/* layout */
.layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(320px, 1fr); gap: 16px; align-items: start; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
.side { display: flex; flex-direction: column; gap: 16px; }
.card { background: var(--card); border: 1px solid var(--edge); border-radius: var(--radius); padding: 16px; }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.card-head h2 { font-size: 1.05rem; }
.muted { color: var(--muted); font-size: .8rem; }
.camera-card { padding: 0; overflow: hidden; }

/* stage */
.stage { position: relative; aspect-ratio: 16 / 9; background: #06091a; overflow: hidden; }
.stage-video, .stage-canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.stage-video.mirrored { transform: scaleX(-1); }
.stage-video.hidden { display: none; }
.chip { position: absolute; top: 14px; left: 14px; display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 10px; border-radius: 14px; background: rgba(11,16,32,.82); border: 1px solid var(--edge); backdrop-filter: blur(8px); transition: border-color .2s; }
.chip-letter { border-color: var(--teal); } .chip-word { border-color: var(--indigo); } .chip-control { border-color: var(--amber); }
.chip-emoji { font-size: 26px; min-width: 32px; text-align: center; }
.chip-text { display: flex; flex-direction: column; line-height: 1.1; }
.chip-text strong { font-size: 1.05rem; } .chip-text em { font-style: normal; color: var(--muted); font-size: .72rem; text-transform: uppercase; letter-spacing: .4px; }
.hold-track { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: rgba(255,255,255,.08); }
.hold-fill { height: 100%; background: linear-gradient(90deg, var(--teal), var(--indigo)); transition: width .08s linear; }
.start-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; text-align: center; background: rgba(6,9,26,.88); }
.start-msg { max-width: 520px; color: var(--muted); font-size: .9rem; margin: 0; }
.alt-input { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; }
.alt-label { width: 100%; font-size: .82rem; color: var(--muted); }
.model-banner { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); padding: 6px 12px; border-radius: 999px; background: rgba(11,16,32,.85); border: 1px solid var(--edge); font-size: .8rem; }
.model-banner.bad { border-color: var(--rose); color: #fda4af; }

/* source bar */
.source-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; flex-wrap: wrap; color: var(--muted); font-size: .78rem; }
.actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.debug-toggle { display: flex; align-items: center; gap: 6px; margin-left: 6px; cursor: pointer; }
.debug { margin: 0; padding: 12px 14px; border-top: 1px solid var(--edge); background: var(--card2); font-size: .72rem; color: #a5b4fc; max-height: 220px; overflow: auto; }

/* buttons */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 11px; border: 1px solid var(--edge); background: rgba(148,163,216,.1); color: var(--txt); cursor: pointer; text-decoration: none; transition: background .15s, transform .05s; }
.btn:hover { background: rgba(148,163,216,.18); } .btn:active { transform: scale(.97); }
.btn.primary { background: linear-gradient(135deg, #0d9488, var(--indigo)); border-color: transparent; font-weight: 600; }
.btn.primary:hover { filter: brightness(1.12); }
.btn.big { font-size: 1.05rem; padding: 14px 26px; }
.btn.small { padding: 4px 9px; font-size: .8rem; border-radius: 9px; }
.btn.small.active { border-color: var(--teal); background: rgba(13,148,136,.22); }
.btn.install { border-color: var(--indigo); background: rgba(99,102,241,.18); }
.file-btn { cursor: pointer; }
.btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 8px; }

/* transcript */
.toggle { display: flex; align-items: center; gap: 6px; font-size: .85rem; color: var(--muted); cursor: pointer; }
.transcript { min-height: 120px; padding: 14px 16px; border-radius: 12px; background: var(--card2); border: 1px solid var(--edge); font-size: 1.9rem; font-weight: 700; line-height: 1.25; word-break: break-word; }
.transcript.empty { color: var(--muted); font-size: 1.1rem; font-weight: 400; }
.word-now { margin-top: 8px; color: #5eead4; font-size: 1rem; min-height: 1.4em; }
.help { margin: 0; color: var(--muted); font-size: .8rem; line-height: 1.5; }
.help b { color: var(--txt); font-weight: 600; }

/* reference grid */
.ref-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
.ref-item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 6px; border-radius: 12px; background: var(--card2); border: 1px solid var(--edge); text-align: center; transition: border-color .15s, transform .15s; }
.ref-item.control { border-color: rgba(245,158,11,.45); }
.ref-item.active { border-color: var(--teal); transform: translateY(-2px); box-shadow: 0 0 0 2px rgba(20,184,166,.25); }
.ref-emoji { font-size: 26px; line-height: 1; }
.letter-badge { width: 36px; height: 36px; border-radius: 10px; background: rgba(20,184,166,.15); color: #5eead4; font-weight: 800; font-size: 18px; display: grid; place-items: center; }
.ref-name { font-size: .76rem; color: var(--muted); display: flex; flex-direction: column; gap: 2px; }
.ref-name small { font-size: .66rem; opacity: .8; }

/* toast */
.toast { position: fixed; left: 50%; bottom: max(24px, env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 10px 18px; border-radius: 999px; background: rgba(11,16,32,.95); border: 1px solid var(--edge); font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,.4); animation: pop .18s ease-out; z-index: 20; }
@keyframes pop { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* phone tweaks */
@media (max-width: 600px) {
  .app { padding: 10px 10px 20px; }
  .brand p { display: none; }
  .transcript { font-size: 1.5rem; }
  .chip-emoji { font-size: 22px; } .chip-text strong { font-size: .95rem; }
  .hint { display: none; }
}
```


## `frontend/public/icons/favicon.svg`

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b1020"/><rect x="19" y="29" width="27" height="23" rx="7" fill="#14b8a6"/><rect x="21" y="15" width="6" height="22" rx="3" fill="#14b8a6"/><rect x="27" y="10" width="6" height="27" rx="3" fill="#6366f1"/><rect x="33" y="9" width="6" height="28" rx="3" fill="#14b8a6"/><rect x="39" y="12" width="6" height="25" rx="3" fill="#6366f1"/><rect x="13" y="31" width="7" height="14" rx="3.5" fill="#6366f1"/></svg>
```


---

# Shared recognition engine (`engine/`) — used by the frontend


## `engine/package.json`

```json
{
  "name": "@sign2speech/engine",
  "version": "0.1.0",
  "description": "Framework-agnostic sign-language gesture recognizer: MediaPipe hand landmarks in, letters / words / control gestures out, with motion analysis and hold-to-commit smoothing.",
  "main": "src/index.js",
  "browser": "src/index.js",
  "files": ["src"],
  "scripts": {
    "test": "node --test test/",
    "lint": "node --check src/gestures.js && node --check src/recognizer.js && node --check src/index.js && node scripts/check-sync.js"
  },
  "keywords": ["sign-language", "mediapipe", "gesture-recognition", "accessibility", "computer-vision"],
  "license": "MIT",
  "engines": { "node": ">=18" }
}
```


## `engine/src/index.js`

```js
// Entry point for bundlers / Node. In a plain <script> setup load gestures.js then recognizer.js instead.
const S2S = require('./gestures.js');
const R = require('./recognizer.js');
module.exports = Object.assign({}, R, { MotionTracker: S2S.MotionTracker, handSize: S2S.handSize });
```


## `engine/src/gestures.js`

```js
/*
 * Sign2Speech — gesture engine.
 * Turns MediaPipe 21-landmark hand poses into letters, words and app-control
 * gestures, plus temporal motion analysis (wave / forward movement).
 * Heuristic + temporal: no extra neural net on top of the hand tracker.
 */
(function (global) {
  'use strict';

  // Landmark indices (MediaPipe Hands)
  const TIP = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
  const PIP = { index: 6, middle: 10, ring: 14, pinky: 18 };
  const MCP = { thumb: 2, index: 5, middle: 9, ring: 13, pinky: 17 };
  const FINGERS = ['index', 'middle', 'ring', 'pinky'];

  function d(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function d2(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // angle (degrees) at vertex b between segments b→a and b→c, in the image plane
  function angleAt(b, a, c) {
    const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
    const cos = (v1x * v2x + v1y * v2y) / ((Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)) || 1e-9);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  }

  function handSize(lm) { return d(lm[0], lm[MCP.middle]) || 1e-6; }

  /* ---------------- motion tracker (temporal features) ---------------- */
  class MotionTracker {
    constructor(windowMs) { this.windowMs = windowMs || 1300; this.pts = []; }

    push(t, cx, cy, size) {
      if (cx == null) { this.pts.length = 0; return; } // hand lost → reset window
      this.pts.push({ t, cx, cy, size });
      const cut = t - this.windowMs;
      while (this.pts.length && this.pts[0].t < cut) this.pts.shift();
    }

    analyze() {
      const out = { hello: false, thanks: false, signChanges: 0, xRange: 0, yRange: 0, sizeGrow: 1 };
      const pts = this.pts;
      if (pts.length < 12) return out;
      let flips = 0, prevSign = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].cx - pts[i - 1].cx;
        if (Math.abs(dx) > 0.004) {
          const s = Math.sign(dx);
          if (prevSign !== 0 && s !== prevSign) flips++;
          prevSign = s;
        }
        if (pts[i].cx < minX) minX = pts[i].cx;
        if (pts[i].cx > maxX) maxX = pts[i].cx;
        if (pts[i].cy < minY) minY = pts[i].cy;
        if (pts[i].cy > maxY) maxY = pts[i].cy;
      }
      out.signChanges = flips;
      out.xRange = maxX - minX;
      out.yRange = maxY - minY;
      out.sizeGrow = pts[pts.length - 1].size / Math.max(pts[0].size, 1e-6);
      // HELLO: open hand waved side to side (≥3 direction flips, mostly horizontal)
      out.hello = flips >= 3 && out.xRange > 0.07 && out.yRange < 0.10;
      // THANK YOU: flat hand moving toward the camera (palm appears to grow)
      out.thanks = out.sizeGrow > 1.22 && out.xRange < 0.06 && out.yRange < 0.12;
      return out;
    }
  }

  /* ---------------- gesture catalogue ---------------- */
  const GESTURES = {
    B:      { kind: 'letter',  name: 'B',          label: 'Letter B' },
    I:      { kind: 'letter',  name: 'I',          label: 'Letter I' },
    L:      { kind: 'letter',  name: 'L',          label: 'Letter L' },
    R:      { kind: 'letter',  name: 'R',          label: 'Letter R' },
    U:      { kind: 'letter',  name: 'U',          label: 'Letter U' },
    V:      { kind: 'letter',  name: 'V',          label: 'Letter V' },
    W:      { kind: 'letter',  name: 'W',          label: 'Letter W' },
    Y:      { kind: 'letter',  name: 'Y',          label: 'Letter Y' },
    YES:    { kind: 'word',    name: 'YES',        label: '👍 Yes',          emoji: '👍' },
    NO:     { kind: 'word',    name: 'NO',         label: '👎 No',           emoji: '👎' },
    ILY:    { kind: 'word',    name: 'I LOVE YOU', label: '🤟 I love you',   emoji: '🤟' },
    HELLO:  { kind: 'word',    name: 'HELLO',      label: '👋 Hello',        emoji: '👋', note: 'wave your open hand side to side' },
    THANKS: { kind: 'word',    name: 'THANK YOU',  label: '🙏 Thank you',    emoji: '🙏', note: 'flat hand moves toward the camera' },
    POINT:  { kind: 'control', name: 'Space', action: 'space', label: '☝️ Point', emoji: '☝️', note: 'index finger · hold ~1.2 s' },
    FIST:   { kind: 'control', name: 'Clear', action: 'clear', label: '✊ Fist',   emoji: '✊', note: 'closed fist · hold ~1.2 s' },
    OK:     { kind: 'control', name: 'Speak', action: 'speak', label: '👌 OK',     emoji: '👌', note: 'OK sign · hold ~1.2 s' },
  };

  const ORDER = ['B', 'I', 'L', 'R', 'U', 'V', 'W', 'Y', 'YES', 'NO', 'ILY', 'HELLO', 'THANKS', 'POINT', 'FIST', 'OK'];

  /* ---------------- per-frame geometric features ---------------- */
  function features(lm) {
    const hs = handSize(lm);
    const ext = {};
    const wrist = lm[0];
    for (const f of FINGERS) {
      // Rotation-invariant "extended" test using 2-D geometry only (MediaPipe's z is too noisy
      // when a folded fingertip points at the camera). Two independent cues must agree:
      //  (1) the tip is farther from the wrist than the PIP joint (folded fingers curl back), and
      //  (2) the finger is nearly straight at the PIP joint (bend angle close to 180°).
      const tip = lm[TIP[f]], pip = lm[PIP[f]], mcp = lm[MCP[f]];
      const reach = d2(tip, wrist) / (d2(pip, wrist) || 1e-6);
      ext[f] = reach > 1.12 && angleAt(pip, mcp, tip) > 110;
    }
    const thumbOut = d(lm[TIP.thumb], lm[MCP.thumb]) > 1.15 * d(lm[3], lm[MCP.thumb]);
    const thumbUp = lm[TIP.thumb].y < lm[MCP.thumb].y - 0.02;
    const thumbDown = lm[TIP.thumb].y > lm[MCP.thumb].y + 0.02;
    const pinch = d(lm[TIP.thumb], lm[TIP.index]) < 0.28 * hs;
    const anyFinger = FINGERS.some((f) => ext[f]);
    let spread = 0;
    for (let i = 0; i < FINGERS.length; i++)
      for (let j = i + 1; j < FINGERS.length; j++)
        spread = Math.max(spread, d(lm[TIP[FINGERS[i]]], lm[TIP[FINGERS[j]]]));
    const openHand = FINGERS.every((f) => ext[f]);
    const flatHand = openHand && !thumbOut && spread < 0.40 * hs;
    const sepIM = d(lm[TIP.index], lm[TIP.middle]) / hs;
    const crossed = (lm[TIP.index].x - lm[TIP.middle].x) * (lm[MCP.index].x - lm[MCP.middle].x) < 0;
    return { hs, ext, thumbOut, thumbUp, thumbDown, pinch, anyFinger, spread, openHand, flatHand, sepIM, crossed };
  }

  /* ---------------- per-frame classifier ---------------- */
  function classify(lm, motion) {
    const f = features(lm);

    // control: OK / pinch (thumb+index circle, three fingers up)
    if (f.pinch && f.ext.middle && f.ext.ring && f.ext.pinky) return 'OK';

    // motion words take priority over the static flat hand
    if (f.openHand && motion) {
      if (motion.hello) return 'HELLO';
      if (motion.thanks) return 'THANKS';
    }
    if (f.flatHand) return 'B';

    // I LOVE YOU: thumb + index + pinky
    if (f.thumbOut && f.ext.index && !f.ext.middle && !f.ext.ring && f.ext.pinky) return 'ILY';

    // index + middle only
    if (f.ext.index && f.ext.middle && !f.ext.ring && !f.ext.pinky) {
      if (f.crossed) return 'R';                       // crossed fingers
      if (!f.thumbOut) return f.sepIM > 0.45 ? 'V' : 'U'; // spread vs. together
      return null;                                      // index+middle+thumb: not in catalogue
    }

    // W: index + middle + ring
    if (f.ext.index && f.ext.middle && f.ext.ring && !f.ext.pinky && !f.thumbOut) return 'W';

    // index only → L (thumb out) or POINT control (thumb tucked)
    if (f.ext.index && !f.ext.middle && !f.ext.ring && !f.ext.pinky) {
      return f.thumbOut ? 'L' : 'POINT';
    }

    // pinky only → Y (thumb out) or I
    if (!f.ext.index && !f.ext.middle && !f.ext.ring && f.ext.pinky) {
      return f.thumbOut ? 'Y' : 'I';
    }

    // thumbs up / down
    if (f.thumbOut && !f.anyFinger) {
      if (f.thumbUp) return 'YES';
      if (f.thumbDown) return 'NO';
      return null; // fist with thumb to the side (A/S family): intentionally skipped
    }

    // closed fist → CLEAR control
    if (!f.anyFinger && !f.thumbOut) return 'FIST';

    return null;
  }

  global.Sign2Speech = { GESTURES, ORDER, MotionTracker, classify, features, handSize };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
if (typeof module !== 'undefined' && module.exports) module.exports = (typeof window !== 'undefined' ? window : globalThis).Sign2Speech;
```


## `engine/src/recognizer.js`

```js
/*
 * Sign2Speech — framework-agnostic recognizer.
 *
 * Wraps the per-frame classifier (gestures.js) with the temporal logic the
 * prototype uses: motion tracking, hold-to-commit smoothing, and a tiny
 * transcript model. No DOM, no MediaPipe — you feed it landmarks, it emits
 * events. Works in React/Next, Vue, Svelte, plain JS, and Node.
 *
 *   const rec = createRecognizer({ onCommit, onUpdate });
 *   // every frame, with MediaPipe's results.multiHandLandmarks[0] (or null):
 *   rec.push(landmarks, performance.now());
 */
(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./gestures.js'));
  } else {
    global.Sign2SpeechRecognizer = factory(global.Sign2Speech);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (S2S) {
  'use strict';

  const DEFAULTS = {
    letterHold: 8,      // stable frames before a letter/word commits (~0.5 s at 15–20 fps)
    controlHold: 18,    // stable frames before a control gesture fires (~1.2 s)
    motionWindowMs: 1300,
  };

  function createRecognizer(options) {
    const opt = Object.assign({}, DEFAULTS, options || {});
    const motion = new S2S.MotionTracker(opt.motionWindowMs);
    const listeners = { update: [], commit: [], transcript: [] };
    if (opt.onUpdate) listeners.update.push(opt.onUpdate);
    if (opt.onCommit) listeners.commit.push(opt.onCommit);
    if (opt.onTranscript) listeners.transcript.push(opt.onTranscript);

    let curId = null, stable = 0, committed = false;
    let word = '', transcript = '';

    const emit = (type, payload) => listeners[type].forEach((fn) => fn(payload));
    const requiredFrames = (id) =>
      S2S.GESTURES[id] && S2S.GESTURES[id].kind === 'control' ? opt.controlHold : opt.letterHold;

    function flushWord() {
      if (word) { transcript += word + ' '; word = ''; }
    }

    function commit(id) {
      const g = S2S.GESTURES[id];
      if (!g) return;
      let action = null;
      if (g.kind === 'letter') {
        word += g.name; action = 'letter';
      } else if (g.kind === 'word') {
        flushWord(); transcript += g.name + ' '; action = 'word';
      } else if (g.action === 'space') {
        flushWord(); action = 'space';
      } else if (g.action === 'clear') {
        word = ''; transcript = ''; action = 'clear';
      } else if (g.action === 'speak') {
        flushWord(); action = 'speak';
      }
      emit('commit', { id, gesture: g, action, word, transcript: transcript.trim() });
      emit('transcript', { word, transcript: transcript.trim(), speak: action === 'speak' || (action === 'word' ? g.name : null) });
    }

    /**
     * Feed one frame.
     * @param {Array<{x:number,y:number,z?:number}>|null} lm  21 MediaPipe landmarks, or null if no hand
     * @param {number} t  timestamp in ms (performance.now())
     * @returns {{id:string|null, progress:number, stable:number, features:object|null, motion:object}}
     */
    function push(lm, t) {
      if (t == null) t = Date.now();
      if (lm && lm.length >= 21) {
        const cx = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
        const cy = (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5;
        motion.push(t, cx, cy, S2S.handSize(lm));
      } else {
        motion.push(t, null, null, null);
      }
      const m = motion.analyze();
      const id = lm && lm.length >= 21 ? S2S.classify(lm, m) : null;

      if (id === curId) stable += 1;
      else { curId = id; stable = 1; committed = false; }

      const req = id ? requiredFrames(id) : 0;
      const progress = req ? Math.min(1, stable / req) : 0;
      if (id && !committed && stable >= req) { commit(id); committed = true; }

      const state = { id, gesture: id ? S2S.GESTURES[id] : null, progress, stable, features: lm ? S2S.features(lm) : null, motion: m };
      emit('update', state);
      return state;
    }

    return {
      push,
      on(type, fn) { if (listeners[type]) listeners[type].push(fn); return this; },
      reset() { curId = null; stable = 0; committed = false; motion.pts.length = 0; },
      clear() { word = ''; transcript = ''; emit('transcript', { word, transcript, speak: null }); },
      commitWord() { flushWord(); emit('transcript', { word, transcript: transcript.trim(), speak: null }); },
      get word() { return word; },
      get transcript() { return transcript.trim(); },
      get options() { return opt; },
      GESTURES: S2S.GESTURES,
      ORDER: S2S.ORDER,
    };
  }

  return { createRecognizer, DEFAULTS, GESTURES: S2S.GESTURES, ORDER: S2S.ORDER, classify: S2S.classify, features: S2S.features };
});
```


## `engine/test/classify.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { classify, features, createRecognizer, GESTURES, ORDER } = require('../src/index.js');
const FIX = require(path.join(__dirname, 'fixtures', 'landmarks.json'));

// Ground truth for the fixture landmarks (captured from MediaPipe Hands on the bundled sample photos)
const EXPECTED = {
  cand_ily: 'ILY',          // 🤟 I love you
  cand_thumbs2: 'YES',      // 👍
  cand_point: 'L',          // index up + thumb out → letter L
  open_palm: null,          // open spread palm is not a sign in the catalogue
  thumbs_up: 'YES',         // 👍 (older photo with a poorer landmark fit — must still be YES)
};

const NO_MOTION = { hello: false, thanks: false, signChanges: 0, xRange: 0, yRange: 0, sizeGrow: 1 };

test('catalogue is consistent', () => {
  assert.equal(ORDER.length, 16);
  for (const id of ORDER) assert.ok(GESTURES[id], `missing gesture ${id}`);
  assert.equal(ORDER.filter((id) => GESTURES[id].kind === 'control').length, 3);
});

for (const [name, expected] of Object.entries(EXPECTED)) {
  test(`classify(${name}) → ${expected}`, () => {
    assert.equal(classify(FIX[name], NO_MOTION), expected);
  });
}

test('mirroring the hand does not change the label', () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const mirrored = FIX[name].map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
    assert.equal(classify(mirrored, NO_MOTION), expected, name);
  }
});

test('finger extension: folded fingers are not reported as extended', () => {
  const f = features(FIX.cand_ily);
  assert.deepEqual(f.ext, { index: true, middle: false, ring: false, pinky: true });
  const t = features(FIX.cand_thumbs2);
  assert.deepEqual(t.ext, { index: false, middle: false, ring: false, pinky: false });
  assert.ok(t.thumbOut && t.thumbUp);
});

test('recognizer commits once after the hold threshold', () => {
  const commits = [];
  const rec = createRecognizer({ letterHold: 5, controlHold: 8, onCommit: (c) => commits.push(c) });
  let t = 0;
  for (let i = 0; i < 20; i++) rec.push(FIX.cand_thumbs2, (t += 50));
  assert.equal(commits.length, 1);
  assert.equal(commits[0].id, 'YES');
  assert.equal(rec.transcript, 'YES');
  // a different sign resets the counter and can commit again
  for (let i = 0; i < 6; i++) rec.push(FIX.cand_ily, (t += 50));
  assert.equal(rec.transcript, 'YES I LOVE YOU');
  // same sign again only commits after the hand leaves / label changes
  for (let i = 0; i < 6; i++) rec.push(null, (t += 50));
  for (let i = 0; i < 6; i++) rec.push(FIX.cand_ily, (t += 50));
  assert.equal(rec.transcript, 'YES I LOVE YOU I LOVE YOU');
});

test('letters build a word; point (space) commits it; fist clears', () => {
  const rec = createRecognizer({ letterHold: 3, controlHold: 4 });
  let t = 0;
  for (let i = 0; i < 4; i++) rec.push(FIX.cand_point, (t += 50)); // L
  assert.equal(rec.word, 'L');
  rec.commitWord();
  assert.equal(rec.transcript, 'L');
  rec.clear();
  assert.equal(rec.transcript, '');
});

test('progress rises monotonically to 1 while a sign is held', () => {
  const rec = createRecognizer({ letterHold: 4 });
  const p = [];
  for (let i = 0; i < 4; i++) p.push(rec.push(FIX.cand_thumbs2, i * 50).progress);
  assert.deepEqual(p, [0.25, 0.5, 0.75, 1]);
});
```


## `engine/scripts/check-sync.js`

```js
// Fails if prototype/gestures.js and engine/src/gestures.js differ (ignoring the UMD trailer).
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..', '..');
const strip = (s) => s.split('\n').filter((l) => !/^\}\)\(|^if \(typeof module/.test(l)).join('\n').trim();
const a = strip(fs.readFileSync(path.join(root, 'prototype', 'gestures.js'), 'utf8'));
const b = strip(fs.readFileSync(path.join(root, 'engine', 'src', 'gestures.js'), 'utf8'));
if (a !== b) { console.error('✗ prototype/gestures.js and engine/src/gestures.js are out of sync'); process.exit(1); }
console.log('✓ classifier in sync between prototype and engine');
```


---

# Backend — FastAPI (`backend/`)


## `backend/requirements.txt`

```text
fastapi>=0.115
uvicorn[standard]>=0.30
pydantic>=2.7
httpx>=0.27
pytest>=8.0
```


## `backend/.env.example`

```bash
# SQLite file for transcripts + clips (created automatically)
DATABASE_PATH=./data/sign2speech.db
# Comma-separated origins allowed to call the API (frontend dev server, deployed site)
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
# Server
PORT=8001
```


## `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV DATABASE_PATH=/data/sign2speech.db PORT=8001
VOLUME ["/data"]
EXPOSE 8001
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
```


## `backend/app/__init__.py`

```python
# (empty — marks the package)
```


## `backend/app/main.py`

```python
"""Sign2Speech backend — optional companion API for the 100 % on-device web app.

Nothing here is required for recognition. It exists for:
  * transcript history (so a conversation can be reviewed later),
  * collecting labelled landmark clips to train the next, learned model,
  * serving the gesture catalogue so the frontend and engine stay in sync.
No video or images are ever accepted — only landmark coordinates.
"""
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .catalogue import GESTURES, IDS
from .schemas import ClipIn, ClipOut, ClipStats, TranscriptIn, TranscriptOut


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Sign2Speech API", version="0.1.0", lifespan=lifespan,
              description="Companion API: transcript history, training-clip collection, gesture catalogue.")

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins or ["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "sign2speech-api", "version": app.version}


@app.get("/api/gestures", tags=["catalogue"])
def gestures(kind: str | None = Query(default=None, pattern="^(letter|word|control)$")):
    return [g for g in GESTURES if kind is None or g["kind"] == kind]


# ---------------------------------------------------------------- transcripts
@app.post("/api/transcripts", response_model=TranscriptOut, status_code=201, tags=["transcripts"])
def create_transcript(t: TranscriptIn):
    with db.connect() as con:
        cur = con.execute("INSERT INTO transcripts(session_id, text, words) VALUES (?,?,?)",
                          (t.session_id, t.text, db.dumps(t.words)))
        row = con.execute("SELECT * FROM transcripts WHERE id=?", (cur.lastrowid,)).fetchone()
    return _transcript(row)


@app.get("/api/transcripts", response_model=list[TranscriptOut], tags=["transcripts"])
def list_transcripts(session_id: str = Query(min_length=1), limit: int = Query(50, ge=1, le=500)):
    with db.connect() as con:
        rows = con.execute("SELECT * FROM transcripts WHERE session_id=? ORDER BY created_at DESC, id DESC LIMIT ?",
                           (session_id, limit)).fetchall()
    return [_transcript(r) for r in rows]


@app.delete("/api/transcripts/{tid}", status_code=204, tags=["transcripts"])
def delete_transcript(tid: int):
    with db.connect() as con:
        n = con.execute("DELETE FROM transcripts WHERE id=?", (tid,)).rowcount
    if not n:
        raise HTTPException(404, "transcript not found")


def _transcript(r):
    return TranscriptOut(id=r["id"], session_id=r["session_id"], text=r["text"],
                         words=json.loads(r["words"]), created_at=r["created_at"])


# ---------------------------------------------------------------- training clips
@app.post("/api/clips", response_model=ClipOut, status_code=201, tags=["clips"])
def create_clip(c: ClipIn):
    if c.label not in IDS:
        raise HTTPException(422, f"unknown label '{c.label}'. Known: {sorted(IDS)}")
    frames = [[p.model_dump() for p in f] for f in c.frames]
    with db.connect() as con:
        cur = con.execute(
            "INSERT INTO clips(label, fps, n_frames, frames, handedness, contributor, meta) VALUES (?,?,?,?,?,?,?)",
            (c.label, c.fps, len(frames), db.dumps(frames), c.handedness, c.contributor, db.dumps(c.meta)))
        row = con.execute("SELECT id, label, fps, n_frames, created_at FROM clips WHERE id=?", (cur.lastrowid,)).fetchone()
    return ClipOut(**dict(row))


@app.get("/api/clips/stats", response_model=ClipStats, tags=["clips"])
def clip_stats():
    with db.connect() as con:
        rows = con.execute("SELECT label, COUNT(*) AS n FROM clips GROUP BY label").fetchall()
    by = {r["label"]: r["n"] for r in rows}
    return ClipStats(total=sum(by.values()), by_label=by)


@app.get("/api/clips/{cid}", tags=["clips"])
def get_clip(cid: int):
    with db.connect() as con:
        r = con.execute("SELECT * FROM clips WHERE id=?", (cid,)).fetchone()
    if not r:
        raise HTTPException(404, "clip not found")
    d = dict(r)
    d["frames"] = json.loads(d["frames"]); d["meta"] = json.loads(d["meta"] or "{}")
    return d
```


## `backend/app/schemas.py`

```python
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


class Landmark(BaseModel):
    x: float
    y: float
    z: float = 0.0


class TranscriptIn(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1, max_length=4000)
    words: list[str] = Field(default_factory=list)


class TranscriptOut(TranscriptIn):
    id: int
    created_at: str


class ClipIn(BaseModel):
    """A landmark sequence contributed for training the next (learned) model."""
    label: str = Field(min_length=1, max_length=32)
    fps: float = Field(gt=0, le=120)
    frames: list[list[Landmark]] = Field(min_length=1, max_length=600)
    handedness: Optional[str] = Field(default=None, pattern="^(Left|Right)$")
    contributor: Optional[str] = Field(default=None, max_length=64)
    meta: dict[str, Any] = Field(default_factory=dict)

    @field_validator("frames")
    @classmethod
    def frames_have_21_points(cls, v):
        for i, f in enumerate(v):
            if len(f) != 21:
                raise ValueError(f"frame {i} has {len(f)} landmarks; expected 21")
        return v


class ClipOut(BaseModel):
    id: int
    label: str
    fps: float
    n_frames: int
    created_at: str


class ClipStats(BaseModel):
    total: int
    by_label: dict[str, int]
```


## `backend/app/db.py`

```python
"""Tiny SQLite layer — no ORM so the backend has zero native dependencies."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.environ.get("DATABASE_PATH", "./data/sign2speech.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS transcripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  text TEXT NOT NULL,
  words TEXT NOT NULL,            -- JSON array
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id, created_at);

CREATE TABLE IF NOT EXISTS clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,            -- gesture id, e.g. YES, HELLO, B
  fps REAL NOT NULL,
  n_frames INTEGER NOT NULL,
  frames TEXT NOT NULL,           -- JSON: [[{x,y,z} x 21] x n_frames]
  handedness TEXT,
  contributor TEXT,
  meta TEXT,                      -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clips_label ON clips(label);
"""


def init_db(path: str | None = None) -> None:
    global DB_PATH
    if path:
        DB_PATH = path
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        con.executescript(SCHEMA)


@contextmanager
def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def dumps(obj) -> str:
    return json.dumps(obj, separators=(",", ":"))
```


## `backend/app/catalogue.py`

```python
"""Gesture catalogue — mirrors engine/src/gestures.js (keep the two in sync)."""
GESTURES = [
    {"id": "B", "kind": "letter", "name": "B", "label": "Letter B", "shape": "four fingers up and together, thumb across palm"},
    {"id": "I", "kind": "letter", "name": "I", "label": "Letter I", "shape": "pinky only"},
    {"id": "L", "kind": "letter", "name": "L", "label": "Letter L", "shape": "index up + thumb out"},
    {"id": "R", "kind": "letter", "name": "R", "label": "Letter R", "shape": "index and middle crossed"},
    {"id": "U", "kind": "letter", "name": "U", "label": "Letter U", "shape": "index + middle up, together"},
    {"id": "V", "kind": "letter", "name": "V", "label": "Letter V", "shape": "index + middle up, spread"},
    {"id": "W", "kind": "letter", "name": "W", "label": "Letter W", "shape": "index + middle + ring up"},
    {"id": "Y", "kind": "letter", "name": "Y", "label": "Letter Y", "shape": "thumb + pinky out"},
    {"id": "YES", "kind": "word", "name": "YES", "label": "Yes", "emoji": "👍", "shape": "thumb up, fingers curled"},
    {"id": "NO", "kind": "word", "name": "NO", "label": "No", "emoji": "👎", "shape": "thumb down, fingers curled"},
    {"id": "ILY", "kind": "word", "name": "I LOVE YOU", "label": "I love you", "emoji": "🤟", "shape": "thumb + index + pinky extended"},
    {"id": "HELLO", "kind": "word", "name": "HELLO", "label": "Hello", "emoji": "👋", "motion": True, "shape": "open hand waved side to side"},
    {"id": "THANKS", "kind": "word", "name": "THANK YOU", "label": "Thank you", "emoji": "🙏", "motion": True, "shape": "flat hand moves toward the camera"},
    {"id": "POINT", "kind": "control", "name": "Space", "action": "space", "emoji": "☝️", "shape": "index finger only, held ~1.2 s"},
    {"id": "FIST", "kind": "control", "name": "Clear", "action": "clear", "emoji": "✊", "shape": "closed fist, held ~1.2 s"},
    {"id": "OK", "kind": "control", "name": "Speak", "action": "speak", "emoji": "👌", "shape": "OK sign, held ~1.2 s"},
]
IDS = {g["id"] for g in GESTURES}
```


## `backend/tests/test_api.py`

```python
import os, tempfile
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
FRAME = [{"x": 0.5, "y": 0.5, "z": 0.0}] * 21


def setup_module(_):
    client.__enter__()  # run lifespan → init_db


def test_health():
    r = client.get("/health"); assert r.status_code == 200 and r.json()["status"] == "ok"


def test_catalogue():
    r = client.get("/api/gestures"); assert r.status_code == 200 and len(r.json()) == 16
    assert len(client.get("/api/gestures?kind=control").json()) == 3


def test_transcript_roundtrip():
    r = client.post("/api/transcripts", json={"session_id": "s1", "text": "HELLO YES", "words": ["HELLO", "YES"]})
    assert r.status_code == 201; tid = r.json()["id"]
    r = client.get("/api/transcripts", params={"session_id": "s1"})
    assert r.status_code == 200 and r.json()[0]["text"] == "HELLO YES"
    assert client.delete(f"/api/transcripts/{tid}").status_code == 204
    assert client.delete(f"/api/transcripts/{tid}").status_code == 404


def test_clip_validation_and_stats():
    bad = {"label": "YES", "fps": 30, "frames": [FRAME[:20]]}
    assert client.post("/api/clips", json=bad).status_code == 422
    unknown = {"label": "NOPE", "fps": 30, "frames": [FRAME]}
    assert client.post("/api/clips", json=unknown).status_code == 422
    ok = {"label": "YES", "fps": 30, "frames": [FRAME] * 5, "handedness": "Right", "contributor": "test"}
    r = client.post("/api/clips", json=ok); assert r.status_code == 201 and r.json()["n_frames"] == 5
    cid = r.json()["id"]
    assert client.get(f"/api/clips/{cid}").json()["label"] == "YES"
    s = client.get("/api/clips/stats").json(); assert s["total"] >= 1 and s["by_label"]["YES"] >= 1
```
