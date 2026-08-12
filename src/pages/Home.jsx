import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import DayCard from '@/components/DayCard';
import { DAYS, DAY_MAP, getMondayISO, addWeeksISO, formatWeekRange } from '@/lib/lessonConfig';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [kid, setKid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getMondayISO());
  const [lessonsByDay, setLessonsByDay] = useState({});

  // Load the caregiver's kid (first one). If none, go to onboarding.
  useEffect(() => {
    (async () => {
      try {
        const kids = await base44.entities.Kid.list();
        if (!kids || kids.length === 0) {
          navigate('/onboarding');
          return;
        }
        setKid(kids[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  // Load (or auto-create) the 5 lessons for the selected week.
  const loadWeek = useCallback(async (kidId, monday) => {
    try {
      let lessons = await base44.entities.Lesson.filter({
        kid_id: kidId,
        week_start: monday,
      });
      const existing = {};
      lessons.forEach((l) => { existing[l.day] = l; });

      // Create any missing day lessons for the week.
      const missing = DAYS.filter((d) => !existing[d.key]);
      if (missing.length > 0) {
        const created = await base44.entities.Lesson.bulkCreate(
          missing.map((d) => ({
            kid_id: kidId,
            week_start: monday,
            day: d.key,
            subject: d.subject,
            completed: false,
          }))
        );
        created.forEach((l) => { existing[l.day] = l; });
      }
      setLessonsByDay(existing);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (kid) loadWeek(kid.id, weekStart);
  }, [kid, weekStart, loadWeek]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FAD7D7] border-t-[#D96969] rounded-full animate-spin" />
      </div>
    );
  }

  const todayKey = DAY_MAP[new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase()]?.key;

  return (
    <Layout>
      {/* Header */}
      <header className="text-center mb-5">
        <h1
          className="text-4xl font-bold leading-tight"
          style={{ color: '#D96969' }}
        >
          WEEKLY Lesson Plan
        </h1>
        <div className="mt-2 flex items-center justify-center gap-4 text-lg">
          <span className="text-black font-semibold">
            Name: <span style={{ color: '#4969E1' }} className="font-bold">{kid?.name}</span>
          </span>
        </div>
      </header>

      {/* Week switcher */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          onClick={() => setWeekStart(addWeeksISO(weekStart, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm text-black/60 hover:text-black active:scale-95 transition"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-black/40">Week</div>
          <div className="text-sm font-bold text-black/70">{formatWeekRange(weekStart)}</div>
        </div>
        <button
          onClick={() => setWeekStart(addWeeksISO(weekStart, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm text-black/60 hover:text-black active:scale-95 transition"
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day cards */}
      <div className="space-y-3">
        {DAYS.map((day) => (
          <div key={day.key} className="relative">
            <DayCard
              day={day}
              lesson={lessonsByDay[day.key]}
              kidId={kid.id}
              weekStart={weekStart}
            />
            {day.key === todayKey && (
              <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-[#4969E1]" title="Today" />
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-black/40 font-medium">
        Tap a day to open its lesson and get AI video picks.
      </p>
    </Layout>
  );
}