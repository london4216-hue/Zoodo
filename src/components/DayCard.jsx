import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Camera, Mic, Hand, ChevronRight } from 'lucide-react';
import DayGraphic from './DayGraphic';
import { hardwareForStrand, descriptionForStrand } from '@/lib/lessonConfig';

const HW = {
  camera: { icon: Camera, label: 'Camera', tint: '#4969E1' },
  mic: { icon: Mic, label: 'Mic', tint: '#D96969' },
  touch: { icon: Hand, label: 'Touch', tint: '#4FAE5A' },
};

// One day row in the weekly plan. Clicking opens the lesson detail.
export default function DayCard({ day, lesson, kidId, weekStart }) {
  const to = `/lesson/${kidId}/${weekStart}/${day.key}`;
  const completed = !!lesson?.completed;
  const skipped = !!lesson?.skipped;
  const inProgress =
    !completed && !skipped && !!(lesson?.drawing_url || lesson?.story || lesson?.loved?.length);

  const hw = HW[hardwareForStrand(day.strand)] || HW.touch;
  const HwIcon = hw.icon;
  const desc = descriptionForStrand(day.strand, day.subject);

  return (
    <Link
      to={to}
      className="block w-full rounded-[28px] p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]"
      style={{ backgroundColor: day.bg }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/55">
          <DayGraphic type={day.graphic} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-black/45">
              {day.label}
            </span>
            {completed ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            ) : inProgress ? (
              <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                In progress
              </span>
            ) : skipped ? (
              <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-bold uppercase text-black/50">
                Skipped
              </span>
            ) : null}
          </div>
          <div
            className="text-2xl font-bold leading-tight"
            style={{ color: day.titleColor, WebkitTextStroke: `1.5px ${day.titleStroke}` }}
          >
            {day.subject}
          </div>
          <div className="mt-0.5 text-sm font-medium text-black/55 line-clamp-1">{desc}</div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold"
            style={{ color: hw.tint }}
          >
            <HwIcon className="h-3.5 w-3.5" /> {hw.label}
          </span>
          <ChevronRight className="h-5 w-5 text-black/30" />
        </div>
      </div>
    </Link>
  );
}