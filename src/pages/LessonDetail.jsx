import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import LessonFlow from '@/components/LessonFlow';
import DayGraphic from '@/components/DayGraphic';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import StudioBackground from '@/components/StudioBackground';
import useAutoAmbientMusic from '@/hooks/useAutoAmbientMusic';
import { getDayConfigForAgeAndKey } from '@/lib/lessonConfig';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function LessonDetail() {
  const { kidId, weekStart, day } = useParams();
  const navigate = useNavigate();

  const [kid, setKid] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  useAutoAmbientMusic();
  const dayCfg = getDayConfigForAgeAndKey(kid?.age || 4, day);

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
        if (lessons[0]) setLesson(lessons[0]);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kidId, weekStart, day]);

  // Cache the generated Zoodo lesson activity on the lesson entity so the next
  // open is instant (no live regeneration, no stutter).
  const saveActivity = async (content) => {
    if (!lesson) return;
    try {
      const updated = await base44.entities.Lesson.update(lesson.id, { activity_content: content });
      setLesson((prev) => (prev ? { ...prev, activity_content: content } : prev));
      void updated;
    } catch (e) { /* ignore — cache is best-effort */ }
  };

  // Fires ONLY after the full sequence (Zoodo intro → teaching → assessment →
  // parent celebration) finishes. Marks today's lesson complete + returns home.
  const finishLesson = async () => {
    setCelebrating(false);
    if (!lesson) { navigate('/'); return; }
    try {
      await base44.entities.Lesson.update(lesson.id, {
        completed: true,
        skipped: false,
        completed_date: new Date().toISOString(),
      });
    } catch (e) { /* ignore */ }
    navigate('/');
  };

  const skipAndHome = async () => {
    if (!lesson) { navigate('/'); return; }
    try {
      await base44.entities.Lesson.update(lesson.id, { skipped: true, completed: false, completed_date: null });
    } catch (e) { /* ignore */ }
    navigate('/');
  };

  if (!dayCfg) {
    return (
      <Layout>
        <StudioBackground />
        <p className="relative z-10 text-center text-studio-card/60">Lesson not found.</p>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <StudioBackground />
        <div className="relative z-10 flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-studio-gold" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <StudioBackground />
      <div className="relative z-10 flex flex-col h-[calc(100dvh-9.5rem)] overflow-hidden text-studio-card">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => navigate('/')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-studio-card backdrop-blur-sm hover:bg-white/20 active:scale-95 transition"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
            <DayGraphic type={dayCfg.graphic} />
            <div className="text-base font-bold leading-tight text-studio-card">
              {dayCfg.subject}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
          <LessonFlow
            kidName={kid?.name || 'the child'}
            subject={dayCfg.subject}
            strand={dayCfg.strand}
            dayLabel={dayCfg.label}
            age={kid?.age || 4}
            lesson={lesson}
            currentLetter={kid?.current_letter || 'A'}
            milestone={kid?.developmental_milestone}
            supportNeeds={kid?.support_needs}
            onMastery={async (next) => {
              try {
                const updated = await base44.entities.Kid.update(kid.id, { current_letter: next });
                setKid(updated);
              } catch (e) { /* ignore */ }
            }}
            onPersistContent={saveActivity}
            onComplete={() => setCelebrating(true)}
            onNotReady={skipAndHome}
          />
        </div>
      </div>

      {celebrating && (
        <CelebrationOverlay
          kidName={kid?.name || 'the child'}
          subject={dayCfg.subject}
          parentVideos={kid?.parent_videos}
          cheerText={kid?.cheer_text}
          onAllDone={finishLesson}
        />
      )}
    </Layout>
  );
}