import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';
import { Loader2, X } from 'lucide-react';
import { stopAll, playAudio } from '@/lib/lessonAudioController';

// Full-screen parent celebration. The parent's pre-recorded video plays
// automatically WITH SOUND (audio was unlocked by the day-card click and the
// lesson interactions) alongside confetti — no tap, no muted fallback. This is
// the ONLY track: the controller stops the lesson narration before the video
// starts, and the generated cheer is only used when there is no parent video
// (never both at once).
export default function CelebrationOverlay({ kidName, subject, parentVideos, cheerText, onAllDone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);
  const [videoIdx, setVideoIdx] = useState(0);
  const [videosDone, setVideosDone] = useState(false);
  const videos = (parentVideos || []).filter(Boolean);
  const colors = ['#FF9EC4', '#4969E1', '#FFE08A', '#4FAE5A', '#FFD9E6', '#7B4FE0'];

  const fireworksAroundVideo = () => {
    const el = videoRef.current;
    let cx = 0.5, cy = 0.5;
    if (el) {
      const r = el.getBoundingClientRect();
      cx = (r.left + r.width / 2) / window.innerWidth;
      cy = (r.top + r.height / 2) / window.innerHeight;
    }
    confetti({ particleCount: 80, spread: 100, startVelocity: 35, origin: { x: cx, y: cy }, colors });
    setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 70, origin: { x: Math.max(0.05, cx - 0.12), y: cy }, colors }), 120);
    setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 70, origin: { x: Math.min(0.95, cx + 0.12), y: cy }, colors }), 240);
  };

  useEffect(() => {
    // The parent video / cheer is now the ONLY track. Stop any narration first.
    stopAll();
    let cancelled = false;
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 }, colors });

    if (videos.length > 0) {
      // Parent video is the single audio track — no generated cheer alongside it.
      setVideoIdx(0);
      setVideosDone(false);
      requestAnimationFrame(() => {
        const v = videoRef.current;
        if (!v) return;
        // Autoplay WITH SOUND — audio context was unlocked by the day-card click
        // and the lesson interactions. Retry once if the browser is warming up;
        // never mute as a workaround.
        v.play().catch(() => setTimeout(() => v.play().catch(() => {}), 400));
      });
    } else {
      // No parent video — the generated cheer is the single track.
      (async () => {
        try {
          const res = await base44.functions.invoke('generateCelebration', { kidName, subject });
          if (cancelled) return;
          setData(res?.data || null);
          setLoading(false);
          if (res?.data?.audio_url) {
            playAudio(res.data.audio_url, { kind: 'cheer', onEnded: () => { if (!cancelled) setVideosDone(true); } });
          } else {
            setVideosDone(true);
          }
        } catch (e) {
          if (cancelled) return;
          setLoading(false);
          setVideosDone(true);
        }
      })();
    }
    return () => { cancelled = true; stopAll(); };
  }, []);

  // Advance to the next parent video.
  useEffect(() => {
    if (videoIdx === 0) return;
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      v.play().catch(() => setTimeout(() => v.play().catch(() => {}), 400));
    });
  }, [videoIdx]);

  // When the celebration is done, return home after a short beat.
  useEffect(() => {
    if (!videosDone) return;
    const t = setTimeout(() => onAllDone?.(), 1400);
    return () => clearTimeout(t);
  }, [videosDone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm p-4">
      <button
        onClick={() => onAllDone?.()}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white/80 hover:text-white active:scale-95 transition"
      >
        <X className="h-5 w-5" />
      </button>

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="flex w-full max-w-md flex-col items-center text-center"
      >
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, -4, 4, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
          className="text-4xl"
        >
          🎉
        </motion.div>

        {loading && videos.length === 0 ? (
          <div className="flex flex-col items-center py-4">
            <Loader2 className="h-7 w-7 animate-spin text-white/80 mb-2" />
            <p className="font-semibold text-white/70">Getting your cheer ready…</p>
          </div>
        ) : (
          <>
            <h2 className="text-4xl font-bold text-white leading-tight">You did it, {kidName}!</h2>
            <p className="mt-1 font-semibold text-white/70">Great job with {subject}, {kidName}!</p>

            {videos.length > 0 ? (
              <div className="mt-4 w-full">
                <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-3xl border-4 border-[#FF9EC4] bg-black shadow-2xl">
                  <video
                    ref={videoRef}
                    key={videoIdx}
                    src={videos[videoIdx]}
                    autoPlay
                    playsInline
                    controls={videosDone}
                    className="h-full w-full object-cover"
                    onPlay={fireworksAroundVideo}
                    onEnded={() => {
                      if (videoIdx < videos.length - 1) setVideoIdx((i) => i + 1);
                      else setVideosDone(true);
                    }}
                  />
                  {videos.length > 1 && (
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      {videos.map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 rounded-full transition-all ${
                            i === videoIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {cheerText && <p className="mt-3 text-lg font-bold text-white">“{cheerText}”</p>}
                {videosDone && (
                  <button
                    onClick={() => onAllDone?.()}
                    className="mt-3 w-full rounded-2xl bg-[#4969E1] py-3.5 text-lg font-bold text-white active:scale-95 transition hover:bg-[#3b54c9]"
                  >
                    Back to home 🏠
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-5 w-full">
                {cheerText && <p className="text-xl font-bold text-white">“{cheerText}”</p>}
                <button
                  onClick={() => onAllDone?.()}
                  className="mt-4 w-full rounded-2xl bg-[#4969E1] py-3.5 text-lg font-bold text-white active:scale-95 transition hover:bg-[#3b54c9]"
                >
                  Back to home 🏠
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}