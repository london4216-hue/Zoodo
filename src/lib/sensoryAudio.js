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

// Fun, bubbly "POP!" for popping a bubble — pitchy slide + a short noise click.
export const playBubblePop = () => {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(900, now);
  o.frequency.exponentialRampToValueAtTime(170, now + 0.12);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  o.connect(g);
  g.connect(c.destination);
  o.start(now);
  o.stop(now + 0.18);
  const bufferSize = 2048;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.2, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  noise.connect(filter);
  filter.connect(ng);
  ng.connect(c.destination);
  noise.start(now);
  noise.stop(now + 0.1);
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

// Gentle ambient music: a soft pad + a slow melody loop. Each time it starts,
// a different "song" (chord, scale, tempo, tone color) is picked so the music
// feels fresh every time.
const SONGS = [
  { name: 'C major', pad: [130.81, 196.0, 261.63], scale: [523.25, 587.33, 659.25, 783.99, 880.0], wave: 'triangle', tempo: 1500, noteDur: 1.4, gain: 0.22 },
  { name: 'A minor', pad: [110.0, 164.81, 220.0], scale: [440.0, 523.25, 587.33, 659.25, 783.99], wave: 'sine', tempo: 1700, noteDur: 1.6, gain: 0.2 },
  { name: 'G major', pad: [98.0, 146.83, 196.0], scale: [392.0, 440.0, 493.88, 587.33, 659.25], wave: 'triangle', tempo: 1300, noteDur: 1.2, gain: 0.18 },
  { name: 'F major', pad: [87.31, 130.81, 174.61], scale: [349.23, 392.0, 440.0, 523.25, 587.33], wave: 'sine', tempo: 1850, noteDur: 1.7, gain: 0.2 },
  { name: 'D dorian', pad: [73.42, 110.0, 146.83], scale: [293.66, 329.63, 392.0, 440.0, 493.88], wave: 'triangle', tempo: 1600, noteDur: 1.5, gain: 0.19 },
  { name: 'E lydian', pad: [82.41, 123.47, 164.81], scale: [329.63, 369.99, 440.0, 493.88, 554.37], wave: 'sine', tempo: 1450, noteDur: 1.3, gain: 0.21 },
  { name: 'Pentatonic G', pad: [98.0, 130.81, 196.0], scale: [392.0, 440.0, 523.25, 587.33, 659.25], wave: 'triangle', tempo: 1550, noteDur: 1.45, gain: 0.2 },
];

let music = { playing: false, timer: null, master: null, padOscs: [], lastSongIdx: -1 };

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

  // Pick a different song than last time.
  let idx = Math.floor(Math.random() * SONGS.length);
  if (SONGS.length > 1 && idx === music.lastSongIdx) idx = (idx + 1) % SONGS.length;
  music.lastSongIdx = idx;
  const song = SONGS[idx];

  // Soft pad chord.
  const padGain = c.createGain();
  padGain.gain.value = 0.5;
  padGain.connect(master);
  music.padOscs = song.pad.map((f) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(padGain);
    o.start();
    return o;
  });

  // Slow melody over the song's scale.
  const playNote = () => {
    if (!music.playing) return;
    const now = c.currentTime;
    const f = song.scale[Math.floor(Math.random() * song.scale.length)];
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = song.wave;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(song.gain, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + song.noteDur);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + song.noteDur + 0.1);
  };
  music.timer = setInterval(playNote, song.tempo);
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