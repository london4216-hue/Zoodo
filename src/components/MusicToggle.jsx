import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Music, Music2 } from 'lucide-react';
import {
  startAmbientMusic,
  stopAmbientMusic,
  isMusicPlaying,
  isMusicEnabled,
  setMusicEnabled,
} from '@/lib/sensoryAudio';

// Floating music toggle: turns a gentle ambient melody on/off. Off by default
// (browsers block autoplay until a user interacts).
export default function MusicToggle() {
  const [on, setOn] = useState(() => isMusicEnabled());

  useEffect(() => {
    setOn(isMusicEnabled());
  }, []);

  const toggle = () => {
    if (on) {
      setMusicEnabled(false);
      stopAmbientMusic();
      setOn(false);
    } else {
      setMusicEnabled(true);
      startAmbientMusic({ volume: 0.34 });
      setOn(true);
    }
  };

  useEffect(
    () => () => {
      if (!isMusicEnabled() && isMusicPlaying()) stopAmbientMusic();
    },
    [],
  );

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.08 }}
      className="fixed right-4 top-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white/85 shadow-lg backdrop-blur"
      aria-label={on ? 'Turn music off' : 'Turn music on'}
    >
      <motion.span
        animate={on ? { rotate: [0, 10, -10, 0] } : { rotate: 0 }}
        transition={{ duration: 2, repeat: on ? Infinity : 0, ease: 'easeInOut' }}
      >
        {on ? (
          <Music2 className="h-6 w-6 text-[#7B4FE0]" />
        ) : (
          <Music className="h-6 w-6 text-black/40" />
        )}
      </motion.span>
    </motion.button>
  );
}