import React, { useEffect, useRef, useState } from 'react';

export default function ParentVideoPlayback({ videos = [], onPlay, className = '' }) {
  const clipList = Array.isArray(videos) ? videos.filter(Boolean) : [];
  const [videoIdx, setVideoIdx] = useState(0);
  const [videosDone, setVideosDone] = useState(false);
  const videoRef = useRef(null);
  const clipSignature = clipList.join('|');

  useEffect(() => {
    setVideoIdx(0);
    setVideosDone(false);
  }, [clipSignature]);

  useEffect(() => {
    if (!clipList.length) return;
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
    });
  }, [videoIdx, clipList.length]);

  if (!clipList.length) return null;

  return (
    <div className={className}>
      <div className="relative mx-auto aspect-video w-full max-w-xs overflow-hidden rounded-3xl border-4 border-[#D96969] bg-black shadow-lg">
        <video
          ref={videoRef}
          key={videoIdx}
          src={clipList[videoIdx]}
          autoPlay
          playsInline
          controls={videosDone}
          className="h-full w-full object-cover"
          onPlay={onPlay}
          onEnded={() => {
            if (videoIdx < clipList.length - 1) {
              setVideoIdx((i) => i + 1);
            } else {
              setVideosDone(true);
            }
          }}
        />
        {clipList.length > 1 && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {clipList.map((_, i) => (
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

      {videosDone && (
        <button
          onClick={() => {
            setVideoIdx(0);
            setVideosDone(false);
            requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
          }}
          className="mt-2 text-sm font-semibold text-[#D96969] underline underline-offset-2"
        >
          Replay cheers
        </button>
      )}
    </div>
  );
}
