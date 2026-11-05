// CelebrationSequence — orchestrates the full post-lesson celebration:
//   1st win   → gentle confetti + Zoodo happy bounce + chime sound
//   3rd+ win  → bigger confetti + parent video + double haptic
//   7+/week   → "Week Hero" badge + all parent videos back-to-back + explosion
//
// Props:
//   kidName        — child's first name
//   streakCount    — how many lessons completed this week (drives escalation)
//   parentVideos   — array of parent cheer video URLs
//   onClose        — callback when the sequence is done

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { X } from 'lucide-react';
import { ZoodoAvatar } from '@/components/ZoodoAvatar';
import ParentVideoPlayback from '@/components/ParentVideoPlayback';
import { playComplete, playPraiseJingle, vibrate } from '@/lib/musicManager';

export default function CelebrationSequence({ kidName, streakCount = 1, parentVideos = [], onClose }) {
  const videos = Array.isArray(parentVideos) ? parentVideos.filter(Boolean) : [];
  const isOnARoll = streakCount >= 3;
  const isWeekHero = streakCount >= 7;

  const [videoIdx, setVideoIdx] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const fired = useRef(false);
  const timeoutIds = useRef([]);

  // Clear all scheduled timeouts on unmount.
  useEffect(() => () => timeoutIds.current.forEach(clearTimeout), []);

  const schedule = (fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutIds.current.push(id);
    return id;
  };

  const level = isWeekHero ? 'hero' : isOnARoll ? 'roll' : 'gentle';

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // Haptics
    if (level === 'hero') vibrate([100, 60, 100, 60, 200]);
    else if (level === 'roll') vibrate([80, 50, 80]);
    else vibrate([60]);

    // Sound
    if (level === 'gentle') playComplete();
    else playPraiseJingle();

    // Confetti
    const burst = (count, spread, velocity, origin) =>
      confetti({ particleCount: count, spread, startVelocity: velocity, origin, colors: ['#FF9EC4', '#4969E1', '#FFE08A', '#4FAE5A', '#7B4FE0'] });

    if (level === 'gentle') {
      burst(60, 80, 30, { x: 0.5, y: 0.6 });
    } else if (level === 'roll') {
      burst(120, 110, 45, { x: 0.5, y: 0.6 });
      schedule(() => burst(80, 70, 35, { x: 0.2, y: 0.5 }), 300);
      schedule(() => burst(80, 70, 35, { x: 0.8, y: 0.5 }), 600);
    } else {
      // Hero: 5-wave explosion
      for (let i = 0; i < 5; i++) {
        schedule(() => burst(200, 160, 60, { x: Math.random(), y: Math.random() * 0.6 + 0.1 }), i * 250);
      }
      schedule(() => setShowBadge(true), 800);
    }
  }, [level]);

  const avatarEmotion = level === 'gentle' ? 'happy' : level === 'roll' ? 'excited' : 'celebrating';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition"
        aria-label="Close celebration"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-col items-center gap-5 w-full max-w-sm">
        {/* Week Hero badge */}
        <AnimatePresence>
          {showBadge && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 px-6 py-2 font-extrabold text-white text-lg shadow-lg"
            >
              🏆 Week Hero!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Zoodo avatar */}
        <ZoodoAvatar size={120} emotion={avatarEmotion} isSpeaking />

        {/* Personalised message */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-2xl font-extrabold text-white drop-shadow-lg"
        >
          {level === 'hero'
            ? `🌟 You're a Week Hero, ${kidName || 'superstar'}!`
            : level === 'roll'
            ? `🔥 You're on a roll, ${kidName || 'superstar'}!`
            : `⭐ You did it, ${kidName || 'superstar'}!`}
        </motion.p>

        {/* Parent videos */}
        {videos.length > 0 && videoIdx < videos.length && (
          <ParentVideoPlayback
            videoUrl={videos[videoIdx]}
            kidName={kidName}
            onEnded={() => {
              if (videoIdx + 1 < videos.length) {
                setVideoIdx((i) => i + 1);
              } else {
                schedule(() => onClose(), 1500);
              }
            }}
          />
        )}

        {videos.length === 0 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            type="button"
            onClick={onClose}
            className="mt-4 rounded-full bg-white px-8 py-3 font-bold text-[#D96969] shadow-lg active:scale-95 transition"
          >
            Continue →
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
