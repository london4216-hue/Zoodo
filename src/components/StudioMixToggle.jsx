import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Music, Mic } from 'lucide-react';
import { startAmbientMusic, stopAmbientMusic, isMusicPlaying, setMusicMode, getMusicMode } from '@/lib/sensoryAudio';

// Studio mix switch: "Full mix" (music + voice) or "Voice only" (music off).
// In Full mix the bed auto-ducks while voice/parent audio plays.
export default function StudioMixToggle() {
  const [mode, setMode] = useState(getMusicMode() || 'full');

  useEffect(() => {
    const start = () => {
      if (getMusicMode() === 'full' && !isMusicPlaying()) startAmbientMusic();
      window.removeEventListener('pointerdown', start);
    };
    window.addEventListener('pointerdown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      if (isMusicPlaying()) stopAmbientMusic();
    };
  }, []);

  const choose = (m) => { setMode(m); setMusicMode(m); };

  return (
    <div className="fixed bottom-20 right-4 z-40 flex items-center gap-1 rounded-full bg-white/85 p-1 shadow-lg backdrop-blur">
      <Seg active={mode === 'full'} onClick={() => choose('full')} icon={<Music className="h-4 w-4" />} label="Full mix" />
      <Seg active={mode === 'voice'} onClick={() => choose('voice')} icon={<Mic className="h-4 w-4" />} label="Voice" />
    </div>
  );
}

function Seg({ active, onClick, icon, label }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold transition ${
        active ? 'bg-[#7B4FE0] text-white shadow' : 'text-black/40'
      }`}
      aria-pressed={active}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}