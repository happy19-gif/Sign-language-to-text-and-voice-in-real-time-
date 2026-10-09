# `frontend/` — the Sign2Speech app (React + TypeScript + Vite, installable PWA)

> **Owner:** Praneet007-47 (with happy19-gif, siddamodar06-dotcom). A complete, working app —
> run it, extend it, restyle it. The vanilla reference implementation lives in
> [`../prototype/`](../prototype/) and is deployed alongside it at `/prototype/`.

## Run
```bash
cd frontend
npm install
npm run dev          # http://localhost:3000/Sign-language-to-text-and-voice-in-real-time/  (camera works on localhost)
npm run build        # typecheck + production build → dist/  (also syncs engine, model and samples into public/)
npm run preview      # serve the production build
```
Hosting at a domain root instead of GitHub Pages? `VITE_BASE=/ npm run build`.

## What's inside
| Path | Role |
|---|---|
| `src/hooks/useSign2Speech.ts` | the whole loop: camera / sample / upload sources → MediaPipe Hands → `engine` recognizer → React state; mirror rule; FPS/latency; keyboard fallback; auto-start |
| `src/lib/engine.ts` | typed bridge to the shared engine (`createRecognizer`, event types) |
| `src/lib/camera.ts` | `getUserMedia` + precise failure diagnostics (`NotAllowedError`, `NotFoundError`, in-use, blocked-by-embed, insecure) |
| `src/lib/speech.ts` | Web Speech API wrapper (prefers an en-IN voice when available) |
| `src/components/` | `CameraStage` (video + skeleton canvas + chip + hold bar + start overlay), `SourceBar`, `TranscriptPanel`, `ReferenceGrid`, `StatusBar`, `InstallPrompt` |
| `scripts/sync-assets.mjs` | copies `../engine/src`, `../prototype/vendor/hands`, `../prototype/samples` into `public/` before dev/build (git-ignored) |
| `vite.config.ts` | base path for Pages + PWA manifest + Workbox precache (model bundle included → works offline) |

## Install it like an app
It ships a web-app manifest and a service worker, so on Android (Chrome) / iOS (Safari → Share → *Add to Home Screen*) / desktop Chrome it installs as **Sign2Speech** with its own icon, launches full-screen, and keeps working offline after the first load. The ⬇️ *Install app* button appears in the header when the browser offers it.

## Verified
Headless Chrome + simulated webcam against the production build: camera auto-start → 👍 → "YES"; blocked-camera diagnostics; sample → "I LOVE YOU"; upload → "YES"; Backspace clears; service worker registered; manifest valid; 0 JS errors; desktop and 390 px phone layouts.

---

## Integration contract (how the app talks to the engine)

The app does **four** things; everything else (classification, motion, hold-to-commit,
transcript) is done by the engine so it is never re-implemented in UI code:

1. get webcam frames (`getUserMedia`) and run **MediaPipe Hands** on them,
2. feed the 21 landmarks per frame to **`@sign2speech/engine`**,
3. render what the engine tells you (current sign, hold progress, transcript),
4. speak committed words with the **Web Speech API**.

---

```js
import { createRecognizer } from '../engine/src/index.js'; // or copy engine/src into your app

const rec = createRecognizer({
  letterHold: 8,     // frames a letter/word must stay stable before it commits (~0.5 s)
  controlHold: 18,   // frames for ☝ ✊ 👌 controls (~1.2 s) — longer on purpose
  onUpdate: (s) => { /* every frame */ },
  onCommit: (c) => { /* once per committed sign */ },
  onTranscript: (t) => { /* whenever the transcript text changes */ },
});

// every frame: landmarks = results.multiHandLandmarks?.[0] ?? null
rec.push(landmarks, performance.now());
```

| Callback payload | Fields | Use it for |
|---|---|---|
| `onUpdate(s)` | `s.id` (`'YES'`, `'B'`, `'POINT'`, … or `null`) · `s.gesture` `{kind,name,emoji,action}` · `s.progress` 0–1 · `s.features` · `s.motion` | the live chip, the hold-progress bar, the debug panel |
| `onCommit(c)` | `c.id` · `c.gesture` · `c.action` (`letter` / `word` / `space` / `clear` / `speak`) · `c.word` · `c.transcript` | toasts, haptics, analytics, **speaking a word** |
| `onTranscript(t)` | `t.word` (letters typed so far) · `t.transcript` · `t.speak` (`string` to speak now, `true` = speak whole transcript, or `null`) | the transcript panel + TTS |

Other methods: `rec.transcript`, `rec.word`, `rec.commitWord()`, `rec.clear()`, `rec.reset()`
(call `reset()` when the camera restarts), `rec.GESTURES` / `rec.ORDER` (for the reference grid).

### Gesture → UI action mapping you must honour

| Gesture | `c.action` | Expected UI behaviour |
|---|---|---|
| ☝️ point (held ~1.2 s) | `space` | commit current word to transcript |
| ✊ fist (held ~1.2 s) | `clear` | clear transcript (show a toast — it is destructive) |
| 👌 OK (held ~1.2 s) | `speak` | speak the whole transcript aloud |
| any word sign | `word` | append word; speak it if voice mode is on |
| any letter | `letter` | append to the current word (show it being built) |

### Mirroring rule (so the skeleton lines up)

* Live webcam → display mirrored (CSS `transform: scaleX(-1)`) **and** MediaPipe `selfieMode: true`.
* Uploaded photo/video → display as-is **and** `selfieMode: false`.
* The classifier is orientation-invariant, so either is fine for recognition — this is only about
  the overlay matching the picture.

### Camera failure UX (please keep)

Show the *reason* (`NotAllowedError`, `NotFoundError`, `NotReadableError`, blocked-by-embed-policy,
insecure context) and the remedy, plus a **"try a sample image / upload"** fallback that feeds the
same pipeline. See `prototype/app.js → cameraBlockReason()`.

---

## Minimal React example

```tsx
// useSign2Speech.ts
import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { createRecognizer } from '@sign2speech/engine';

export function useSign2Speech(video: React.RefObject<HTMLVideoElement>) {
  const [state, setState] = useState<{ id: string | null; progress: number }>({ id: null, progress: 0 });
  const [transcript, setTranscript] = useState('');
  const rec = useRef(createRecognizer({
    onUpdate: (s) => setState({ id: s.id, progress: s.progress }),
    onTranscript: (t) => {
      setTranscript(t.transcript);
      if (t.speak) speechSynthesis.speak(new SpeechSynthesisUtterance(t.speak === true ? t.transcript : t.speak));
    },
  }));

  useEffect(() => {
    const hands = new Hands({ locateFile: (f) => `/vendor/hands/${f}` }); // copy prototype/vendor/hands → public/vendor/hands
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6, selfieMode: true });
    hands.onResults((r) => rec.current.push(r.multiHandLandmarks?.[0] ?? null, performance.now()));
    let running = true;
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } });
      video.current!.srcObject = stream; await video.current!.play(); await hands.initialize();
      const loop = async () => { if (!running) return; await hands.send({ image: video.current! }); requestAnimationFrame(loop); };
      loop();
    })();
    return () => { running = false; };
  }, []);

  return { ...state, transcript, rec: rec.current };
}
```

## Plain-JS example

```html
<script src="engine/src/gestures.js"></script>
<script src="engine/src/recognizer.js"></script>
<script>
  const rec = Sign2SpeechRecognizer.createRecognizer({ onCommit: (c) => console.log(c.id, c.transcript) });
  hands.onResults((r) => rec.push(r.multiHandLandmarks?.[0] ?? null, performance.now()));
</script>
```

## Optional backend calls

If the companion API is running (see [`../backend`](../backend)):

* `POST /api/transcripts` `{ session_id, text, words }` — save a conversation
* `POST /api/clips` `{ label, fps, frames: [[{x,y,z}×21]…] }` — contribute a labelled clip (landmarks only, never video)
* `GET  /api/gestures` — catalogue for the reference grid

## Definition of done (all met by the current app)

- [x] Camera auto-starts, skeleton overlay aligned (mirroring rule above)
- [x] Live chip + hold bar driven by `onUpdate`
- [x] Transcript + voice driven by `onTranscript`
- [x] All three control gestures work hands-free; keyboard fallback (Enter / Space / Backspace)
- [x] Sample-image / upload fallback when the camera is blocked
- [x] Works on a phone (responsive, `facingMode: 'user'`)
- [x] No network calls required for recognition (privacy promise in the README)
