// Advanced 3D-inspired avatar system with micro-animations and personality
// Zoodo has depth, personality, and responds to emotional context

import React from 'react';
import { motion } from 'framer-motion';

export const ZoodoAvatar = ({ 
  size = 120, 
  emotion = 'happy', 
  isListening = false, 
  isSpeaking = false,
  className = ''
}) => {
  // Emotion-based eye and expression adjustments
  const emotions = {
    happy: { eyeY: 54, eyeSize: 6, mouthCurve: 'Q60 88 76 74', cheekOpacity: 0.8 },
    excited: { eyeY: 50, eyeSize: 7, mouthCurve: 'Q60 96 76 78', cheekOpacity: 1 },
    thinking: { eyeY: 54, eyeSize: 5.5, mouthCurve: 'M42 74 Q60 75 76 74', cheekOpacity: 0.4 },
    celebrating: { eyeY: 48, eyeSize: 8, mouthCurve: 'Q60 100 76 82', cheekOpacity: 1 },
    encouraging: { eyeY: 54, eyeSize: 6.5, mouthCurve: 'Q60 85 76 75', cheekOpacity: 0.7 },
  };

  const current = emotions[emotion] || emotions.happy;

  return (
    <motion.div
      style={{ width: size, height: size }}
      className={className}
      animate={
        isListening 
          ? { scale: [1, 1.02, 1] }
          : isSpeaking
          ? { y: [0, -6, 0] }
          : { y: 0, scale: 1 }
      }
      transition={{
        duration: isListening ? 1 : 0.4,
        repeat: isListening || isSpeaking ? Infinity : 0,
        ease: 'easeInOut'
      }}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full filter drop-shadow-lg">
        <defs>
          {/* Main body gradient with depth */}
          <radialGradient id="zoodoBody" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#FFE6F0" />
            <stop offset="50%" stopColor="#FFB8D1" />
            <stop offset="100%" stopColor="#FF9EC4" />
          </radialGradient>

          {/* Shine effect for depth */}
          <radialGradient id="zoodoShine" cx="35%" cy="25%" r="40%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          {/* Shadow for depth */}
          <filter id="zoodoShadow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.4" />
            </feComponentTransfer>
          </filter>

          {/* Horn gradient */}
          <linearGradient id="hornGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFE08A" />
            <stop offset="100%" stopColor="#E0A800" />
          </linearGradient>
        </defs>

        {/* Shadow underneath (depth) */}
        <ellipse cx="60" cy="108" rx="35" ry="6" fill="#000000" opacity="0.08" />

        {/* Main body circle - 3D effect */}
        <circle cx="60" cy="62" r="50" fill="url(#zoodoBody)" stroke="#E07A9F" strokeWidth="2.5" />

        {/* Shine overlay for glossy effect */}
        <circle cx="45" cy="40" r="22" fill="url(#zoodoShine)" />

        {/* Cheeks - responsive to emotion */}
        <motion.circle
          cx="28"
          cy="72"
          r="9"
          fill="#FF8FA8"
          opacity={current.cheekOpacity}
          animate={{ r: isListening ? [9, 10, 9] : 9 }}
          transition={{ duration: 0.6, repeat: isListening ? Infinity : 0 }}
        />
        <motion.circle
          cx="92"
          cy="72"
          r="9"
          fill="#FF8FA8"
          opacity={current.cheekOpacity}
          animate={{ r: isListening ? [9, 10, 9] : 9 }}
          transition={{ duration: 0.6, repeat: isListening ? Infinity : 0 }}
        />

        {/* Eyes - responsive to emotion and audio */}
        <g>
          {/* Left eye */}
          <circle cx="44" cy={current.eyeY} r={current.eyeSize} fill="#2d1f2d" />
          <motion.circle
            cx="44"
            cy={current.eyeY}
            r={current.eyeSize}
            fill="#FFFFFF"
            opacity="0.4"
            animate={isSpeaking ? { r: [current.eyeSize * 0.3, current.eyeSize * 0.5, current.eyeSize * 0.3] } : {}}
            transition={{ duration: 0.3, repeat: isSpeaking ? Infinity : 0 }}
          />

          {/* Right eye */}
          <circle cx="76" cy={current.eyeY} r={current.eyeSize} fill="#2d1f2d" />
          <motion.circle
            cx="76"
            cy={current.eyeY}
            r={current.eyeSize}
            fill="#FFFFFF"
            opacity="0.4"
            animate={isSpeaking ? { r: [current.eyeSize * 0.3, current.eyeSize * 0.5, current.eyeSize * 0.3] } : {}}
            transition={{ duration: 0.3, repeat: isSpeaking ? Infinity : 0 }}
          />
        </g>

        {/* Mouth - animates with emotion */}
        <path
          d={`M42 74 ${current.mouthCurve}`}
          stroke="#2d1f2d"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Horn - 3D cylinder effect */}
        <g>
          {/* Horn shadow/back */}
          <line x1="60" y1="18" x2="60" y2="28" stroke="#C9872C" strokeWidth="5" strokeLinecap="round" opacity="0.4" />
          {/* Horn main */}
          <line x1="60" y1="14" x2="60" y2="26" stroke="url(#hornGrad)" strokeWidth="4" strokeLinecap="round" />
          {/* Horn highlight */}
          <line x1="61.5" y1="14" x2="61.5" y2="24" stroke="#FFFACD" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
        </g>

        {/* Horn ball - glossy sphere */}
        <circle cx="60" cy="10" r="5" fill="url(#hornGrad)" stroke="#B8860B" strokeWidth="1" />
        <circle cx="57" cy="8" r="1.5" fill="#FFFACD" opacity="0.8" />

        {/* Breathing animation element (invisible, for animation reference) */}
        <motion.circle
          cx="60"
          cy="62"
          r="50"
          fill="none"
          stroke="rgba(255, 158, 196, 0)"
          strokeWidth="0"
          animate={{ r: [50, 50.5, 50] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </svg>
    </motion.div>
  );
};

// Avatar with expression changes
export function ZoodoExpressionAvatar({ expression = 'happy', size = 96 }) {
  const expressionMap = {
    listening: { emotion: 'thinking', isListening: true },
    speaking: { emotion: 'excited', isSpeaking: true },
    celebrating: { emotion: 'celebrating', isSpeaking: false },
    encouraging: { emotion: 'encouraging', isSpeaking: false },
    happy: { emotion: 'happy', isSpeaking: false },
  };

  const props = expressionMap[expression] || expressionMap.happy;
  return <ZoodoAvatar size={size} {...props} />;
}
