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
              </>
            )}
          </div>

          <p className="mt-3 rounded-2xl bg-white/70 p-3 text-left">
            <span className="text-xs font-bold uppercase tracking-wide text-black/40">This plays at the end of every lesson:</span>
            <span className="mt-1 block text-lg font-bold text-[#D96969]">“{cheer}”</span>
          </p>

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
                onClick={startRecording}
                className="mt-4 w-full rounded-2xl bg-[#D96969] py-4 text-lg font-bold text-white active:scale-95 transition hover:bg-[#c95a5a]"
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