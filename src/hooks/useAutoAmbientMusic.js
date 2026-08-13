import { useEffect } from 'react';
import { startAmbientMusic, isMusicPlaying, isMusicEnabled } from '@/lib/sensoryAudio';

// Starts a gentle ambient music loop on the first user interaction (tap/click)
// anywhere on the page — browsers block audio until a gesture occurs. The
// MusicToggle remains available to turn it off. Drop into any student page.
export default function useAutoAmbientMusic() {
  useEffect(() => {
    const start = () => {
      if (!isMusicEnabled()) return;
      if (!isMusicPlaying()) startAmbientMusic({ volume: 0.34 });
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, []);
}