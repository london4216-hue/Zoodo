import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Pre-activity briefing modal with personalized voice + avatar animation
// Explains what's about to happen, gets the child ready, then launches
export default function ActivityBrief({ kidName, subject, strand, activity, onBriefComplete, onClose }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [autoPlayStarted, setAutoPlayStarted] = useState(false);
  const audioRef = useRef(null);

  // Generate the brief explanation narration
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const briefText = getBriefText(kidName, subject, strand, activity);
        const res = await base44.functions.invoke('generateSpeech', {
          text: briefText,
          style: 'warm_encouraging',
          kidName,
        });
        if (!cancelled && res?.data?.audio_url) {
          setAudioUrl(res.data.audio_url);
        }
      } catch (e) {
        console.error('Failed to generate brief audio:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kidName, subject, strand, activity]);

  // Auto-play audio once loaded
  useEffect(() => {
    if (audioUrl && audioRef.current && !autoPlayStarted) {
      setAutoPlayStarted(true);
      audioRef.current.play().catch(() => {});
    }
  }, [audioUrl, autoPlayStarted]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-2xl rounded-3xl bg-gradient-to-br from-white to-blue-50 shadow-2xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-black/60 hover:bg-white active:scale-95 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center justify-center px-6 py-8 sm:px-8 sm:py-10">
            {/* Zoodo avatar */}
            <motion.div
              className="mb-6 flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-[#FF9EC4] to-[#FFB8D4] shadow-lg"
              animate={{ y: isPlaying ? [0, -8, 0] : 0 }}
              transition={{ duration: 0.6, repeat: isPlaying ? Infinity : 0 }}
            >
              <ZoodoFaceAvatar />
            </motion.div>

            {/* Activity title */}
            <h2 className="text-center text-2xl font-bold text-black/80 sm:text-3xl">
              Ready for {subject}, {kidName}?
            </h2>

            {/* Brief description */}
            <p className="mt-3 text-center text-sm font-semibold text-black/60 sm:text-base">
              {getActivityDescription(activity)}
            </p>

            {/* Audio controls */}
            <div className="mt-6 flex flex-col items-center gap-4">
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#D96969] animate-pulse" />
                  <span className="text-sm font-semibold text-black/50">Getting ready...</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={togglePlay}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D96969] shadow-lg text-white active:scale-95 transition"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6" />
                    ) : (
                      <Play className="h-6 w-6 ml-0.5" />
                    )}
                  </button>
                  <span className="text-xs font-semibold text-black/50">
                    {isPlaying ? 'Listening...' : 'Tap to listen'}
                  </span>
                </>
              )}
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>

            {/* Action button */}
            <motion.button
              onClick={onBriefComplete}
              className="mt-8 w-full rounded-2xl bg-gradient-to-r from-[#4969E1] to-[#3b54c9] py-4 font-bold text-white shadow-lg active:scale-95 transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Let's Go, {kidName}!
            </motion.button>

            {/* Encouragement text */}
            <p className="mt-4 text-center text-xs font-semibold text-black/40">
              You're going to do great! 🌟
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Animated Zoodo face avatar
function ZoodoFaceAvatar() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full">
      <defs>
        <radialGradient id="zoodoGrad" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#FFD9E6" />
          <stop offset="100%" stopColor="#FF9EC4" />
        </radialGradient>
      </defs>
      {/* Head */}
      <circle cx="60" cy="62" r="50" fill="url(#zoodoGrad)" stroke="#E07A9F" strokeWidth="3" />
      {/* Cheeks */}
      <circle cx="32" cy="72" r="8" fill="#FF8FA8" opacity="0.7" />
      <circle cx="88" cy="72" r="8" fill="#FF8FA8" opacity="0.7" />
      {/* Eyes */}
      <circle cx="44" cy="56" r="6" fill="#3a2a3a" />
      <circle cx="76" cy="56" r="6" fill="#3a2a3a" />
      {/* Eye highlights */}
      <circle cx="46" cy="54" r="2" fill="#fff" />
      <circle cx="78" cy="54" r="2" fill="#fff" />
      {/* Smile */}
      <path d="M44 74 Q60 88 76 74" stroke="#3a2a3a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* Horn */}
      <path d="M60 12 Q60 22 60 26" stroke="#E07A9F" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="10" r="4" fill="#FFE08A" stroke="#E0A800" strokeWidth="2" />
    </svg>
  );
}

// Generate personalized brief text for the activity
function getBriefText(kidName, subject, strand, activity) {
  const descriptions = {
    letter: `${kidName}, we're going to learn a new letter today! It's so cool. Watch and listen carefully, and then you get to try it yourself. I know you're going to be amazing!`,
    number: `${kidName}, are you ready to count? We're going to have so much fun with numbers. You're so smart, ${kidName}!`,
    song: `${kidName}, let's make music together! This is going to be so fun. Listen to how we do it, and then you can try!`,
    movement: `${kidName}, time to get moving! We're going to stretch and move our bodies. Are you ready to show me how strong you are, ${kidName}?`,
    drawing: `${kidName}, you're going to create something beautiful! Use the colors however you want. I can't wait to see what you make!`,
    story: `${kidName}, let's tell a story together! Use your imagination and tell me what you're thinking. You're so creative, ${kidName}!`,
  };

  const key = activity?.type?.toLowerCase() || strand?.toLowerCase() || 'lesson';
  return descriptions[key] || descriptions.letter;
}

// Get activity description for display
function getActivityDescription(activity) {
  const descriptions = {
    letter: 'We\'ll learn a new letter, watch a video, and you\'ll show me how you can say it!',
    number: 'We\'ll count together, see how many there are, and you\'ll try counting too!',
    song: 'We\'ll hear a fun song, learn the tune, and you can sing along!',
    movement: 'We\'ll move our bodies together - stretching, jumping, and having fun!',
    drawing: 'You\'ll create your own masterpiece! Tap and draw whatever you imagine.',
    story: 'We\'ll make up a story together! Tell me what happens next.',
  };

  const key = activity?.type?.toLowerCase() || 'lesson';
  return descriptions[key] || 'Let\'s have some fun learning together!';
}
