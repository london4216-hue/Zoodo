import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import DayCard from '@/components/DayCard';
import KidAvatar from '@/components/KidAvatar';
import { DAYS, DAY_MAP, getMondayISO, addWeeksISO, formatWeekRange } from '@/lib/lessonConfig';
import { isGenerating, markGenerating, clearGenerating } from '@/lib/weekGenState';
import { ChevronLeft, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import MusicToggle from '@/components/MusicToggle';
import useAutoAmbientMusic from '@/hooks/useAutoAmbientMusic';

const hasVideos = (lesson) =>
  lesson?.ai_content && lesson.ai_content.some((v) => v.video_id);

export default function Home() {
  const navigate = useNavigate();
  useAutoAmbientMusic();
  const [kid, setKid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getMondayISO());
  const [lessonsByDay, setLessonsByDay] = useState({});
  const [preparing, setPreparing] = useState(false);

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

  useEffect(() => {
    if (!kid) return;
    let cancelled = false;

    (async () => {
      try {
        let lessons = await base44.entities.Lesson.filter({
          kid_id: kid.id,
          week_start: weekStart,
        });
        const existing = {};
        lessons.forEach((l) => { existing[l.day] = l; });

        const missing = DAYS.filter((d) => !existing[d.key]);
        if (missing.length > 0) {
          const created = await base44.entities.Lesson.bulkCreate(
            missing.map((d) => ({
              kid_id: kid.id,
              week_start: weekStart,
              day: d.key,
              subject: d.subject,
              completed: false,
            }))
          );
          created.forEach((l) => { existing[l.day] = l; });
        }
        if (!cancelled) setLessonsByDay(existing);

        const needsGen = DAYS.some((d) => !hasVideos(existing[d.key]));
        if (needsGen && !isGenerating(weekStart)) {
          preGenerate(kid, weekStart, existing, cancelled);
        }
      } catch (err) {
        console.error(err);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kid, weekStart]);

  const preGenerate = async (kidObj, monday, existing, cancelled) => {
    markGenerating(monday);
    setPreparing(true);
    try {
      let lovedSubjects = [];
      try {
        const all = await base44.entities.Lesson.filter({ kid_id: kidObj.id });
        const subjectSet = new Set();
        all.forEach((l) => {
          if (l.loved && l.loved.length && l.subject) subjectSet.add(l.subject);
        });
        lovedSubjects = Array.from(subjectSet);
      } catch (e) { /* ignore */ }

      const res = await base44.functions.invoke('generateWeekContent', {
        kidName: kidObj.name,
        age: kidObj.age,
        lovedSubjects,
      });
      const content = res?.data || {};

      for (const d of DAYS) {
        const vids = content[d.key];
        if (vids && Array.isArray(vids) && existing[d.key]) {
          const updated = await base44.entities.Lesson.update(existing[d.key].id, {
            ai_content: vids,
          });
          existing[d.key] = updated;
        }
      }
      if (!cancelled) setLessonsByDay({ ...existing });
    } catch (err) {
      console.error('week pre-gen failed', err);
    } finally {
      clearGenerating(monday);
      if (!cancelled) setPreparing(false);
    }
  };

  const refreshDemo = async () => {
    if (!window.confirm('Reset the demo? This clears all kids and lessons so you can start fresh.')) return;
    try {
      await base44.entities.Lesson.deleteMany({});
      await base44.entities.Kid.deleteMany({});
      navigate('/onboarding');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FAD7D7] border-t-[#D96969] rounded-full animate-spin" />
      </div>
    );
  }

  const todayKey = DAY_MAP[new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase()]?.key;
  const greeting = `Hi ${kid?.name}! Let's get ready to learn! This week: Numbers, Letters, Outdoor fun, Music, and Exercises!`;

  return (
    <Layout>
      <MusicToggle />
      {/* Refresh demo (prototype helper) */}
      <div className="flex justify-end pb-1">
        <button
          onClick={refreshDemo}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black/40 shadow-sm hover:text-[#D96969] active:scale-95 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Refresh demo
        </button>
      </div>

      {/* Learning buddy greeting */}
      <div className="flex justify-center pt-2 pb-4">
        <KidAvatar greeting={greeting} size={150} />
      </div>

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

      {preparing && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-[#FEF5B0] px-4 py-2.5 text-sm font-semibold text-black/70">
          <Loader2 className="h-4 w-4 animate-spin text-[#D96969]" />
          Preparing this week's videos…
        </div>
      )}

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
        Tap a day to open its lesson, watch the video, draw, and hear a story!
      </p>
    </Layout>
  );
}