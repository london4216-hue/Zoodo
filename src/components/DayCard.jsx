import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Sparkles } from 'lucide-react';
import DayGraphic from './DayGraphic';
import { descriptionForStrand } from '@/lib/lessonConfig';
import { unlockAudio } from '@/lib/audioUnlock';

// One day row in the weekly plan. EVERY day is always launchable (this is a
// demo — there is no date-based locking). Completed days show a checkmark but
// completion never blocks re-launching. The click primes audio so the Zoodo
// intro autoplays with sound on the next screen.
export default function DayCard({ day, lesson, kidId, weekStart, isToday }) {
  const to = `/lesson/${kidId}/${weekStart}/${day.key}`;
  const completed = !!lesson?.completed;
  const skipped = !!lesson?.skipped;
  const inProgress =
    !completed && !skipped && !!(lesson?.activity_content || lesson?.drawing_url || lesson?.story || lesson?.loved?.length);
  const desc = descriptionForStrand(day.strand, day.subject);

  const statusBadge = completed ? (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
      <Check className="h-4 w-4" strokeWidth={3} />
    </span>
  ) : inProgress ? (
    <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">In progress</span>
  ) : skipped ? (
    <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-bold uppercase text-black/50">Skipped</span>
  ) : null;

  return (
    <Link to={to} onClick={unlockAudio} className="block">
      <div
        className={`block w-full rounded-[28px] p-4 transition-transform duration-200 ${
          isToday ? 'shadow-lg ring-4 ring-[#D96969]/40 hover:-translate-y-0.5' : 'shadow-sm hover:-translate-y-0.5'
        } active:scale-[0.99]`}
        style={{ backgroundColor: day.bg }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/55">
            <DayGraphic type={day.graphic} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-black/45">{day.label}</span>
              {isToday && (
                <span className="flex items-center gap-1 rounded-full bg-[#D96969] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  <Sparkles className="h-3 w-3" /> Today
                </span>
              )}
              {statusBadge}
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
            {completed ? (
              <span className="text-xs font-bold text-green-600/80">Done</span>
            ) : (
              <ChevronRight className="h-5 w-5 text-black/40" />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}