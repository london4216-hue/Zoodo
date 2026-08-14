import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';
import { Loader2, X } from 'lucide-react';
import { duckMusic, unDuckMusic } from '@/lib/sensoryAudio';

// Full-screen parent celebration: the pre-recorded intake parent video plays
// with confetti around the frame, then auto-completes the lesson and returns
// to the dashboard. Reuses the existing intake parent video capture — no
// parallel capture flow.
export default function CelebrationOverlay({ kidName, subject, parentVideos, cheerText, onAllDone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [videoIdx, setVideoIdx] = useState(0);
  const [videosDone, setVideosDone] = useState(false);
  const videos = Array.isArray(parentVideos) ? parentVideos.filter(Boolean) : [];
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
    let cancelled = false;
    const burst = () => {
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 }, colors });
      setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }), 180);
      setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }), 360);
    };
    burst();

    if (videos.length > 0) {
      setVideoIdx(0);
      setVideosDone(false);
      requestAnimationFrame(() => {
        videoRef.current?.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      });
    }

    (async () => {
      try {
        const res = await base44.functions.invoke('generateCelebration', { kidName, subject });
        if (cancelled) return;
        setData(res?.data || null);
        setLoading(false);
        setTimeout(() => audioRef.current?.play().catch(() => {}), 250);
        setTimeout(burst, 1100);
      } catch (e) {
        if (cancelled) return;
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kidName, subject]);

  useEffect(() => {
    duckMusic();
    return () => unDuckMusic();
  }, []);

  useEffect(() => {
    if (videoIdx === 0) return;
    requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
  }, [videoIdx]);

  // When all parent videos are done (or there are none), fire completion after
  // a short beat so the cheer sound sting lands first.
  useEffect(() => {
    if (!videosDone) return;
    const t = setTimeout(() => onAllDone?.(), 1400);
    return () => clearTimeout(t);
  }, [videosDone]);

  // No parent video: complete after the generated cheer audio ends (or a
  // fallback timer) so the moment still has a celebration.
  const handleCheerEnded = () => {
    if (videos.length > 0) return;
    setTimeout(() => onAllDone?.(), 1200);
  };

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

        {loading ? (
          <div className="flex flex-col items-center py-4">
            <Loader2 className="h-7 w-7 animate-spin text-white/80 mb-2" />
            <p className="font-semibold text-white/70">Getting your cheer ready…</p>
          </div>
        ) : (
          <>
            <h2 className="text-4xl font-bold text-white leading-tight">
              You did it, {kidName}!
            </h2>
            <p className="mt-1 font-semibold text-white/70">
              Great job with {subject}, {kidName}!
            </p>
            <audio
              ref={audioRef}
              src={data?.audio_url}
              onEnded={handleCheerEnded}
            />

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
                      if (videoIdx < videos.length - 1) {
                        setVideoIdx((i) => i + 1);
                      } else {
                        setVideosDone(true);
                      }
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
                {cheerText && (
                  <p className="mt-3 text-lg font-bold text-white">“{cheerText}”</p>
                )}
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
                {cheerText && (
                  <p className="text-xl font-bold text-white">“{cheerText}”</p>
                )}
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