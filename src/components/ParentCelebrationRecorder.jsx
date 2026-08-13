import React, { useState } from 'react';
import ParentVideoPicker from '@/components/ParentVideoPicker';

export default function ParentCelebrationRecorder({ kidName, parentIndex = 0, onRecorded }) {
  const [consented, setConsented] = useState(false);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-black/40">
        Grown-up {parentIndex + 1}
      </p>
      <p className="mt-1 text-sm font-semibold text-black/60">
        Say “{kidName}, you did it!” and add your cheer (10–20 seconds).
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs font-semibold text-black/60">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#D96969]"
        />
        <span>
          I consent to camera recording for this celebration video.
        </span>
      </label>

      <div className="mt-3">
        {consented ? (
          <ParentVideoPicker
            cheer={`You did it, ${kidName}!`}
            onRecorded={onRecorded}
          />
        ) : (
          <p className="rounded-2xl bg-[#FFF6E6] p-3 text-sm font-semibold text-black/60">
            Check consent to start recording.
          </p>
        )}
      </div>
    </div>
  );
}
