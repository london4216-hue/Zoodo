// Lightweight sensory sound effects synthesized with the Web Audio API — no
// audio assets needed. Used across the Weekly Activities play experience for
// sparkles, success bursts, completion jingles, and gentle mobile vibration.

let ctx = null;

const getCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

const tone = (freq, start, dur, type = 'sine', gain = 0.18) => {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.05);
};

export const playSparkle = () => {
  tone(1200, 0, 0.12, 'sine', 0.1);
  tone(1600, 0.06, 0.12, 'sine', 0.08);
};

export const playSuccess = () => {
  tone(523, 0, 0.16, 'triangle', 0.16);
  tone(659, 0.12, 0.16, 'triangle', 0.16);
  tone(784, 0.24, 0.22, 'triangle', 0.18);
};

export const playComplete = () => {
  tone(523, 0, 0.18, 'triangle', 0.18);
  tone(659, 0.14, 0.18, 'triangle', 0.18);
  tone(784, 0.28, 0.18, 'triangle', 0.18);
  tone(1047, 0.42, 0.34, 'triangle', 0.2);
};

export const vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }
};