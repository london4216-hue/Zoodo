import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import Layout from '@/components/Layout';
import DayGraphic from '@/components/DayGraphic';
import { DAY_MAP } from '@/lib/lessonConfig';
import { ArrowLeft, Check, ExternalLink, Loader2, Sparkles } from 'lucide-react';

export default function LessonDetail() {
  const { kidId, weekStart, day } = useParams();
  const navigate = useNavigate();
  const dayCfg = DAY_MAP[day];

  const [kid, setKid] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState('');

  // Load kid + lesson
  useEffect(() => {
    (async () => {
      try {
        const kids = await base44.entities.Kid.filter({ id: kidId });
        if (kids[0]) setKid(kids[0]);
        const lessons = await base44.entities.Lesson.filter({
          kid_id: kidId,
          week_start: weekStart,
          day,
        });
        if (lessons[0]) {
          setLesson(lessons[0]);
          if (lessons[0].ai_content) setVideos(lessons[0].ai_content);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [kidId, weekStart, day]);

  // Generate the 3 AI video picks (only if not already saved)
  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setError('');
    try {
      const res = await base44.functions.invoke('generateLessonContent', {
        subject: dayCfg.subject,
        day: dayCfg.label,
        kidName: kid?.name || 'the child',
      });
      const vids = res?.data?.videos;
      if (!vids || !Array.isArray(vids)) {
        throw new Error('No videos returned');
      }
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

  const toggleComplete = async () => {
    if (!lesson) return;
    const newCompleted = !lesson.completed;
    const updated = await base44.entities.Lesson.update(lesson.id, {
      completed: newCompleted,
      completed_date: newCompleted ? new Date().toISOString() : null,
    });
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

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
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

      {/* Day banner */}
      <div
        className="rounded-[28px] px-5 py-6 mb-5"
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

      {/* Completion checkbox */}
      <button
        onClick={toggleComplete}
        className="w-full mb-5 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm active:scale-[0.99] transition text-left"
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition ${
            lesson?.completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-black/20 bg-white'
          }`}
        >
          {lesson?.completed && <Check className="h-5 w-5" strokeWidth={3} />}
        </span>
        <span className="font-semibold text-black/80">
          {lesson?.completed ? 'Lesson complete' : 'Mark lesson as complete'}
        </span>
      </button>

      {/* AI video picks */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#D96969]" />
        <h2 className="text-lg font-bold text-black/80">AI video picks for {kid?.name}</h2>
      </div>

      {!videos && !generating && (
        <div className="rounded-2xl border-2 border-dashed border-black/10 bg-white/60 p-6 text-center">
          <p className="text-black/50 font-medium mb-4">
            Get 3 unique, kid-friendly YouTube picks for today's "{dayCfg.subject}" lesson.
          </p>
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#4969E1] px-5 py-3 font-bold text-white hover:bg-[#3b54c9] active:scale-95 transition"
          >
            <Sparkles className="h-4 w-4" />
            Generate video picks
          </button>
        </div>
      )}

      {generating && (
        <div className="rounded-2xl bg-white p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#D96969] mx-auto mb-2" />
          <p className="text-black/50 font-medium">Picking 3 great videos…</p>
        </div>
      )}

      {error && (
        <p className="text-sm font-semibold text-red-500 mb-3">{error}</p>
      )}

      {videos && videos.length > 0 && (
        <div className="space-y-4">
          {videos.map((v, i) => (
            <div key={i} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: ['#F2C200', '#7B4FE0', '#4FAE5A'][i % 3] }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-black/80 leading-snug">{v.title}</h3>
                  {v.channel && (
                    <span className="text-xs font-semibold text-black/40">{v.channel}</span>
                  )}
                </div>
              </div>

              {v.video_id ? (
                <div className="overflow-hidden rounded-xl bg-black aspect-video">
                  <iframe
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${v.video_id}`}
                    title={v.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(v.title || v.search_query || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#E0F5FF] px-3 py-2 text-sm font-bold text-[#2B6FE0] hover:bg-[#c9ecff] active:scale-95 transition"
                >
                  <ExternalLink className="h-4 w-4" />
                  Find on YouTube
                </a>
              )}

              <p className="mt-3 text-sm text-black/60">{v.description}</p>
              {v.why && (
                <p className="mt-1.5 text-xs font-semibold text-[#D96969]">
                  Why: {v.why}
                </p>
              )}
            </div>
          ))}
          <button
            onClick={generate}
            disabled={generating}
            className="w-full rounded-2xl border-2 border-black/10 bg-white py-3 text-sm font-bold text-black/50 hover:text-black/70 active:scale-[0.99] transition"
          >
            ↻ Regenerate picks
          </button>
        </div>
      )}
    </Layout>
  );
}