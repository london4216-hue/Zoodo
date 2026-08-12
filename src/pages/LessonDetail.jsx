import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import DayGraphic from '@/components/DayGraphic';
import KidAvatar from '@/components/KidAvatar';
import DrawingCanvas from '@/components/DrawingCanvas';
import StoryActivity from '@/components/StoryActivity';
import { DAY_MAP } from '@/lib/lessonConfig';
import { isGenerating } from '@/lib/weekGenState';
import { ArrowLeft, Check, ExternalLink, Heart, Loader2, Sparkles, Pencil, BookOpen, SkipForward } from 'lucide-react';

const hasVideos = (lesson) =>
  lesson?.ai_content && lesson.ai_content.some((v) => v.video_id);

export default function LessonDetail() {
  const { kidId, weekStart, day } = useParams();
  const navigate = useNavigate();
  const dayCfg = DAY_MAP[day];

  const [kid, setKid] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

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
          if (hasVideos(lessons[0])) setVideos(lessons[0].ai_content);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [kidId, weekStart, day]);

  useEffect(() => {
    if (loading || !dayCfg || !lesson) return;
    if (hasVideos(lesson)) {
      setVideos(lesson.ai_content);
      return;
    }
    if (isGenerating(weekStart)) {
      setPolling(true);
      const start = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - start > 70000) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          return;
        }
        try {
          const lessons = await base44.entities.Lesson.filter({
            kid_id: kidId, week_start: weekStart, day,
          });
          if (lessons[0] && hasVideos(lessons[0])) {
            setLesson(lessons[0]);
            setVideos(lessons[0].ai_content);
            setPolling(false);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch (e) { /* keep polling */ }
      }, 2000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lesson?.id, weekStart]);

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setError('');
    try {
      const res = await base44.functions.invoke('generateLessonContent', {
        subject: dayCfg.subject,
        day: dayCfg.label,
        kidName: kid?.name || 'the child',
        age: kid?.age || 4,
      });
      const vids = res?.data?.videos;
      if (!vids || !Array.isArray(vids)) throw new Error('No videos returned');
      setVideos(vids);
      if (lesson) {
        const updated = await base44.entities.Lesson.update(lesson.id, { ai_content: vids });
        setLesson(updated);
      }
    } catch (err) {
      setError(err?.message || 'Could not generate picks. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const markComplete = async () => {
    if (!lesson) return;
    const updated = await base44.entities.Lesson.update(lesson.id, {
      completed: true,
      skipped: false,
      completed_date: new Date().toISOString(),
    });
    setLesson(updated);
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

  const toggleLove = async (videoId) => {
    if (!lesson || !videoId) return;
    const loved = new Set(lesson.loved || []);
    if (loved.has(videoId)) loved.delete(videoId);
    else loved.add(videoId);
    const updated = await base44.entities.Lesson.update(lesson.id, {
      loved: Array.from(loved),
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

  const showSpinner = generating || polling;
  const greeting = `Hi ${kid?.name}! Today is ${dayCfg.label} — ${dayCfg.subject}! Let's learn together!`;
  const featured = videos && videos[0];

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

      {/* Today's video */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#D96969]" />
        <h2 className="text-lg font-bold text-black/80">Today's video for {kid?.name}</h2>
      </div>

      {showSpinner && (
        <div className="rounded-2xl bg-white p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#D96969] mx-auto mb-2" />
          <p className="text-black/50 font-medium">
            {polling ? 'Preparing videos for the week…' : 'Picking a great video…'}
          </p>
        </div>
      )}

      {error && !showSpinner && (
        <div className="rounded-2xl border-2 border-dashed border-black/10 bg-white/60 p-6 text-center">
          <p className="text-sm font-semibold text-red-500 mb-4">{error}</p>
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#4969E1] px-5 py-3 font-bold text-white hover:bg-[#3b54c9] active:scale-95 transition"
          >
            <Sparkles className="h-4 w-4" />
            Try again
          </button>
        </div>
      )}

      {featured && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-black/80 leading-snug">{featured.title}</h3>
              {featured.channel && (
                <span className="text-xs font-semibold text-black/40">{featured.channel}</span>
              )}
            </div>
            {featured.video_id && (
              <button
                onClick={() => toggleLove(featured.video_id)}
                aria-label={lesson?.loved?.includes(featured.video_id) ? 'Unlove' : 'Love this video'}
                className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90 ${
                  lesson?.loved?.includes(featured.video_id)
                    ? 'bg-pink-100 text-pink-500'
                    : 'bg-black/5 text-black/30 hover:text-pink-400'
                }`}
              >
                <Heart className="h-5 w-5" fill={lesson?.loved?.includes(featured.video_id) ? 'currentColor' : 'none'} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {featured.video_id ? (
            <div className="overflow-hidden rounded-xl bg-black aspect-video">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${featured.video_id}`}
                title={featured.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(featured.title || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E0F5FF] px-3 py-2 text-sm font-bold text-[#2B6FE0] hover:bg-[#c9ecff] active:scale-95 transition"
            >
              <ExternalLink className="h-4 w-4" />
              Find on YouTube
            </a>
          )}

          <p className="mt-3 text-sm text-black/60">{featured.description}</p>
          {featured.why && (
            <p className="mt-1.5 text-xs font-semibold text-[#D96969]">Why: {featured.why}</p>
          )}

          <button
            onClick={generate}
            disabled={generating}
            className="mt-3 w-full rounded-2xl border-2 border-black/10 bg-white py-2.5 text-sm font-bold text-black/50 hover:text-black/70 active:scale-[0.99] transition"
          >
            ↻ Pick a different video
          </button>
        </div>
      )}

      {/* Activities */}
      <div className="mt-6 space-y-4">
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
    </Layout>
  );
}