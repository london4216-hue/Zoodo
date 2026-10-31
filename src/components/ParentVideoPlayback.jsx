// ParentVideoPlayback — renders a parent cheer video (or falls back to the
// Zoodo avatar celebration) and fires a confetti burst when each one starts.
// Designed to be used inside CelebrationSequence or CelebrationOverlay.

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ZoodoAvatar } from '@/components/ZoodoAvatar';

const COLORS = ['#FF9EC4', '#4969E1', '#FFE08A', '#4FAE5A', '#7B4FE0'];

export default function ParentVideoPlayback({ videoUrl, kidName, onEnded }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoUrl) return;
    const el = videoRef.current;
    if (!el) return;
    // The video already has autoPlay; fire confetti on the first play event.
    const burst = () => {
      confetti({ particleCount: 100, spread: 120, startVelocity: 40, colors: COLORS, origin: { y: 0.6 } });
    };
    el.addEventListener('play', burst, { once: true });
    return () => el.removeEventListener('play', burst);
  }, [videoUrl]);

  if (!videoUrl) {
    // Fallback: Zoodo avatar celebrates in place of the parent video.
    return (
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-3"
      >
        <ZoodoAvatar size={140} emotion="celebrating" isSpeaking />
        <p className="text-center text-lg font-bold text-white drop-shadow">
          {kidName ? `You did it, ${kidName}! 🎉` : 'You did it! 🎉'}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 14 }}
      className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full aspect-video object-cover"
        playsInline
        autoPlay
        onEnded={onEnded}
      />
      {kidName && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
          <p className="text-white font-bold text-sm text-center drop-shadow">
            💪 A cheer just for you, {kidName}!
          </p>
        </div>
      )}
    </motion.div>
  );
}
