import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import DayCard from '@/components/DayCard';
import WeekProgressRing from '@/components/WeekProgressRing';
import { DAY_MAP, getMondayISO, addWeeksISO, formatWeekRange, getDayConfigForAge } from '@/lib/lessonConfig';
import { isGenerating, markGenerating, clearGenerating } from '@/lib/weekGenState';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MusicToggle from '@/components/MusicToggle';
import useAutoAmbientMusic from '@/hooks/useAutoAmbientMusic';
import { playSparkle } from '@/lib/sensoryAudio';

const hasVideos = (lesson) =>
  lesson?.ai_content && lesson.ai_content.some((v) => v.video_id);

const weeksBetween = (a, b) => {
  if (!a || !b) return 0;
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / (7 * 24 * 60 * 60 * 1000));
};

export default function Home() {
  const navigate = useNavigate();
  useAutoAmbientMusic();
  const [kid, setKid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getMondayISO());
  const [lessonsByDay, setLessonsByDay] = useState({});
  const [preparing, setPreparing] = useState(false);
  const [planIntroUrl, setPlanIntroUrl] = useState('');
  const [earliestWeek, setEarliestWeek] = useState(getMondayISO());
  const introAudioRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const kids = await base44.entities.Kid.list();
        if (!kids || kids.length === 0) {
          navigate('/onboarding');
          return;
        }
        setKid(kids[0]);
        // Find the kid's first ever lesson week so we can show "Week: N".
        try {
          const all = await base44.entities.Lesson.filter({ kid_id: kids[0].id });
          const weeks = all.map((l) => l.week_start).filter(Boolean).sort();
          if (weeks.length) setEarliestWeek(weeks[0]);
        } catch (e) { /* ignore */ }
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
    const days = getDayConfigForAge(kid.age);

    (async () => {
      try {
        let lessons = await base44.entities.Lesson.filter({
          kid_id: kid.id,
          week_start: weekStart,
        });
        const existing = {};
        lessons.forEach((l) => { existing[l.day] = l; });

        const missing = days.filter((d) => !existing[d.key]);
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

        const needsGen = days.some((d) => !hasVideos(existing[d.key]));
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
    const days = getDayConfigForAge(kidObj.age);
    try {
      let lovedSubjects = [];
      let progression = null;
      try {
        const all = await base44.entities.Lesson.filter({ kid_id: kidObj.id });
        const subjectSet = new Set();
        all.forEach((l) => {
          if (l.loved && l.loved.length && l.subject) subjectSet.add(l.subject);
        });
        lovedSubjects = Array.from(subjectSet);

        const completed = all.filter((l) => l.completed);
        const skipped = all.filter((l) => l.skipped);
        const repeated = all.filter((l) => l.repeat_next_week);
        const weeksCompleted = new Set(completed.map((l) => l.week_start)).size;
        const lovedTitles = [];
        all.forEach((l) => {
          if (l.loved && l.loved.length && Array.isArray(l.ai_content)) {
            l.ai_content.forEach((v) => {
              if (v && l.loved.includes(v.video_id) && v.title) lovedTitles.push(v.title);
            });
          }
        });
        const subjectCounts = {};
        completed.forEach((l) => {
          if (l.subject) subjectCounts[l.subject] = (subjectCounts[l.subject] || 0) + 1;
        });
        progression = {
          weeksCompleted,
          weekNumber: weeksCompleted + 1,
          programLength: kidObj.program_length,
          completedSubjects: Object.entries(subjectCounts).map(([s, n]) => `${s} (${n}x)`),
          skippedSubjects: Array.from(new Set(skipped.map((l) => l.subject).filter(Boolean))),
          repeatedRequests: repeated.map((l) => `${l.day}: ${l.subject}`).filter(Boolean),
          lovedVideoTitles: lovedTitles.slice(0, 12),
          currentLetter: kidObj.current_letter,
        };
      } catch (e) { /* ignore */ }

      const res = await base44.functions.invoke('generateWeekContent', {
        kidName: kidObj.name,
        age: kidObj.age,
        milestone: kidObj.developmental_milestone,
        supportNeeds: kidObj.support_needs,
        lovedSubjects,
        progression,
      });
      const content = res?.data || {};

      const updates = [];
      for (const d of days) {
        const vids = content[d.key];
        if (vids && Array.isArray(vids) && existing[d.key]) {
          updates.push({ id: existing[d.key].id, ai_content: vids });
        }
      }
      if (updates.length) {
        const updated = await base44.entities.Lesson.bulkUpdate(updates);
        const byId = {};
        (updated || []).forEach((l) => { byId[l.id] = l; });
        for (const d of days) {
          if (existing[d.key] && byId[existing[d.key].id]) existing[d.key] = byId[existing[d.key].id];
        }
      }
      if (!cancelled) setLessonsByDay({ ...existing });

      const introKey = `planIntro_${monday}`;
      if (!cancelled && updates.length > 0 && !localStorage.getItem(introKey)) {
        try {
          const verbMap = {
            'Numbers': 'count numbers',
            'Letters': 'learn our letters',
            'Stretch time': 'stretch and move',
            'Music': 'make music',
            'Exercises': 'move and exercise',
            'First words': 'say first words',
            'Sensory sort': 'sort and play',
          };
          const introDays = days.map((d) => ({
            label: d.label || d.key.charAt(0).toUpperCase() + d.key.slice(1),
            verb: verbMap[d.subject] || (d.subject || 'play').toLowerCase(),
          }));
          const intro = await base44.functions.invoke('generatePlanIntro', {
            kidName: kidObj.name,
            age: kidObj.age,
            milestone: kidObj.developmental_milestone,
            weekRange: formatWeekRange(monday),
            days: introDays,
          });
          if (!cancelled && intro?.data?.audio_url) {
            localStorage.setItem(introKey, intro.data.audio_url);
            setPlanIntroUrl(intro.data.audio_url);
          }
        } catch (e) { /* ignore intro failure */ }
      }
    } catch (err) {
      console.error('week pre-gen failed', err);
    } finally {
      clearGenerating(monday);
      if (!cancelled) setPreparing(false);
    }
  };

  useEffect(() => {
    if (!planIntroUrl) return;
    if (introAudioRef.current) {
      introAudioRef.current.src = planIntroUrl;
      introAudioRef.current.play().then(() => playSparkle()).catch(() => {});
    }
  }, [planIntroUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF8] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FAD7D7] border-t-[#D96969] rounded-full animate-spin" />
      </div>
    );
  }

  const days = getDayConfigForAge(kid?.age || 4);
  const completedCount = days.filter((d) => lessonsByDay[d.key]?.completed).length;
  const todayKey = DAY_MAP[new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase()]?.key;
  const isCurrentWeek = weekStart === getMondayISO();
  const weekNumber = Math.max(1, weeksBetween(earliestWeek, weekStart) + 1);

  return (
    <Layout>
      <MusicToggle />

      {/* Weekly Lesson Plan header */}
      <div className="mb-4 rounded-[28px] bg-white p-5 shadow-sm">
        <h1
          className="text-3xl font-bold leading-none text-[#D96969]"
          style={{ WebkitTextStroke: '1px #C84545', letterSpacing: '0.01em' }}
        >
          WEEKLY Lesson Plan
        </h1>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-black/70">
              Name: <span className="text-[#D96969]">{kid?.name || 'Friend'}</span>
            </div>
            <div className="text-sm font-bold text-black/70">
              Week: <span className="text-[#D96969]">{weekNumber}</span>
            </div>
          </div>
          <WeekProgressRing completed={completedCount} total={days.length} />
        </div>
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
          <div className="text-xs font-semibold uppercase tracking-wide text-black/40">Week {weekNumber}</div>
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
        {days.map((day) => (
          <DayCard
            key={day.key}
            day={day}
            lesson={lessonsByDay[day.key]}
            kidId={kid.id}
            weekStart={weekStart}
            isToday={isCurrentWeek && day.key === todayKey}
          />
        ))}
      </div>

      {preparing && (
        <p className="mt-4 text-center text-sm font-medium text-black/40">Preparing this week's lessons…</p>
      )}

      <p className="mt-6 text-center text-sm text-black/40 font-medium">
        Tap today's card to start the Zoodo lesson!
      </p>

      <Link
        to="/activities"
        className="mt-4 flex items-center justify-between rounded-[24px] bg-gradient-to-r from-[#E0F5FF] to-[#EBE4DE] px-5 py-3.5 shadow-sm transition active:scale-[0.99]"
      >
        <div>
          <div className="text-sm font-bold text-black/70">Sensory Activities this week</div>
          <div className="text-xs font-medium text-black/45">Quick hands-on play ideas</div>
        </div>
        <span className="text-black/30 text-xl">›</span>
      </Link>

      <audio ref={introAudioRef} className="hidden" />
    </Layout>
  );
}