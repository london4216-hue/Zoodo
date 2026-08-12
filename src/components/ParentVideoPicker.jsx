import React, { useRef, useState } from 'react';
import { Upload, RefreshCw, Check, Film } from 'lucide-react';

// Lets the parent pick an actual video file from their device to use as the
// end-of-lesson cheer. Preview -> keep. Calls onRecorded(File).
export default function ParentVideoPicker({ cheer, onRecorded }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
  };

  return (
    <div className="text-center">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        onChange={onPick}
        className="hidden"
      />

      <div className="relative mx-auto aspect-video w-full max-w-sm overflow-hidden rounded-3xl bg-black/10 shadow-inner">
        {videoUrl ? (
          <video src={videoUrl} controls autoPlay loop playsInline className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center text-[#D96969]"
          >
            <Film className="h-10 w-10" />
            <span className="mt-2 text-sm font-bold">Tap to add a video</span>
          </button>
        )}
      </div>

      <p className="mt-3 rounded-2xl bg-white/70 p-3 text-left">
        <span className="text-xs font-bold uppercase tracking-wide text-black/40">This plays at the end of every lesson:</span>
        <span className="mt-1 block text-lg font-bold text-[#D96969]">“{cheer}”</span>
      </p>

      {!videoUrl ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-4 w-full rounded-2xl bg-[#D96969] py-4 text-lg font-bold text-white active:scale-95 transition hover:bg-[#c95a5a]"
        >
          <Upload className="mr-1 inline h-5 w-5" /> Choose video
        </button>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => { setVideoUrl(''); setFile(null); }}
            className="flex-1 rounded-2xl border-2 border-black/10 bg-white py-3 font-bold text-black/60 active:scale-95 transition"
          >
            <RefreshCw className="mr-1 inline h-4 w-4" /> Pick another
          </button>
          <button
            onClick={() => onRecorded(file)}
            className="flex-[2] rounded-2xl bg-[#4FAE5A] py-3 font-bold text-white active:scale-95 transition"
          >
            <Check className="mr-1 inline h-4 w-4" /> Keep & continue
          </button>
        </div>
      )}
    </div>
  );
}