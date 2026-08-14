import React from 'react';

// A gentle circular progress indicator showing how many of the week's
// lessons are complete.
export default function WeekProgressRing({ completed, total }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const pct = total ? Math.min(1, completed / total) : 0;

  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#FAD7D7" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="#D96969"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-black/70">
        {completed}/{total}
      </div>
    </div>
  );
}