import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Video, RefreshCw, Check } from 'lucide-react';

// Records a short video of the parent saying the child's cheer.
// Flow: live preview -> tap "Ready to record" -> 3-2-1 countdown ->
// auto-record ~5s -> preview -> re-record or keep. Calls onRecorded(File).
export default function ParentVideoRecorder({ cheer, onRecorded }) {
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | counting | recording | done | denied
  const [count, setCount] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState(null);
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    let active = null;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
        active = s; streamRef.current = s; setStream(s); setStatus('ready');
      } catch (e) {
        setStatus('denied');
      }
    })();
    return () => {
      if (active) active.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const startCountdown = () => {
    let n = 3;
    setStatus('counting');
    setCount(n);
    const tick = () => {
      n -= 1;
      if (n > 0) {
        setCount(n);
        setTimeout(tick, 800);
      } else {
        setCount(0);
        beginRecording();
      }
    };
    setTimeout(tick, 800);
  };

  const beginRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const f = new File([blob], 'parent_cheer.webm', { type: 'video/webm' });
      setFile(f);
      setVideoUrl(URL.createObjectURL(blob));
      setStatus('done');
    };
    rec.start();
    setStatus('recording');
    setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, 5000);
  };

  const keep = () => onRecorded(file);

  if (status === 'denied') {
    return (
      <div className="rounded-2xl bg-white/70 p-4 text-center text-sm font-semibold text-black/50">
        Camera is off — that's okay, you can skip and add this later.
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="relative mx-auto aspect-video w-full max-w-sm overflow-hidden rounded-3xl bg-black/10 shadow-inner">
        {status === 'done' ? (
          <video ref={previewRef} src={videoUrl} controls autoPlay loop className="h-full w-full object-cover" />
        ) : (
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
        )}
        {status === 'counting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <motion.span key={count} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-7xl font-bold text-white">
              {count}
            </motion.span>
          </div>
        )}
        {status === 'recording' && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> REC
          </span>
        )}
        {status === 'ready' && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-black/60 shadow">
            <Check className="h-3.5 w-3.5" strokeWidth={3} /> Ready
          </span>
        )}
      </div>

      <p className="mt-3 rounded-2xl bg-white/70 p-3 text-left">
        <span className="text-xs font-bold uppercase tracking-wide text-black/40">Say this on camera:</span>
        <span className="mt-1 block text-lg font-bold text-[#D96969]">“{cheer}”</span>
      </p>

      {status === 'loading' && (
        <div className="mt-4 flex items-center justify-center gap-2 text-black/50 font-semibold">
          <Loader2 className="h-5 w-5 animate-spin" /> Starting camera…
        </div>
      )}
      {status === 'ready' && (
        <button
          onClick={startCountdown}
          className="mt-4 w-full rounded-2xl bg-[#D96969] py-4 text-lg font-bold text-white active:scale-95 transition hover:bg-[#c95a5a]"
        >
          <Video className="mr-1 inline h-5 w-5" /> Ready to record
        </button>
      )}
      {status === 'counting' && (
        <button disabled className="mt-4 w-full rounded-2xl bg-[#D96969]/60 py-4 text-lg font-bold text-white">
          Get ready…
        </button>
      )}
      {status === 'recording' && (
        <button disabled className="mt-4 w-full rounded-2xl bg-red-400 py-4 text-lg font-bold text-white">
          Recording… (5s)
        </button>
      )}
      {status === 'done' && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => { setStatus('ready'); setVideoUrl(''); setFile(null); }}
            className="flex-1 rounded-2xl border-2 border-black/10 bg-white py-3 font-bold text-black/60 active:scale-95 transition"
          >
            <RefreshCw className="mr-1 inline h-4 w-4" /> Re-record
          </button>
          <button
            onClick={keep}
            className="flex-[2] rounded-2xl bg-[#4FAE5A] py-3 font-bold text-white active:scale-95 transition"
          >
            <Check className="mr-1 inline h-4 w-4" /> Keep & continue
          </button>
        </div>
      )}
    </div>
  );
}