import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import ZoodoAvatar2D from '@/components/ZoodoAvatar2D';
import AnimatedLessonScene from '@/components/AnimatedLessonScene';
import { playAudio, stopAll } from '@/lib/lessonAudioController';
import { unlockAudio } from '@/lib/audioUnlock';

// One continuous state machine for the lesson itself:
//   intro  → Zoodo greets the child (auto-plays, his own silly voice)
//   lesson → the narrator reads the whole lesson as one continuous track over
//            an animated scene, then onComplete fires.
// All audio goes through the single lessonAudioController — only one track at
// a time, and the previous track is stopped before the next begins.
export default function LessonFlow({
  kidName, subject, strand, dayLabel, age, lesson, currentLetter, milestone, supportNeeds,
  onPersistContent, onComplete,
}) {
  const [phase, setPhase] = useState('intro');
  const [content, setContent] = useState(null);
  const [contentStatus, setContentStatus] = useState('generating');
  // null = still fetching, {} = fetched but no audio, { audio_url, script } = ready
  const [greeting, setGreeting] = useState(null);
  const [greetingPlaying, setGreetingPlaying] = useState(false);
  const [narrationPlaying, setNarrationPlaying] = useState(false);
  const [revealStep, setRevealStep] = useState(0);
  const pacingRef = useRef(null);

  // Prime HTML5 audio early so the parent video later autoplays with sound.
  useEffect(() => { unlockAudio(); }, []);

  // Load cached activity (instant reopen) or generate + cache. Greeting is
  // always fetched fresh. Both come from the backend; the narration script and
  // the on-screen content are produced by the SAME generateLessonActivity call
  // so they can never drift apart.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (lesson?.activity_content) {
        setContent(lesson.activity_content);
        setContentStatus('ready');
      } else {
        setContentStatus('generating');
        try {
          const res = await base44.functions.invoke('generateLessonActivity', {
            subject, dayLabel, kidName, age, milestone, supportNeeds,
            currentLetter: strand === 'literacy' ? (currentLetter || 'A') : undefined,
          });
          if (cancelled) return;
          if (res?.data?.error) throw new Error(res.data.error);
          setContent(res.data);
          setContentStatus('ready');
          onPersistContent?.(res.data);
        } catch (err) {
          if (cancelled) return;
          setContentStatus('error');
        }
      }
      try {
        const gres = await base44.functions.invoke('generateGreeting', { kidName, subject, dayLabel });
        if (cancelled) return;
        setGreeting(gres?.data?.audio_url ? gres.data : {});
      } catch (e) {
        if (!cancelled) setGreeting({});
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, dayLabel, kidName, age]);

  // Reveal steps derived from the SAME content the narration was generated from.
  const revealCards = content ? [
    ...(content.letter ? [{ kind: 'letter' }] : []),
    ...(content.sound ? [{ kind: 'sound' }] : []),
    ...(content.word ? [{ kind: 'word' }] : []),
    ...(content.bombardment_words?.length ? [{ kind: 'bombardment' }] : []),
  ] : [];
  const counting = content?.counting_cards && content.counting_cards.length >= 2 ? content.counting_cards : null;
  const sceneSteps = counting ? counting.length : (revealCards.length || 1);

  // INTRO: auto-play Zoodo's greeting the moment it's ready — no extra tap.
  // When it ends, the controller has already stopped it; move to the lesson.
  useEffect(() => {
    if (phase !== 'intro' || !greeting?.audio_url) return;
    let cancelled = false;
    setGreetingPlaying(true);
    playAudio(greeting.audio_url, {
      kind: 'greeting',
      onEnded: () => { if (!cancelled) { setGreetingPlaying(false); setPhase('lesson'); } },
    }).then(() => { if (!cancelled) setGreetingPlaying(false); });
    return () => { cancelled = true; stopAll(); };
  }, [phase, greeting]);

  // INTRO fallback: no greeting audio (fetch failed) → show the text, then start.
  useEffect(() => {
    if (phase !== 'intro') return;
    if (greeting && !greeting.audio_url) {
      const t = setTimeout(() => setPhase('lesson'), 2600);
      return () => clearTimeout(t);
    }
  }, [phase, greeting]);

  // LESSON: play the narration as ONE continuous track start-to-finish, pace
  // the animated scene to the narration duration, then onComplete. The
  // controller guarantees the greeting was stopped before this starts.
  useEffect(() => {
    if (phase !== 'lesson' || contentStatus !== 'ready' || !content) return;
    let cancelled = false;
    const n = sceneSteps;
    const startPacing = (dur) => {
      const interval = (dur && isFinite(dur) && dur > 0) ? (dur * 1000) / n : 3600;
      setRevealStep(0);
      pacingRef.current = setInterval(() => setRevealStep((s) => (s + 1 >= n ? s : s + 1)), interval);
    };
    setNarrationPlaying(true);
    playAudio(content.audio_url, {
      kind: 'narration',
      onStarted: (el) => startPacing(el.duration),
      onEnded: () => {
        if (cancelled) return;
        setNarrationPlaying(false);
        if (pacingRef.current) { clearInterval(pacingRef.current); pacingRef.current = null; }
        setRevealStep(n - 1);
        setTimeout(() => { if (!cancelled) onComplete?.(); }, 900);
      },
    });
    return () => {
      cancelled = true;
      if (pacingRef.current) { clearInterval(pacingRef.current); pacingRef.current = null; }
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, content, contentStatus]);

  return (
    <div className="rounded-3xl bg-studio-card p-4 shadow-2xl">
      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            <ZoodoAvatar2D size={140} talking={greetingPlaying} />
            <h2 className="mt-3 max-w-sm text-xl font-bold leading-snug text-studio-ink">
              {greeting?.script || `Hi ${kidName}! Today we're learning ${subject}!`}
            </h2>
            {greeting === null && (
              <div className="flex flex-col items-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-studio-coral" />
                <p className="mt-2 text-sm font-semibold text-studio-ink/50">Zoodo's getting ready…</p>
              </div>
            )}
            {contentStatus === 'error' && (
              <p className="py-4 text-sm font-semibold text-studio-coral">Could not load the lesson. Try again!</p>
            )}
          </motion.div>
        )}

        {phase === 'lesson' && (
          <motion.div
            key="lesson"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center text-center"
          >
            <h2 className="text-lg font-bold text-studio-ink">
              Today we're learning {subject}, {kidName}!
            </h2>
            {contentStatus === 'generating' && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-studio-coral" />
                <p className="mt-2 text-sm font-semibold text-studio-ink/50">Making something fun…</p>
              </div>
            )}
            {contentStatus === 'error' && (
              <p className="py-6 text-sm font-semibold text-studio-coral">Could not load the lesson.</p>
            )}
            {contentStatus === 'ready' && content && (
              <div className="mt-3 w-full">
                <AnimatedLessonScene strand={strand} content={content} step={revealStep} playing={narrationPlaying} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}