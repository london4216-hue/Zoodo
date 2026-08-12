import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playPop } from '@/lib/sensoryAudio';

// A full-width animated guide that cycles through simple stretch poses,
// leading the kid through a movement warm-up. Shown only on movement-based
// days (Outdoor / Exercises).
const STRETCHES = [
  { label: 'Reach up high!', cue: 'Stretch your arms to the sky' },
  { label: 'Touch your toes', cue: 'Bend down and reach for your feet' },
  { label: 'Side stretch', cue: 'Lean side to side' },
  { label: 'Big star jump', cue: 'Jump out wide like a star' },
];

export default function StretchGuide({ kidName }) {
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const stretch = STRETCHES[index];

  // Auto-advance through the stretches once started.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % STRETCHES.length);
    }, 3200);
    return () => clearTimeout(t);
  }, [index, active]);

  const start = () => {
    playPop();
    setActive(true);
    setIndex(0);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#E0F5D5] to-white p-3 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-bold text-black/80">
          {kidName ? `${kidName}, let’s stretch!` : 'Let’s stretch!'}
        </h2>
        <span className="text-xs font-bold text-black/40">
          {active ? `${index + 1} / ${STRETCHES.length}` : 'Warm-up'}
        </span>
      </div>

      {/* Animated character stage */}
      <div className="relative flex h-44 items-end justify-center overflow-hidden rounded-2xl bg-white">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center"
          >
            <StretchCharacter pose={index} active={active} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Cue text */}
      <div className="mt-2 text-center">
        <p className="text-lg font-bold text-[#E0A800]">{stretch.label}</p>
        <p className="text-xs font-semibold text-black/50">{stretch.cue}</p>
      </div>

      {!active ? (
        <button
          onClick={start}
          className="mt-2 w-full rounded-2xl bg-[#4FAE5A] py-3 text-lg font-bold text-white active:scale-95 transition"
        >
          Start stretching
        </button>
      ) : (
        <button
          onClick={() => setActive(false)}
          className="mt-2 w-full rounded-2xl border-2 border-black/10 bg-white py-2.5 font-bold text-black/60 active:scale-95 transition"
        >
          Pause
        </button>
      )}
    </div>
  );
}

// A simple SVG character that morphs between stretch poses.
function StretchCharacter({ pose, active }) {
  // Arm angles per pose (left, right) in degrees from vertical.
  const poses = [
    { lArm: 180, rArm: 180, bodyY: 0, label: 'up' },     // reach up
    { lArm: 250, rArm: 70, bodyY: 18, label: 'down' },   // touch toes (bend)
    { lArm: 150, rArm: 210, bodyY: 0, label: 'side' },   // side lean
    { lArm: 220, rArm: 140, bodyY: -4, label: 'star' },  // star jump
  ];
  const p = poses[pose] || poses[0];

  return (
    <motion.svg
      viewBox="0 0 160 180"
      className="h-40 w-40"
      animate={active ? { y: [0, -3, 0] } : {}}
      transition={active ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      {/* ground shadow */}
      <ellipse cx="80" cy="172" rx="34" ry="6" fill="#00000022" />
      {/* legs */}
      <motion.rect
        x="68" y="120" width="10" height="44" rx="5" fill="#5B3FD6"
        animate={active && p.label === 'star' ? { x: 56 } : { x: 68 }}
        transition={{ duration: 0.4 }}
      />
      <motion.rect
        x="82" y="120" width="10" height="44" rx="5" fill="#5B3FD6"
        animate={active && p.label === 'star' ? { x: 94 } : { x: 82 }}
        transition={{ duration: 0.4 }}
      />
      {/* body */}
      <motion.rect
        x="62" y="74" width="36" height="50" rx="16" fill="#7B4FE0"
        animate={{ y: 74 + (p.bodyY || 0) }}
        transition={{ duration: 0.4 }}
      />
      {/* head */}
      <motion.circle
        cx="80" cy="56" r="20" fill="#9B7FED"
        animate={{ cy: 56 + (p.bodyY || 0) }}
        transition={{ duration: 0.4 }}
      />
      {/* eyes */}
      <motion.circle cx="73" cy="54" r="3" fill="#2a1a2a"
        animate={{ cy: 54 + (p.bodyY || 0) }} transition={{ duration: 0.4 }} />
      <motion.circle cx="87" cy="54" r="3" fill="#2a1a2a"
        animate={{ cy: 54 + (p.bodyY || 0) }} transition={{ duration: 0.4 }} />
      {/* smile */}
      <motion.path
        d="M73 62 Q80 68 87 62" stroke="#2a1a2a" strokeWidth="2.5" fill="none" strokeLinecap="round"
        animate={{ cy: undefined }}
        style={{ transform: `translateY(${p.bodyY || 0}px)` }}
      />
      {/* arms — rotated around shoulder */}
      <motion.g
        style={{ transformOrigin: '70px 86px' }}
        animate={{ rotate: active ? p.lArm : 200 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <rect x="66" y="60" width="8" height="30" rx="4" fill="#5B3FD6" />
        <circle cx="70" cy="58" r="6" fill="#FFD9E6" />
      </motion.g>
      <motion.g
        style={{ transformOrigin: '90px 86px' }}
        animate={{ rotate: active ? p.rArm : 160 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <rect x="86" y="60" width="8" height="30" rx="4" fill="#5B3FD6" />
        <circle cx="90" cy="58" r="6" fill="#FFD9E6" />
      </motion.g>
    </motion.svg>
  );
}