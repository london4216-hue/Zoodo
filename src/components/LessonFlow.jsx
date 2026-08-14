import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';
import { Loader2, Mic, Camera, Home, Heart, Sparkles, Check } from 'lucide-react';
import CameraValidator from '@/components/CameraValidator';
import MicAssessment from '@/components/MicAssessment';
import SensoryButton from '@/components/SensoryButton';
import ZoodoAvatar2D from '@/components/ZoodoAvatar2D';
import AnimatedLessonScene from '@/components/AnimatedLessonScene';
import { Image } from '@/components/ui/image';
import { playOutro, playPraiseJingle, playSparkle, duckMusic, unDuckMusic } from '@/lib/sensoryAudio';
import { unlockAudio } from '@/lib/audioUnlock';

const COLORS = ['#E8B14A', '#E26D6D', '#FBF7EE', '#4969E1', '#4FAE5A'];
// Hybrid flow: Zoodo intro (auto-plays) → continuous teaching narration over an
// animated scene → participation assessment → result. No mid-lesson YouTube;
// the mic/camera check is the final step before the parent celebration.
const STAGES = ['intro', 'assess', 'result'];

function isVerbal(strand) { return strand === 'literacy' || strand === 'language'; }
function fallbackAction(strand) {
  if (strand === 'numeracy') return 'clap your hands three times';
  if (strand === 'music') return 'clap your hands';
  if (strand === 'sensory') return 'wave hello';
  return 'clap your hands';
}

function Zoodo({ size = 96, bounce, talking }) {
  return (
    <div className="relative flex justify-center">
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(232,177,74,0.30), rgba(232,177,74,0) 70%)' }}
      />
      <ZoodoAvatar2D size={size} bounce={bounce} talking={talking} />
    </div>
  );
}

function StageDots({ stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div className="flex items-center justify-center gap-1.5">
      {STAGES.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition ${
            i <= idx ? 'bg-studio-coral text-white' : 'bg-studio-ink/10 text-studio-ink/40'
          }`}>
            {i < idx ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
          </div>
          {i < STAGES.length - 1 && <div className={`h-0.5 w-4 ${i < idx ? 'bg-studio-coral' : 'bg-studio-ink/10'}`} />}
        </div>
      ))}
    </div>
  );
}

export default function LessonFlow({
  kidName, subject, strand, dayLabel, age, lesson, currentLetter, milestone, supportNeeds,
  onMastery, onPersistContent, onComplete, onNotReady,
}) {
  const [stage, setStage] = useState('intro');
  const [content, setContent] = useState(null);
  const [contentStatus, setContentStatus] = useState('generating');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [stars, setStars] = useState(0);
  const [revealStep, setRevealStep] = useState(0);
  const [introPhase, setIntroPhase] = useState('zoodo');
  // null = still fetching, {} = fetched but no audio, { audio_url, script } = ready
  const [greeting, setGreeting] = useState(null);
  const [greetingPlaying, setGreetingPlaying] = useState(false);
  const audioRef = useRef(null);
  const greetingRef = useRef(null);
  const pacingRef = useRef(null);

  // Safety net: prime audio on mount (the day-card click already did it).
  useEffect(() => { unlockAudio(); }, []);

  const revealCards = content ? [
    ...(content.letter ? [{ kind: 'letter' }] : []),
    ...(content.picture_url ? [{ kind: 'picture' }] : []),
    ...(content.word ? [{ kind: 'word' }] : []),
    ...(content.sound ? [{ kind: 'sound' }] : []),
    ...(content.bombardment_words?.length ? [{ kind: 'bombardment' }] : []),
  ] : [];
  const counting = content?.counting_cards && content.counting_cards.length >= 2 ? content.counting_cards : null;
  const sceneSteps = counting ? counting.length : (revealCards.length || 1);

  const goToAssess = () => {
    if (pacingRef.current) { clearInterval(pacingRef.current); pacingRef.current = null; }
    setStage('assess');
  };

  // Load cached activity or generate + cache. Greeting is always fetched fresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError('');
      if (lesson?.activity_content) {
        setContent(lesson.activity_content);
        setContentStatus('ready');
        setRevealStep(0);
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
          setRevealStep(0);
          setContentStatus('ready');
          onPersistContent?.(res.data);
        } catch (err) {
          if (cancelled) return;
          setError(err?.message || 'Could not create the activity.');
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

  // Auto-play Zoodo's greeting the moment it's ready — no extra tap. Retry on
  // reject (autoplay can be flaky right after navigation); if it never plays,
  // advance to the lesson so the flow never stalls on a button.
  useEffect(() => {
    if (stage !== 'intro' || introPhase !== 'zoodo') return;
    if (!greeting || !greeting.audio_url || !greetingRef.current) return;
    const a = greetingRef.current;
    let cancelled = false;
    const tryPlay = (retries = 3) => {
      a.play().then(() => setGreetingPlaying(true)).catch(() => {
        if (!cancelled && retries > 0) setTimeout(() => tryPlay(retries - 1), 350);
      });
    };
    tryPlay();
    const t = setTimeout(() => { if (!cancelled && a.paused) setIntroPhase('vo'); }, 6500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [stage, introPhase, greeting]);

  // No greeting audio (fetch failed) — show the text briefly, then start.
  useEffect(() => {
    if (stage !== 'intro' || introPhase !== 'zoodo') return;
    if (!greeting || greeting.audio_url) return;
    const t = setTimeout(() => setIntroPhase('vo'), 2600);
    return () => clearTimeout(t);
  }, [stage, introPhase, greeting]);

  // Teaching phase: play the narration VO continuously, auto-advancing the
  // animated scene paced to the VO duration, then go to the assessment. If
  // autoplay is blocked or audio is missing, advance on a timer instead.
  useEffect(() => {
    if (stage !== 'intro' || introPhase !== 'vo') return;
    if (contentStatus !== 'ready' || !content) return;
    const n = sceneSteps || 1;
    let fallbackTimer = null;
    const clearPacing = () => { if (pacingRef.current) { clearInterval(pacingRef.current); pacingRef.current = null; } };
    const runTimerFallback = () => {
      setRevealStep(0);
      clearPacing();
      pacingRef.current = setInterval(() => setRevealStep((s) => (s + 1 >= n ? s : s + 1)), 3500);
      fallbackTimer = setTimeout(() => { if (stage === 'intro') goToAssess(); }, n * 3500 + 600);
    };
    if (!content.audio_url || !audioRef.current) {
      runTimerFallback();
    } else {
      const a = audioRef.current;
      const startPacing = () => {
        const dur = a.duration && isFinite(a.duration) ? a.duration : 0;
        const interval = dur > 0 ? (dur * 1000) / n : 3500;
        setRevealStep(0);
        clearPacing();
        pacingRef.current = setInterval(() => setRevealStep((s) => (s + 1 >= n ? s : s + 1)), interval);
      };
      a.play()
        .then(() => { setPlaying(true); duckMusic(); if (a.readyState >= 1) startPacing(); })
        .catch(() => runTimerFallback());
      if (a.readyState >= 1) startPacing();
      else a.addEventListener('loadedmetadata', startPacing, { once: true });
    }
    return () => { clearPacing(); if (fallbackTimer) clearTimeout(fallbackTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, introPhase, content, contentStatus]);

  const assess = content?.assessment;
  const verbal = assess ? assess.mode === 'mic' : isVerbal(strand);
  const assessTarget = assess?.target
    || (verbal ? (content?.sound || content?.word || subject) : fallbackAction(strand));

  const handleAssessResult = (success, fb) => {
    setFeedback(fb || '');
    if (success) {
      setResult('success');
      setStage('result');
      setStars((s) => s + 1);
      playPraiseJingle(); playSparkle();
      confetti({ particleCount: 140, spread: 110, origin: { y: 0.5 }, colors: COLORS });
      playOutro();
      if (strand === 'literacy' && currentLetter) {
        const code = currentLetter.charCodeAt(0);
        if (code < 90) onMastery?.(String.fromCharCode(code + 1));
      }
    } else {
      setResult('needsHelp');
      setStage('result');
    }
  };

  const tryAgain = () => { setResult(null); setFeedback(''); setStage('assess'); };
  const comeBackLater = () => { setResult('notReady'); setStage('result'); };

  return (
    <div className="rounded-3xl bg-studio-card p-3 shadow-2xl max-h-full overflow-hidden">
      <StageDots stage={stage} />

      {greeting?.audio_url && (
        <audio
          ref={greetingRef}
          src={greeting.audio_url}
          onPlay={() => { duckMusic(); setGreetingPlaying(true); }}
          onEnded={() => { setGreetingPlaying(false); unDuckMusic(); setIntroPhase('vo'); }}
        />
      )}
      {content?.audio_url && (
        <audio
          ref={audioRef}
          src={content.audio_url}
          onPlay={() => { duckMusic(); setPlaying(true); }}
          onEnded={() => {
            unDuckMusic(); setPlaying(false);
            setRevealStep((sceneSteps || 1) - 1);
            setTimeout(() => { if (stage === 'intro') goToAssess(); }, 1000);
          }}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
        {/* ───────── INTRO ───────── */}
        {stage === 'intro' && (
          <div className="mt-2 flex flex-col items-center text-center">
            <AnimatePresence mode="wait">
              {/* Phase 1 — Zoodo's silly intro greeting (auto-plays) */}
              {introPhase === 'zoodo' && (
                <motion.div
                  key="zoodo-intro"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, y: -12 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex w-full flex-col items-center"
                >
                  <Zoodo size={88} talking={greetingPlaying} />
                  <h2 className="mt-2 max-w-xs text-base font-bold leading-snug text-studio-ink line-clamp-3">
                    {greeting?.script || `Hi ${kidName}! Today we're learning ${subject}!`}
                  </h2>
                  {greeting === null && (
                    <div className="flex flex-col items-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-studio-coral" />
                      <p className="mt-2 text-sm font-semibold text-studio-ink/50">Zoodo's getting ready…</p>
                    </div>
                  )}
                  {contentStatus === 'error' && (
                    <p className="py-4 text-sm font-semibold text-studio-coral">{error}</p>
                  )}
                </motion.div>
              )}

              {/* Phase 2 — continuous teaching narration over an animated scene */}
              {introPhase === 'vo' && (
                <motion.div
                  key="vo"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex w-full flex-col items-center"
                >
                  <h2 className="text-lg font-bold text-studio-ink">
                    Today we're learning {subject}, {kidName}!
                  </h2>
                  {contentStatus === 'generating' && (
                    <div className="flex flex-col items-center py-6">
                      <Loader2 className="h-7 w-7 animate-spin text-studio-coral" />
                      <p className="mt-2 text-sm font-semibold text-studio-ink/50">Making something fun…</p>
                    </div>
                  )}
                  {contentStatus === 'error' && (
                    <p className="py-4 text-sm font-semibold text-studio-coral">{error}</p>
                  )}
                  {contentStatus === 'ready' && content && (
                    <div className="mt-3 w-full">
                      <AnimatedLessonScene strand={strand} content={content} step={revealStep} playing={playing} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ───────── ASSESS ───────── */}
        {stage === 'assess' && (
          <div className="mt-4">
            <div className="flex items-center justify-center gap-2 text-studio-ink/40">
              {verbal ? <Mic className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              <span className="text-xs font-bold uppercase tracking-wide">
                {verbal ? 'Say it for me!' : 'Show me!'}
              </span>
            </div>
            {!verbal && content?.gesture_url && (
              <div className="mb-2 flex flex-col items-center">
                <span className="text-xs font-semibold text-studio-ink/50">Copy the real hand</span>
                <Image src={content.gesture_url} alt={assessTarget} fittingType="fill" className="mt-1 h-20 w-20 rounded-2xl shadow-sm" />
              </div>
            )}
            {verbal ? (
              <MicAssessment kidName={kidName} target={assessTarget} onResult={handleAssessResult} />
            ) : (
              <CameraValidator
                inline
                targetAction={assessTarget}
                kidName={kidName}
                onSuccess={() => handleAssessResult(true, `Great job, ${kidName}!`)}
                onFail={(fb) => handleAssessResult(false, fb)}
              />
            )}
          </div>
        )}

        {/* ───────── RESULT ───────── */}
        {stage === 'result' && (
          <div className="mt-2 flex flex-col items-center text-center">
            <AnimatePresence mode="wait">
              {result === 'success' && (
                <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                  <Zoodo size={96} bounce />
                  <h2 className="mt-2 text-2xl font-bold text-studio-gold">You did it, {kidName}!</h2>
                  <div className="mt-1 flex items-center gap-1">
                    {Array.from({ length: Math.max(1, stars) }).map((_, i) => (
                      <Sparkles key={i} className="h-5 w-5 text-studio-gold fill-studio-gold" />
                    ))}
                  </div>
                  {feedback && <p className="mt-2 rounded-2xl bg-studio-gold/15 px-4 py-2 text-sm font-bold text-studio-ink">{feedback}</p>}
                  <SensoryButton
                    onClick={() => onComplete?.()}
                    glow="#E26D6D"
                    className="mt-4 flex w-full items-center justify-center gap-2 bg-studio-coral py-4 text-lg text-white"
                  >
                    <Sparkles className="h-5 w-5" /> See your cheer!
                  </SensoryButton>
                </motion.div>
              )}

              {result === 'needsHelp' && (
                <motion.div key="needsHelp" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex w-full flex-col items-center">
                  <Zoodo size={96} bounce={false} />
                  <h2 className="mt-2 text-xl font-bold text-studio-coral">Let's try that again!</h2>
                  <p className="mt-1 text-sm font-semibold text-studio-ink/50">
                    That one was a little tricky. That's okay — we learn by trying!
                  </p>
                  {feedback && <p className="mt-2 rounded-2xl bg-studio-coral/10 px-4 py-2 text-sm font-bold text-studio-coral">{feedback}</p>}
                  <div className="mt-3 flex items-start gap-2 rounded-2xl bg-studio-gold/10 p-3 text-left">
                    <Heart className="mt-0.5 h-4 w-4 shrink-0 text-studio-coral" />
                    <p className="text-xs font-semibold text-studio-ink/60">
                      Grown-up: help {kidName} try again — model it slowly, then let them copy you.
                    </p>
                  </div>
                  <div className="mt-3 flex w-full gap-2">
                    <button onClick={comeBackLater} className="flex-1 rounded-2xl border border-studio-ink/15 bg-white py-3 font-bold text-studio-ink/60 active:scale-95">
                      Come back later
                    </button>
                    <SensoryButton onClick={tryAgain} glow="#E26D6D" className="flex-[2] bg-studio-coral py-3 text-white">
                      Try again
                    </SensoryButton>
                  </div>
                </motion.div>
              )}

              {result === 'notReady' && (
                <motion.div key="notReady" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex w-full flex-col items-center">
                  <Zoodo size={96} bounce={false} />
                  <h2 className="mt-2 text-xl font-bold text-studio-ink/70">Good try, {kidName}!</h2>
                  <p className="mt-1 text-sm font-semibold text-studio-ink/50">
                    Let's revisit this later. You're doing great!
                  </p>
                  <SensoryButton
                    onClick={() => onNotReady?.()}
                    glow="#E26D6D"
                    className="mt-4 flex w-full items-center justify-center gap-2 bg-studio-coral py-4 text-lg text-white"
                  >
                    <Home className="h-5 w-5" /> Back to home
                  </SensoryButton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}