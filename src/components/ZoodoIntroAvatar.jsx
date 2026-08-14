import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ZoodoAvatar2D from '@/components/ZoodoAvatar2D';
import { playZanyJingle, playSillyGiggle } from '@/lib/sensoryAudio';

// Onboarding intro avatar: the new elephant-unicorn Zoodo, with the same
// greeting speech bubble + voice playback the old creature had.
export default function ZoodoIntroAvatar({ greeting, audioUrl, size = 180, autoSpeak = true }) {
  const [speaking, setSpeaking] = useState(false);
  const spokenRef = useRef(false);
  const audioRef = useRef(null);

  const speak = () => {
    if (audioUrl && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => setSpeaking(true)).catch(() => setSpeaking(false));
      } catch (e) { /* ignore */ }
    }
  };

  useEffect(() => {
    if (autoSpeak && audioUrl && !spokenRef.current) {
      spokenRef.current = true;
      const t = setTimeout(() => speak(), 500);
      return () => clearTimeout(t);
    }
  }, [autoSpeak, audioUrl]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (e) { /* ignore */ }
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setSpeaking(true)}
          onPause={() => setSpeaking(false)}
          onEnded={() => {
            setSpeaking(false);
            playSillyGiggle();
            setTimeout(() => playZanyJingle(), 900);
          }}
          className="hidden"
        />
      )}

      {greeting && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.2 }}
          className="relative mb-3 max-w-[90%] rounded-3xl bg-white px-5 py-3 shadow-md text-center"
        >
          <p className="text-base font-bold text-black/80 leading-snug">{greeting}</p>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-4 w-4 bg-white rotate-45" />
        </motion.div>
      )}

      <motion.button
        type="button"
        onClick={() => speak()}
        aria-label="Zoodo — play greeting"
        initial={{ scale: 0, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.1 }}
        style={{ width: size, height: size }}
      >
        <ZoodoAvatar2D size={size} talking={speaking} bounce={!speaking} />
      </motion.button>
    </div>
  );
}