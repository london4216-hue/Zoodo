// Unlocks HTML5 audio (and Web Audio) for the session from a single user
// gesture, so the Zoodo intro and the end-of-lesson parent video can
// autoplay WITH SOUND with no extra tap.
let unlocked = false;

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  // Resume any Web Audio context (ambient music).
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      const c = new AC();
      if (c.state === 'suspended') c.resume().catch(() => {});
    }
  } catch (e) { /* ignore */ }
  // Play a valid silent WAV to unlock HTML5 audio-with-sound for the session.
  try {
    const buf = new ArrayBuffer(44);
    const v = new DataView(buf);
    let p = 0;
    const ws = (s) => { for (let i = 0; i < s.length; i++) v.setUint8(p++, s.charCodeAt(i)); };
    ws('RIFF'); v.setUint32(p, 36, true); p += 4; ws('WAVE'); ws('fmt ');
    v.setUint32(p, 16, true); p += 4; v.setUint16(p, 1, true); p += 2;
    v.setUint16(p, 1, true); p += 2; v.setUint32(p, 8000, true); p += 4;
    v.setUint32(p, 8000, true); p += 4; v.setUint16(p, 1, true); p += 2;
    v.setUint16(p, 8, true); p += 2; ws('data'); v.setUint32(p, 0, true); p += 4;
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    const a = new Audio(url);
    a.volume = 0.0001;
    a.play()
      .then(() => { try { a.pause(); } catch (e) {} setTimeout(() => URL.revokeObjectURL(url), 1500); })
      .catch(() => { URL.revokeObjectURL(url); });
  } catch (e) { /* ignore */ }
}