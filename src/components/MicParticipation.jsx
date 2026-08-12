import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Check } from 'lucide-react';
import { playSuccess, vibrate } from '@/lib/sensoryAudio';

// Lightweight participation check for lessons where the camera isn't useful
// (e.g. counting, where there's no visible mouth movement to verify). The kid
// taps the mic when they try the activity — a simple, camera-free confirmation.
export default function MicParticipation({ kidName, targetLabel, onDone }) {
  const [done, setDone] = useState(false);

  const handleTap = () => {
    playSuccess();
    vibrate(40);
    setDone(true);
    onDone?.();
  };

  return (
    <div className="mt-3 flex flex-col items-center rounded-2xl bg-[#FFF6E6] p-4 text-center">
      <p className="font-bold text-black/70 mb-1">
        Did {kidName} try it?
      </p>
      {targetLabel && (
        <p className="text-sm font-semibold text-black/50 mb-3">{targetLabel}</p>
      )}
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.06 }}
        onClick={handleTap}
        disabled={done}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4969E1] text-white disabled:opacity-60"
        style={{ boxShadow: '0 0 16px #4969E188' }}
        aria-label={`Mark that ${kidName} tried`}
      >
        {done ? <Check className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
      </motion.button>
      <p className="mt-2 text-sm font-semibold text-black/50">
        {done ? `Great job, ${kidName}!` : `Tap the mic when ${kidName} tries!`}
      </p>
    </div>
  );
}