import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Check, Video, Square, Camera } from 'lucide-react';

// Records a cheer video straight from the device's front camera — no gallery
// or old-file selection. Preview -> keep. Calls onRecorded(File).
export default function ParentVideoPicker({ cheer, onRecorded }) {
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [consented, setConsented] = useState(false);

  const liveRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Start the front camera as soon as the component mounts.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (liveRef.current) liveRef.current.srcObject = s;
      } catch (e) {
        setError('We need your camera to record a cheer. Please allow it and try again.');
      }
    })();
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
      setStream((prev) => {
        prev?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, []);

  useEffect(() => {
    if (stream && liveRef.current && !videoUrl) {
      liveRef.current.srcObject = stream;
    }
  }, [stream, videoUrl]);

  const startCountdown = () => {
    if (!stream || recording || videoUrl || !consented) return;
    setCountdown(3);
    let n = 3;
    const tick = () => {
      n -= 1;
      if (n <= 0) {
        setCountdown(0);
        startRecording();
      } else {
        setCountdown(n);
        setTimeout(tick, 1000);
      }
    };
    setTimeout(tick, 1000);
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const f = new File([blob], 'cheer.webm', { type: 'video/webm' });
      setFile(f);
      setVideoUrl(URL.createObjectURL(blob));
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const reset = () => {
    setVideoUrl('');
    setFile(null);
    setSeconds(0);
    if (stream && liveRef.current) liveRef.current.srcObject = stream;
  };

  return (
    <div className="text-center">
      {error ? (
        <div className="rounded-2xl bg-[#FAD7D7] p-4 text-sm font-semibold text-[#D96969]">
          {error}
        </div>
      ) : (
        <>
          <div className="relative mx-auto aspect-video w-full max-w-sm overflow-hidden rounded-3xl bg-black shadow-inner">
            {videoUrl ? (
              <video src={videoUrl} controls autoPlay loop playsInline className="h-full w-full object-cover" />
            ) : (
              <>
                <video ref={liveRef} autoPlay playsInline muted className="h-full w-full object-cover -scale-x-100" />
                {recording && (
                  <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-bold text-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#D96969]" /> REC {seconds}s
                  </div>
                )}
                {countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-7xl font-bold text-white drop-shadow-lg">{countdown}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <p className="mt-3 rounded-2xl bg-white/70 p-3 text-left">
            <span className="text-xs font-bold uppercase tracking-wide text-black/40">This plays at the end of every lesson:</span>
            <span className="mt-1 block text-lg font-bold text-[#D96969]">“{cheer}”</span>
          </p>

          <label className="mt-3 flex items-start gap-2 rounded-2xl bg-white/70 p-3 text-left text-sm font-medium text-black/70">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#D96969]"
            />
            <span>
              I consent to record this cheer video and let Zoodo store and play it back to {cheer ? 'my child' : 'the child'} at the end of each lesson.
            </span>
          </label>

          {!videoUrl ? (
            recording ? (
              <button
                onClick={stopRecording}
                className="mt-4 w-full rounded-2xl bg-[#D96969] py-4 text-lg font-bold text-white active:scale-95 transition"
              >
                <Square className="mr-1 inline h-5 w-5" /> Stop recording
              </button>
            ) : (
              <button
                onClick={startCountdown}
                disabled={!consented}
                className="mt-4 w-full rounded-2xl bg-[#D96969] py-4 text-lg font-bold text-white active:scale-95 transition hover:bg-[#c95a5a] disabled:opacity-50 disabled:grayscale"
              >
                <Video className="mr-1 inline h-5 w-5" /> Record your cheer
              </button>
            )
          ) : (
            <div className="mt-4 flex gap-2">
              <button
                onClick={reset}
                className="flex-1 rounded-2xl border-2 border-black/10 bg-white py-3 font-bold text-black/60 active:scale-95 transition"
              >
                <RefreshCw className="mr-1 inline h-4 w-4" /> Redo
              </button>
              <button
                onClick={() => onRecorded(file)}
                className="flex-[2] rounded-2xl bg-[#4FAE5A] py-3 font-bold text-white active:scale-95 transition"
              >
                <Check className="mr-1 inline h-4 w-4" /> Keep & continue
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}