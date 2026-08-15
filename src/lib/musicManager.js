// musicManager.js — thin re-export layer over sensoryAudio so callers can
// import from a stable "music manager" path without knowing the internal module.
// Activity-specific themes map to the same synthesized ambient loop for now;
// future iterations can swap in different oscillator patterns per theme.

export {
  startAmbientMusic,
  stopAmbientMusic,
  isMusicPlaying,
  playSuccess,
  playComplete,
  playPraiseJingle,
  vibrate,
} from '@/lib/sensoryAudio';

// Theme identifiers accepted by setMusicTheme (for forward-compatibility).
export const THEMES = {
  ONBOARDING: 'onboarding',
  LESSON: 'lesson',
  VIDEO: 'video',
  ASSESSMENT: 'assessment',
  CELEBRATION: 'celebration',
};

// Switch the ambient music theme. Currently all themes map to the same loop
// (the Web Audio synthesizer in sensoryAudio). Swap out startAmbientMusic calls
// here when theme-specific audio tracks become available.
export function setMusicTheme(theme) {
  // eslint-disable-next-line no-unused-vars
  void theme; // placeholder — no-op until per-theme tracks land
}
