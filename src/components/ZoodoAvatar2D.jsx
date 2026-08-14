import React from 'react';
import { motion } from 'framer-motion';

// 2D animated Zoodo — an elephant-unicorn hybrid mascot (elephant ears + trunk,
// unicorn horn + mane, big expressive eyes, soft pastel body).
// States: idle (breathe + blink), talking (ear flap + mouth + gentle bounce),
// celebrating (big bounce + ear flap + horn sparkle + happy eyes).
export default function ZoodoAvatar2D({ size = 96, talking = false, bounce = false, className = '' }) {
  const celebrating = bounce;
  const talkingState = talking && !celebrating;

  // Whole-body motion
  const bodyAnim = celebrating
    ? { y: [0, -10, 0], rotate: [0, -4, 3, 0] }
    : talkingState
    ? { y: [0, -3, 0] }
    : { y: [0, -2, 0], scale: [1, 1.03, 1] };
  const bodyTrans = celebrating
    ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
    : talkingState
    ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' };

  // Ears flap
  const earAnimL = celebrating ? { rotate: [0, -14, 0] } : talkingState ? { rotate: [0, -9, 0] } : { rotate: [0, -3, 0] };
  const earAnimR = celebrating ? { rotate: [0, 14, 0] } : talkingState ? { rotate: [0, 9, 0] } : { rotate: [0, 3, 0] };
  const earTrans = celebrating
    ? { duration: 0.28, repeat: Infinity, ease: 'easeInOut' }
    : talkingState
    ? { duration: 0.4, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' };

  // Mouth opens while talking
  const mouthAnim = talkingState ? { scaleY: [1, 1.9, 1] } : {};
  const mouthTrans = { duration: 0.26, repeat: Infinity, ease: 'easeInOut' };

  // Horn sparkles on excitement
  const sparkleAnim = celebrating ? { opacity: [0, 1, 0], scale: [0.3, 1.3, 0.3] } : { opacity: 0 };
  const sparkleTrans = { duration: 1.1, repeat: Infinity, ease: 'easeInOut' };

  // Eyes blink on idle
  const blinkAnim = talkingState || celebrating ? {} : { scaleY: [1, 0.12, 1] };
  const blinkTrans = { duration: 0.16, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' };

  return (
    <motion.div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      animate={bodyAnim}
      transition={bodyTrans}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="zoodoBody" cx="50%" cy="38%" r="72%">
            <stop offset="0%" stopColor="#E7DBFB" />
            <stop offset="100%" stopColor="#C3A8F2" />
          </radialGradient>
          <linearGradient id="zoodoHorn" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#F2D06B" />
            <stop offset="100%" stopColor="#FFF0B8" />
          </linearGradient>
        </defs>

        {/* Ears (behind head) */}
        <motion.g style={{ transformBox: 'fill-box', transformOrigin: '72% 12%' }} animate={earAnimL} transition={earTrans}>
          <path d="M40 50 C18 40 10 54 14 70 C18 86 38 84 42 72 C44 64 44 56 40 50 Z" fill="#B89EE8" stroke="#9A7DD8" strokeWidth="2" />
          <path d="M33 58 C23 54 19 62 23 72 C27 80 38 76 38 70 Z" fill="#F7C8D8" />
        </motion.g>
        <motion.g style={{ transformBox: 'fill-box', transformOrigin: '28% 12%' }} animate={earAnimR} transition={earTrans}>
          <path d="M80 50 C102 40 110 54 106 70 C102 86 82 84 78 72 C76 64 76 56 80 50 Z" fill="#B89EE8" stroke="#9A7DD8" strokeWidth="2" />
          <path d="M87 58 C97 54 101 62 97 72 C93 80 82 76 82 70 Z" fill="#F7C8D8" />
        </motion.g>

        {/* Body */}
        <ellipse cx="60" cy="96" rx="30" ry="17" fill="url(#zoodoBody)" stroke="#9A7DD8" strokeWidth="2.5" />

        {/* Head */}
        <circle cx="60" cy="58" r="34" fill="url(#zoodoBody)" stroke="#9A7DD8" strokeWidth="2.5" />

        {/* Mane tufts around the horn */}
        <path d="M44 30 Q47 18 53 25 Q55 15 61 23 Q60 13 66 21 Q72 15 74 27 Q80 21 78 31 Z" fill="#F7C8D8" stroke="#E89BB4" strokeWidth="1.5" />
        <circle cx="48" cy="30" r="4" fill="#B6D8F4" />
        <circle cx="72" cy="30" r="4" fill="#B6D8F4" />

        {/* Horn */}
        <motion.g style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }} animate={celebrating ? { rotate: [0, -6, 6, 0] } : {}} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}>
          <path d="M54 28 L60 6 L66 28 Z" fill="url(#zoodoHorn)" stroke="#E8B14A" strokeWidth="1.5" />
          <path d="M57 24 L63 24 M58 19 L62 19 M59 14 L61 14" stroke="#E8B14A" strokeWidth="1.4" strokeLinecap="round" />
          <motion.g animate={sparkleAnim} transition={sparkleTrans} style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
            <path d="M71 11 l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4 z" fill="#FFF0B8" />
          </motion.g>
          <motion.g animate={sparkleAnim} transition={{ ...sparkleTrans, delay: 0.45 }} style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
            <path d="M47 15 l1.1 2.8 2.8 1.1 -2.8 1.1 -1.1 2.8 -1.1 -2.8 -2.8 -1.1 2.8 -1.1 z" fill="#FFF7D0" />
          </motion.g>
        </motion.g>

        {/* Trunk */}
        <path d="M56 68 Q48 82 53 96 Q57 106 50 110 Q45 108 49 100 Q53 90 60 72 Z" fill="url(#zoodoBody)" stroke="#9A7DD8" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M54 92 Q57 96 53 98" stroke="#9A7DD8" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Cheeks */}
        <circle cx="40" cy="66" r="6" fill="#F8A8C0" opacity="0.7" />
        <circle cx="80" cy="66" r="6" fill="#F8A8C0" opacity="0.7" />

        {/* Eyes */}
        {celebrating ? (
          <g stroke="#3A2A4A" strokeWidth="3.5" fill="none" strokeLinecap="round">
            <path d="M42 58 Q48 51 54 58" />
            <path d="M66 58 Q72 51 78 58" />
          </g>
        ) : (
          <motion.g style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }} animate={blinkAnim} transition={blinkTrans}>
            <ellipse cx="48" cy="58" rx="7" ry="9" fill="#FFFFFF" stroke="#3A2A4A" strokeWidth="1.5" />
            <ellipse cx="72" cy="58" rx="7" ry="9" fill="#FFFFFF" stroke="#3A2A4A" strokeWidth="1.5" />
            <circle cx="49" cy="60" r="4" fill="#3A2A4A" />
            <circle cx="73" cy="60" r="4" fill="#3A2A4A" />
            <circle cx="51" cy="58" r="1.5" fill="#FFFFFF" />
            <circle cx="75" cy="58" r="1.5" fill="#FFFFFF" />
          </motion.g>
        )}

        {/* Mouth */}
        {celebrating ? (
          <path d="M52 74 Q60 84 68 74" stroke="#7A4A6A" strokeWidth="3" fill="#F7C8D8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <motion.ellipse
            cx="60"
            cy="74"
            rx="5"
            ry={talkingState ? 4 : 3}
            fill="#7A4A6A"
            style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
            animate={mouthAnim}
            transition={mouthTrans}
          />
        )}
      </svg>
    </motion.div>
  );
}