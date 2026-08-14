// THE single audio authority for the entire lesson experience (AudioController).
//
// Spec API: play(url) / stop() / unload() / on(event, cb) / off(event, cb).
// Only one sound is ever allowed to play at a time. Before starting any new
// track this controller stops AND unloads whatever was playing before — no
// exceptions. Emits: 'play' | 'stop' | 'unload' | 'ended' | 'error'.
//
// Nothing in the lesson plays outside this controller.

import { stopAmbientMusic, isMusicPlaying } from '@/lib/sensoryAudio';

let currentEl = null;     // the active HTMLAudioElement (or null)
let currentKind = null;   // 'greeting' | 'narration' | 'cheer' | null
let endedHandler = null;

// --- Event emitter (spec: on / off) ---
const listeners = {}; // { event: Set<cb> }
function emit(event, payload) {
  const set = listeners[event];
  if (!set) return;
  for (const cb of set) { try { cb(payload); } catch (e) { /* ignore */ } }
}
export function on(event, cb) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(cb);
  return () => off(event, cb); // unsubscribe handle
}
export function off(event, cb) {
  const set = listeners[event];
  if (set) set.delete(cb);
}

function detach() {
  if (endedHandler && currentEl) {
    currentEl.removeEventListener('ended', endedHandler);
    currentEl.removeEventListener('error', endedHandler);
  }
  endedHandler = null;
}

function stopCurrent(emitStop = true) {
  if (currentEl) {
    try { currentEl.pause(); } catch (e) { /* ignore */ }
    try { currentEl.src = ''; } catch (e) { /* ignore */ }
    detach();
    currentEl = null;
    currentKind = null;
    if (emitStop) emit('stop');
  }
}

// Play one audio track from a URL. Stops + unloads whatever is currently
// playing FIRST, then plays. Resolves when the track ends, errors, or is
// stopped. onStarted(el) fires once playback begins (so callers can read
// el.duration). Emits 'play' on start, 'ended'/'error' on finish.
export function playAudio(src, { kind = 'audio', onEnded, onStarted } = {}) {
  if (!src) return Promise.resolve();
  stopCurrent();
  return new Promise((resolve) => {
    const a = new Audio();
    try { a.src = src; } catch (e) { resolve(); return; }
    a.preload = 'auto';
    currentEl = a;
    currentKind = kind;
    const finish = (ev) => {
      const cb = onEnded; onEnded = null;
      stopCurrent(false);
      emit(ev === 'error' ? 'error' : 'ended', { kind });
      try { cb?.(); } catch (e) { /* ignore */ }
      resolve();
    };
    endedHandler = finish;
    a.addEventListener('ended', () => finish('ended'), { once: true });
    a.addEventListener('error', () => finish('error'), { once: true });
    const started = (el) => { emit('play', { kind }); try { onStarted?.(el); } catch (e) { /* ignore */ } };
    a.addEventListener('loadedmetadata', () => started(a), { once: true });
    a.play()
      .then(() => started(a))
      .catch(() => { stopCurrent(false); emit('error', { kind }); resolve(); });
  });
}

// Spec alias: play(url)
export function play(url, opts) { return playAudio(url, opts); }

// Stop the current track.
export function stop() { stopCurrent(); }

// Stop and fully unload the current track (release the element).
export function unload() {
  stopCurrent();
  emit('unload');
}

// Back-compat alias used by existing lesson components.
export function stopAll() { stopCurrent(); }

export function getKind() { return currentKind; }
export function isPlaying() { return !!currentEl; }

// Silence the ambient music bed entirely for the lesson. Returns whether it
// was on, so the caller can restore it later if desired. Home restarts it on
// the next user gesture after the lesson returns.
export function silenceAmbient() {
  const wasOn = isMusicPlaying();
  stopAmbientMusic();
  return wasOn;
}