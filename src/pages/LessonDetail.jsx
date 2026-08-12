import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import DayGraphic from '@/components/DayGraphic';
import KidAvatar from '@/components/KidAvatar';
import DrawingCanvas from '@/components/DrawingCanvas';
import StoryActivity from '@/components/StoryActivity';
import AiLessonActivity from '@/components/AiLessonActivity';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import { DAY_MAP } from '@/lib/lessonConfig';
import { ArrowLeft, Check, Loader2, Pencil, SkipForward } from 'lucide-react';

export default function LessonDetail() {
  const { kidId, weekStart, day } = useParams();
  const navigate = useNavigate();
  const dayCfg = DAY_MAP[day];

  const [kid, setKid] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const kids = await base44.entities.Kid.filter({ id: kidId });
        if (!cancelled && kids[0]) setKid(kids[0]);
        const lessons = await base44.entities.Lesson.filter({
          kid_id: kidId,
          week_start: weekStart,
          day,
        });
        if (cancelled) return;
        if (lessons[0]) {
          setLesson(lessons[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kidId, weekStart, day]);

  const markComplete = async () => {
    if (!lesson) return;
    const updated = await base44.entities.Lesson.update(lesson.id, {
      completed: true,
      skipped: false,
      completed_date: new Date().toISOString(),
    });
    setLesson(updated);
    setCelebrating(true);
  };

  const skip = async () => {
    if (!lesson) return;
    const updated = await base44.entities.Lesson.update(lesson.id, {
      skipped: true,
      completed: false,
      completed_date: null,
    });
    setLesson(updated);
  };

  const uncomplete = async () => {
    if (!lesson) return;
    const updated = await base44.entities.Lesson.update(lesson.id, {
      completed: false,
      skipped: false,
      completed_date: null,
    });
    setLesson(updated);
  };

  const saveDrawing = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const updated = await base44.entities.Lesson.update(lesson.id, { drawing_url: file_url });
    setLesson(updated);
  };

  const saveStory = async (text) => {
    const updated = await base44.entities.Lesson.update(lesson.id, { story: text });
    setLesson(updated);
  };

  if (!dayCfg) {
    return (
      <Layout>
        <p className="text-center text-black/50">Lesson not found.</p>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#D96969]" />
        </div>
      </Layout>
    );
  }

  const greeting = `Hi ${kid?.name}! Today is ${dayCfg.label} — ${dayCfg.subject}! Let's learn together!`;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigate('/')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm text-black/60 hover:text-black active:scale-95 transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Link to="/dashboard" className="text-sm font-semibold text-[#4969E1]">
          Dashboard
        </Link>
      </div>

      {/* Learning buddy greets the kid by name with today's topic */}
      <div className="flex justify-center pb-2">
        <KidAvatar greeting={greeting} size={120} />
      </div>

      {/* Day banner */}
      <div
        className="rounded-[28px] px-5 py-5 mb-4"
        style={{ backgroundColor: dayCfg.bg }}
      >
        <div className="flex items-center gap-4">
          <DayGraphic type={dayCfg.graphic} />
          <div>
            <div className="text-sm font-semibold text-black/70">{dayCfg.label}</div>
            <div
              className="text-3xl font-bold leading-tight"
              style={{
                color: dayCfg.titleColor,
                WebkitTextStroke: `1.5px ${dayCfg.titleStroke}`,
              }}
            >
              {dayCfg.subject}
            </div>
          </div>
        </div>
      </div>

      {/* Status + caregiver actions: complete / skip / uncomplete */}
      <div className="mb-5 rounded-2xl bg-white p-3 shadow-sm">
        {lesson?.completed ? (
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center gap-2 rounded-2xl bg-green-100 px-4 py-3 font-bold text-green-700">
              <Check className="h-5 w-5" strokeWidth={3} />
              Lesson complete
            </span>
            <button
              onClick={uncomplete}
              className="rounded-2xl border-2 border-black/10 px-4 py-3 text-sm font-bold text-black/60 active:scale-95 transition"
            >
              Uncomplete
            </button>
          </div>
        ) : lesson?.skipped ? (
          <div className="flex items-center gap-2">
            <span className="flex flex-1 items-center gap-2 rounded-2xl bg-amber-100 px-4 py-3 font-bold text-amber-700">
              <SkipForward className="h-5 w-5" strokeWidth={3} />
              Skipped
            </span>
            <button
              onClick={uncomplete}
              className="rounded-2xl border-2 border-black/10 px-4 py-3 text-sm font-bold text-black/60 active:scale-95 transition"
            >
              Undo
            </button>
            <button
              onClick={markComplete}
              className="rounded-2xl bg-green-500 px-4 py-3 text-sm font-bold text-white active:scale-95 transition"
            >
              Complete
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={markComplete}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 py-3 font-bold text-white active:scale-95 transition"
            >
              <Check className="h-5 w-5" strokeWidth={3} />
              Mark complete
            </button>
            <button
              onClick={skip}
              className="flex items-center gap-2 rounded-2xl border-2 border-black/10 px-4 py-3 font-bold text-black/60 active:scale-95 transition"
            >
              <SkipForward className="h-5 w-5" strokeWidth={2.5} />
              Skip
            </button>
          </div>
        )}
      </div>

      {/* AI interactive audio activity (cute voice) */}
      <div className="mb-4">
        <AiLessonActivity
          kidName={kid?.name || 'the child'}
          subject={dayCfg.subject}
          dayLabel={dayCfg.label}
          age={kid?.age || 4}
          lesson={lesson}
          onUpdate={setLesson}
        />
      </div>

      {/* More activities */}
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Pencil className="h-5 w-5 text-[#4FAE5A]" />
            <h2 className="text-lg font-bold text-black/80">Draw it!</h2>
          </div>
          <DrawingCanvas onSave={saveDrawing} savedUrl={lesson?.drawing_url} />
        </div>

        <StoryActivity
          kidName={kid?.name || 'the child'}
          subject={dayCfg.subject}
          age={kid?.age || 4}
          onSaved={saveStory}
        />
      </div>

      {celebrating && (
        <CelebrationOverlay
          kidName={kid?.name || 'the child'}
          subject={dayCfg.subject}
          onClose={() => setCelebrating(false)}
        />
      )}
    </Layout>
  );
}