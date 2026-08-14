import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import DrawingCanvas from '@/components/DrawingCanvas';
import StoryActivity from '@/components/StoryActivity';
import LessonFlow from '@/components/LessonFlow';
import OptionalLessonVideo from '@/components/OptionalLessonVideo';
import LunchActivity from '@/components/LunchActivity';
import StretchGuide from '@/components/StretchGuide';
import DayGraphic from '@/components/DayGraphic';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import StudioBackground from '@/components/StudioBackground';
import SensoryButton from '@/components/SensoryButton';
import useAutoAmbientMusic from '@/hooks/useAutoAmbientMusic';
import { getDayConfigForAgeAndKey } from '@/lib/lessonConfig';
import { ArrowLeft, Loader2, Pencil, Sparkles, Home } from 'lucide-react';

export default function LessonDetail() {
  const { kidId, weekStart, day } = useParams();
  const navigate = useNavigate();

  const [kid, setKid] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const [lessonDone, setLessonDone] = useState(false);
  const [step, setStep] = useState('lesson'); // lesson | drawing | lunch | story
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

  useEffect(() => {
    setStep('lesson');
    setLessonDone(false);
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

  const skipAndHome = async () => {
    if (!lesson) { navigate('/'); return; }
    await base44.entities.Lesson.update(lesson.id, { skipped: true, completed: false, completed_date: null });
    navigate('/');
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
      <div className="relative z-10 flex flex-col h-[calc(100vh-9.5rem)] text-studio-card">
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

        {/* Step indicator */}
        <div className="mb-2 flex items-center justify-center gap-2">
          {['lesson', 'drawing', 'lunch', 'story'].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                step === s ? 'w-10 bg-studio-gold' : 'w-2 bg-white/25'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
          {step === 'lesson' && (
            <div className="space-y-3">
              {dayCfg.stretchGuide && !lessonDone && (
                <StretchGuide kidName={kid?.name} age={kid?.age || 4} />
              )}
              {lessonDone ? (
                <div className="rounded-3xl bg-studio-card p-6 text-center shadow-2xl">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-studio-gold/15 text-studio-gold">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-studio-ink">Lesson complete!</h2>
                  <p className="mt-1 text-sm font-semibold text-studio-ink/60">
                    Nice work, {kid?.name}! Want to draw or tell a story?
                  </p>
                  {lesson?.ai_content?.[0] && (
                    <div className="mt-4">
                      <OptionalLessonVideo
                        video={lesson.ai_content[0]}
                        subject={dayCfg.subject}
                        kidName={kid?.name}
                      />
                    </div>
                  )}
                  <div className="mt-4 flex flex-col gap-2">
                    <SensoryButton
                      onClick={() => setStep('drawing')}
                      glow="#E8B14A"
                      className="flex items-center justify-center gap-2 bg-studio-gold py-3.5 text-studio-ink"
                    >
                      <Pencil className="h-5 w-5" /> Draw it!
                    </SensoryButton>
                    <button
                      onClick={() => navigate('/')}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 py-3.5 font-bold text-studio-card active:scale-95 transition"
                    >
                      <Home className="h-5 w-5" /> Back to home
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                    onUpdate={setLesson}
                    onComplete={markComplete}
                    onNotReady={skipAndHome}
                  />
                </>
              )}
            </div>
          )}

          {step === 'drawing' && (
            <div className="space-y-3">
              <div className="rounded-3xl bg-studio-card p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Pencil className="h-5 w-5 text-studio-gold" />
                  <h2 className="text-lg font-bold text-studio-ink">Draw it!</h2>
                </div>
                <DrawingCanvas onSave={saveDrawing} savedUrl={lesson?.drawing_url} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('lesson')}
                  className="flex-1 rounded-2xl border border-white/20 bg-white/10 py-3.5 font-bold text-studio-card active:scale-95 transition"
                >
                  Back
                </button>
                <SensoryButton
                  onClick={() => setStep('lunch')}
                  glow="#E8B14A"
                  className="flex-[2] bg-studio-gold py-3.5 text-studio-ink"
                >
                  Next: Lunch time
                </SensoryButton>
              </div>
            </div>
          )}

          {step === 'lunch' && (
            <div className="space-y-3">
              <LunchActivity kidName={kid?.name} />
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('drawing')}
                  className="flex-1 rounded-2xl border border-white/20 bg-white/10 py-3.5 font-bold text-studio-card active:scale-95 transition"
                >
                  Back
                </button>
                <SensoryButton
                  onClick={() => setStep('story')}
                  glow="#E26D6D"
                  className="flex-[2] bg-studio-coral py-3.5 text-white"
                >
                  Next: Story time
                </SensoryButton>
              </div>
            </div>
          )}

          {step === 'story' && (
            <div className="space-y-3">
              <StoryActivity
                kidName={kid?.name || 'the child'}
                subject={dayCfg.subject}
                age={kid?.age || 4}
                onSaved={saveStory}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('lunch')}
                  className="flex-1 rounded-2xl border border-white/20 bg-white/10 py-3.5 font-bold text-studio-card active:scale-95 transition"
                >
                  Back
                </button>
                <SensoryButton
                  onClick={() => navigate('/')}
                  glow="#E26D6D"
                  className="flex-[2] bg-studio-coral py-3.5 text-white"
                >
                  <Home className="h-5 w-5" /> All done!
                </SensoryButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {celebrating && (
        <CelebrationOverlay
          kidName={kid?.name || 'the child'}
          subject={dayCfg.subject}
          parentVideos={kid?.parent_videos}
          cheerText={kid?.cheer_text}
          onClose={() => { setCelebrating(false); setLessonDone(true); }}
        />
      )}
    </Layout>
  );
}