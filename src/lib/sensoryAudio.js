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

// Soft pop for tap feedback on sensory buttons.
export const playPop = () => {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(660, now);
  o.frequency.exponentialRampToValueAtTime(990, now + 0.08);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  o.connect(g);
  g.connect(c.destination);
  o.start(now);
  o.stop(now + 0.2);
};

// Gentle ambient music: a soft pad + a slow pentatonic melody loop. Toggleable.
let music = { playing: false, timer: null, master: null, padOscs: [] };

export const startAmbientMusic = () => {
  if (music.playing) return;
  const c = getCtx();
  if (!c) return;
  music.playing = true;
  const master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);
  master.gain.setTargetAtTime(0.1, c.currentTime, 1.2);
  music.master = master;

  // Soft pad chord (C major-ish).
  const padFreqs = [130.81, 196.0, 261.63];
  const padGain = c.createGain();
  padGain.gain.value = 0.5;
  padGain.connect(master);
  music.padOscs = padFreqs.map((f) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(padGain);
    o.start();
    return o;
  });

  // Slow pentatonic melody (C5 D5 E5 G5 A5).
  const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
  const playNote = () => {
    if (!music.playing) return;
    const now = c.currentTime;
    const f = scale[Math.floor(Math.random() * scale.length)];
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 1.5);
  };
  music.timer = setInterval(playNote, 1500);
  playNote();
};

export const stopAmbientMusic = () => {
  if (!music.playing) return;
  const c = getCtx();
  music.playing = false;
  if (music.timer) { clearInterval(music.timer); music.timer = null; }
  if (c && music.master) {
    music.master.gain.setTargetAtTime(0, c.currentTime, 0.5);
  }
  const padOscs = music.padOscs;
  const master = music.master;
  setTimeout(() => {
    padOscs.forEach((o) => { try { o.stop(); } catch (e) {} });
    try { master && master.disconnect(); } catch (e) {}
  }, 1200);
  music.padOscs = [];
  music.master = null;
};

export const isMusicPlaying = () => music.playing;