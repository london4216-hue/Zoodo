import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { X, RotateCw, Check, Volume2 } from 'lucide-react';
import { playSparkle, playSuccess, playComplete, vibrate } from '@/lib/sensoryAudio';
import SparkleBurst from '@/components/SparkleBurst';

const GESTURE = {
  clap: { emoji: '👏' },
  wave: { emoji: '👋' },
  point: { emoji: '👉' },
  count: { emoji: '✋' },
};

const BG = {
  sparkles: 'from-[#FFE8F3] to-[#FFD9E6]',
  music: 'from-[#EDE6FF] to-[#D9CCFF]',
  hand: 'from-[#FFF6E6] to-[#FFE3B0]',
  count: 'from-[#E6F4FF] to-[#BFE0FF]',
  color: 'from-[#E6FFE6] to-[#BFF0BF]',
  shape: 'from-[#FFF0E6] to-[#FFD0B0]',
};

const TAPS_TO_SUCCESS = 3;
const CONFETTI_COLORS = ['#FF9EC4', '#4969E1', '#FFE08A', '#4FAE5A', '#7B4FE0'];

// Full-screen sensory activity: warm voice narration, animated gesture character,
// cycling movement prompts, a glowing tap target with sparkle bursts, a success
// moment with color burst, and a confetti completion.
export default function ActivityPlayMode({ activity, kidName, onComplete, onClose }) {
  const [promptIdx, setPromptIdx] = useState(0);
  const [taps, setTaps] = useState(0);
  const [bursts, setBursts] = useState([]);
  const [succeeded, setSucceeded] = useState(false);
  const audioRef = useRef(null);

  const g = GESTURE[activity.gesture] || GESTURE.clap;
  const prompts = activity.movement_prompts?.length
    ? activity.movement_prompts
    : ['Tap the glowing button!'];

  useEffect(() => {
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % prompts.length), 3500);
    return () => clearInterval(t);
  }, [prompts.length]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.play().catch(() => {});
  }, []);

  const handleTap = (e) => {
    if (succeeded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((it) => it.id !== id)), 700);
    playSparkle();
    vibrate(25);
    const next = taps + 1;
    setTaps(next);
    if (next >= TAPS_TO_SUCCESS) {
      setSucceeded(true);
      playSuccess();
      vibrate(40);
      setTimeout(
        () => confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 }, colors: CONFETTI_COLORS }),
        200,
      );
    }
  };

  const handleComplete = () => {
    playComplete();
    vibrate([40, 40, 80]);
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 }, colors: CONFETTI_COLORS });
    onComplete?.();
  };

  const replayVoice = () => {
    const el = audioRef.current;
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-gradient-to-b ${BG[activity.icon] || BG.sparkles}`}>
      <div className="flex items-center justify-between p-4">
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-black/60 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold text-black/70">{activity.title}</h2>
        <button
          onClick={replayVoice}
          aria-label="Replay voice"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-black/60 active:scale-95"
        >
          <RotateCw className="h-5 w-5" />
        </button>
      </div>

      {/* Caregiver instruction — what the kid needs to do */}
      <div className="px-4">
        <div className="rounded-2xl bg-white/80 px-3 py-2 text-left shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#D96969]">
            For the caregiver
          </p>
          <p className="text-xs font-semibold text-black/60">
            Help {kidName} tap the glowing button {TAPS_TO_SUCCESS} times along with the voice. When the stars fill up, tap "Mark complete".
          </p>
        </div>
      </div>

      {/* Animated gesture character */}
      <div className="flex justify-center mt-2">
        <motion.div
          animate={
            activity.gesture === 'wave'
              ? { rotate: [0, 20, -10, 20, 0] }
              : { scale: [1, 1.15, 1] }
          }
          transition={{ duration: activity.gesture === 'wave' ? 1.2 : 0.8, repeat: Infinity }}
          className="text-[7rem] leading-none drop-shadow-sm"
        >
          {g.emoji}
        </motion.div>
      </div>

      {/* Cycling movement prompt */}
      <div className="px-6 mt-2 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={promptIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-2xl font-bold text-black/75"
          >
            {prompts[promptIdx]}
          </motion.p>
        </AnimatePresence>
        <p className="mt-1 text-sm font-semibold text-black/40">Your turn, {kidName}!</p>
      </div>

      {/* Glowing tap target */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center">
          <motion.button
            onClick={handleTap}
            disabled={succeeded}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="relative h-44 w-44 rounded-full bg-white shadow-[0_0_40px_rgba(255,180,200,0.85)] flex items-center justify-center active:scale-95 disabled:opacity-90"
          >
            <span className="text-2xl font-bold text-[#D96969]">
              {succeeded ? 'Great job!' : 'Tap here!'}
            </span>
            {bursts.map((b) => (
              <div key={b.id} className="absolute" style={{ left: b.x, top: b.y }}>
                <SparkleBurst />
              </div>
            ))}
          </motion.button>
          <div className="mt-4 flex gap-2">
            {Array.from({ length: TAPS_TO_SUCCESS }).map((_, i) => (
              <span key={i} className={`text-2xl ${i < taps ? 'opacity-100' : 'opacity-25'}`}>
                ⭐
              </span>
            ))}
          </div>
        </div>
      </div>

      {activity.audio_url && <audio ref={audioRef} src={activity.audio_url} className="hidden" />}

      <div className="p-5">
        {succeeded ? (
          <button
            onClick={handleComplete}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4FAE5A] py-4 text-lg font-bold text-white active:scale-95"
          >
            <Check className="h-5 w-5" strokeWidth={3} /> Mark complete
          </button>
        ) : (
          <button
            onClick={replayVoice}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/80 py-4 text-lg font-bold text-black/70 active:scale-95"
          >
            <Volume2 className="h-5 w-5" /> Play voice again
          </button>
        )}
      </div>
    </div>
  );
}