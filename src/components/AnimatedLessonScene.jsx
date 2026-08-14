import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Custom animated lesson scenes per topic — real motion (bouncing, floating,
// breathing, dancing), not static photos with a fade. Each strand gets its own
// treatment, driven by the same `content` the narration was generated from.

const WORD_EMOJI = {
  apple: '🍎', ball: '⚽', cat: '🐱', dog: '🐶', banana: '🍌', grape: '🍇',
  fish: '🐟', sun: '☀️', moon: '🌙', star: '⭐', hand: '✋', hands: '👏',
  drum: '🥁', bell: '🔔', hat: '🎩', pig: '🐷', duck: '🦆', bus: '🚌',
  bed: '🛏️', box: '📦', book: '📖', car: '🚗', cup: '☕', egg: '🥚',
  leaf: '🍃', tree: '🌳', bird: '🐦', milk: '🥛', rice: '🍚', bread: '🍞',
  cookie: '🍪', cake: '🎂', bowl: '🥣', block: '🧱', blocks: '🧱', boat: '⛵',
  sock: '🧦', shoe: '👟', key: '🔑', kite: '🪁', lion: '🦁', monkey: '🐒',
  rabbit: '🐇', snake: '🐍', turtle: '🐢', umbrella: '☂️', fox: '🦊',
  heart: '❤️', king: '👑', owl: '🦉', queen: '👸', ring: '💍', violin: '🎻',
  zebra: '🦓', bear: '🐻', frog: '🐸', penguin: '🐧', train: '🚂', plane: '✈️',
};
function emojiFor(word, fallback) {
  if (!word) return fallback;
  const w = word.toLowerCase();
  return WORD_EMOJI[w] || WORD_EMOJI[w.replace(/s$/, '')] || fallback;
}
const STRAND_EMOJI = { numeracy: '🔢', literacy: '🔤', language: '🗣️', music: '🎵', movement: '🤸', sensory: '🧩' };

export default function AnimatedLessonScene({ strand, content, step }) {
  const counting = content?.counting_cards && content.counting_cards.length >= 2 ? content.counting_cards : null;
  // Reveal order matches the narration order (letter → sound → word →
  // bombardment) so what the child hears and what they see stay in sync.
  const revealCards = [
    ...(content?.letter ? [{ kind: 'letter' }] : []),
    ...(content?.sound ? [{ kind: 'sound' }] : []),
    ...(content?.word ? [{ kind: 'word' }] : []),
    ...(content?.bombardment_words?.length ? [{ kind: 'bombardment' }] : []),
  ];

  // NUMERACY — objects pop in one-by-one and bounce, with a big number.
  if (strand === 'numeracy' && counting) {
    const card = counting[Math.min(step, counting.length - 1)];
    const n = card?.n || 1;
    const emoji = emojiFor(card?.word, '🍎');
    return (
      <div className="flex w-full flex-col items-center">
        <motion.div
          key={n}
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 12 }}
          className="text-7xl font-bold text-studio-coral"
        >
          {n}
        </motion.div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {Array.from({ length: n }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, y: -20 }}
              animate={{ scale: 1, y: [0, -10, 0] }}
              transition={{
                scale: { type: 'spring', stiffness: 200, damping: 10, delay: i * 0.12 },
                y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 },
              }}
              className="text-4xl"
            >
              {emoji}
            </motion.span>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-2 text-lg font-bold text-studio-ink"
        >
          {card?.word}
        </motion.div>
      </div>
    );
  }

  // LITERACY / LANGUAGE — animated reveal of letter, picture, word, sound, bombardment.
  if (strand === 'literacy' || strand === 'language') {
    const kind = revealCards[step]?.kind || 'letter';
    return (
      <div className="flex w-full flex-col items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={kind + step}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            className="flex w-full flex-col items-center"
          >
            {kind === 'letter' && (
              <motion.div
                animate={{ rotate: [-4, 4, -4], scale: [1, 1.06, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white text-7xl font-bold text-studio-coral shadow-lg"
              >
                {content.letter}
              </motion.div>
            )}
            {kind === 'word' && (
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{ rotate: [-8, 8, -8], y: [0, -8, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-7xl"
                >
                  {emojiFor(content.word, '⭐')}
                </motion.div>
                <div className="flex gap-1">
                  {(content.word || '').split('').map((ch, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: [0, -6, 0] }}
                      transition={{
                        opacity: { delay: i * 0.08 },
                        y: { duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 },
                      }}
                      className="text-4xl font-bold text-studio-ink"
                    >
                      {ch}
                    </motion.span>
                  ))}
                </div>
              </div>
            )}
            {kind === 'sound' && (
              <div className="relative flex h-28 w-28 items-center justify-center">
                {[0, 1, 2].map((r) => (
                  <motion.span
                    key={r}
                    className="absolute rounded-full border-4 border-studio-coral/40"
                    initial={{ width: 40, height: 40, opacity: 0.6 }}
                    animate={{ width: 120, height: 120, opacity: 0 }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: r * 0.5 }}
                  />
                ))}
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative text-5xl font-bold text-studio-coral"
                >
                  “{content.sound}”
                </motion.div>
              </div>
            )}
            {kind === 'bombardment' && (
              <div className="flex flex-wrap justify-center gap-2">
                {content.bombardment_words.map((w, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: [0, -8, 0] }}
                    transition={{
                      opacity: { delay: i * 0.1 },
                      y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 },
                    }}
                    className="rounded-full bg-white px-3 py-1.5 text-base font-bold text-studio-coral shadow"
                  >
                    {w}
                  </motion.span>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // MUSIC — dancing notes floating up + clapping hands on a beat.
  if (strand === 'music') {
    const notes = ['♪', '♫', '♬', '♩'];
    return (
      <div className="flex w-full flex-col items-center">
        <div className="relative h-28 w-full">
          {notes.map((n, i) => (
            <motion.span
              key={i}
              className="absolute text-5xl text-studio-coral"
              style={{ left: `${15 + i * 20}%` }}
              initial={{ y: 70, opacity: 0 }}
              animate={{ y: [-10, -60, -10], opacity: [0, 1, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
            >
              {n}
            </motion.span>
          ))}
        </div>
        <motion.div
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          className="text-6xl"
        >
          👏
        </motion.div>
        {content?.word && <div className="mt-2 text-lg font-bold text-studio-ink">{content.word}</div>}
      </div>
    );
  }

  // MOVEMENT — a figure bouncing/rotating through the gesture.
  if (strand === 'movement') {
    const target = content?.assessment?.target || content?.word || 'move';
    return (
      <div className="flex w-full flex-col items-center">
        <motion.div
          animate={{ y: [0, -16, 0], rotate: [-6, 6, -6] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl"
        >
          🤸
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="mt-3 rounded-2xl bg-white px-4 py-2 text-lg font-bold text-studio-ink shadow"
        >
          {target}
        </motion.div>
      </div>
    );
  }

  // SENSORY — colored shapes drifting and sorting into bins.
  if (strand === 'sensory') {
    const shapes = ['🔴', '🟡', '🔵', '🟢', '🟠'];
    return (
      <div className="flex w-full flex-col items-center">
        <div className="relative h-28 w-full">
          {shapes.map((s, i) => (
            <motion.span
              key={i}
              className="absolute text-4xl"
              style={{ left: `${10 + i * 18}%`, top: `${(i % 2) * 40}%` }}
              animate={{ y: [0, -12, 0], x: [0, 8, 0], rotate: [0, 12, 0] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
            >
              {s}
            </motion.span>
          ))}
        </div>
        <div className="mt-2 flex gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-red-300 bg-red-50 text-2xl">🟥</div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-blue-300 bg-blue-50 text-2xl">🟦</div>
        </div>
        {content?.word && <div className="mt-2 text-lg font-bold text-studio-ink">{content.word}</div>}
      </div>
    );
  }

  // Fallback — a gently pulsing strand mascot.
  return (
    <div className="flex w-full flex-col items-center">
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="text-6xl"
      >
        {STRAND_EMOJI[strand] || '✨'}
      </motion.div>
    </div>
  );
}