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
