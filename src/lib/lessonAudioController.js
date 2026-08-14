// THE single audio authority for the entire lesson experience.
//
// Only one sound is ever allowed to play at a time. Before starting any new
// track (Zoodo VO, lesson narration, celebration cheer) this controller
// explicitly stops and unloads whatever was playing before — no exceptions.
// The ambient background music bed is fully silenced for the whole lesson
// (no background track, no ducked bed). UI stingers are not fired during the
// lesson, so nothing overlaps the narration.
//
// Nothing in the lesson plays outside this controller.

import { stopAmbientMusic, isMusicPlaying } from '@/lib/sensoryAudio';

let currentEl = null;     // the active HTMLAudioElement (or null)
let currentKind = null;   // 'greeting' | 'narration' | 'cheer' | null
let endedHandler = null;

function detach() {
  if (endedHandler && currentEl) {
    currentEl.removeEventListener('ended', endedHandler);
    currentEl.removeEventListener('error', endedHandler);
  }
  endedHandler = null;
}

function stopCurrent() {
  if (currentEl) {
    try { currentEl.pause(); } catch (e) { /* ignore */ }
    try { currentEl.src = ''; } catch (e) { /* ignore */ }
    detach();
    currentEl = null;
    currentKind = null;
  }
}

// Play one audio track from a URL. Stops whatever is currently playing FIRST,
// then plays. Resolves when the track ends, errors, or is stopped.
// onStarted(el) fires once playback begins so the caller can read el.duration.
export function playAudio(src, { kind = 'audio', onEnded, onStarted } = {}) {
  if (!src) return Promise.resolve();
  stopCurrent();
  return new Promise((resolve) => {
    const a = new Audio();
    try { a.src = src; } catch (e) { resolve(); return; }
    a.preload = 'auto';
    currentEl = a;
    currentKind = kind;
    const finish = () => {
      const cb = onEnded; onEnded = null;
      stopCurrent();
      try { cb?.(); } catch (e) { /* ignore */ }
      resolve();
    };
    endedHandler = finish;
    a.addEventListener('ended', finish, { once: true });
    a.addEventListener('error', finish, { once: true });
    const started = (el) => { try { onStarted?.(el); } catch (e) { /* ignore */ } };
    a.addEventListener('loadedmetadata', () => started(a), { once: true });
    a.play()
      .then(() => started(a))
      .catch(() => { stopCurrent(); resolve(); });
  });
}

// Stop and unload the current track. Called on every transition and unmount.
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