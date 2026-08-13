import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';
import { Loader2, Play, Pause, RotateCw, ArrowRight, Home, Heart, Camera, Mic, Sparkles, Check } from 'lucide-react';
import LessonVideo from '@/components/LessonVideo';
import CountingCards from '@/components/CountingCards';
import CameraValidator from '@/components/CameraValidator';
import MicAssessment from '@/components/MicAssessment';
import SensoryButton from '@/components/SensoryButton';
import { Image } from '@/components/ui/image';
import { playOutro, playPraiseJingle, playSparkle } from '@/lib/sensoryAudio';

const COLORS = ['#FF9EC4', '#4969E1', '#FFE08A', '#4FAE5A', '#7B4FE0'];
const STAGES = ['intro', 'video', 'explain', 'assess', 'result'];
const STAGE_LABELS = ['Learn', 'Watch', 'Ready', 'Try', 'Done'];

// Fallback only if the AI didn't return an expert assessment — keeps the
// flow working while never overriding the age-appropriate AI choice.
function isVerbal(strand) { return strand === 'literacy' || strand === 'language'; }
function fallbackAction(strand) {
  if (strand === 'numeracy') return 'clap your hands three times';
  if (strand === 'music') return 'clap your hands';
  if (strand === 'sensory') return 'wave hello';
  return 'clap your hands';
}

function Zoodo({ size = 96, bounce }) {
  return (
    <motion.div
      animate={bounce ? { y: [0, -10, 0], rotate: [0, -4, 4, 0] } : { y: 0, rotate: 0 }}
      transition={bounce ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full">
        <defs>
          <radialGradient id="lfBody" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#FFD9E6" />
            <stop offset="100%" stopColor="#FF9EC4" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="62" r="50" fill="url(#lfBody)" stroke="#E07A9F" strokeWidth="3" />
        <circle cx="32" cy="72" r="8" fill="#FF8FA8" opacity="0.7" />
        <circle cx="88" cy="72" r="8" fill="#FF8FA8" opacity="0.7" />
        <circle cx="44" cy="56" r="6" fill="#3a2a3a" />
        <circle cx="76" cy="56" r="6" fill="#3a2a3a" />
        <circle cx="46" cy="54" r="2" fill="#fff" />
        <circle cx="78" cy="54" r="2" fill="#fff" />
        <path d="M44 74 Q60 88 76 74" stroke="#3a2a3a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d="M60 12 Q60 22 60 26" stroke="#E07A9F" strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="10" r="4" fill="#FFE08A" stroke="#E0A800" strokeWidth="2" />
      </svg>
    </motion.div>
  );
}

function StageDots({ stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div className="flex items-center justify-center gap-1.5">
      {STAGES.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition ${
            i <= idx ? 'bg-[#D96969] text-white' : 'bg-black/10 text-black/40'
          }`}>
            {i < idx ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
          </div>
          {i < STAGES.length - 1 && <div className={`h-0.5 w-4 ${i < idx ? 'bg-[#D96969]' : 'bg-black/10'}`} />}
        </div>
      ))}
    </div>
  );
}

export default function LessonFlow({ kidName, subject, strand, dayLabel, age, lesson, currentLetter, milestone, supportNeeds, onMastery, onUpdate, onComplete, onNotReady, onPlay }) {
  const [stage, setStage] = useState('intro');
  const [content, setContent] = useState(null);
  const [contentStatus, setContentStatus] = useState('generating');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState(null); // 'success' | 'needsHelp' | 'notReady'
  const [feedback, setFeedback] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [stars, setStars] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setContentStatus('generating'); setError('');
      try {
        const res = await base44.functions.invoke('generateLessonActivity', {
          subject, dayLabel, kidName, age, milestone, supportNeeds,
          currentLetter: strand === 'literacy' ? (currentLetter || 'A') : undefined,
        });
        if (cancelled) return;
        if (res?.data?.error) throw new Error(res.data.error);
        setContent(res.data);
        setContentStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || 'Could not create the activity.');
        setContentStatus('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, dayLabel, kidName, age]);

  useEffect(() => {
    if (stage === 'intro' && content?.audio_url && audioRef.current) {
      audioRef.current.play().then(() => { setPlaying(true); onPlay?.(); }).catch(() => {});
    }
  }, [stage, content]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); onPlay?.(); } else { a.pause(); setPlaying(false); }
  };

  const replayModel = () => {
    const a = audioRef.current;
    if (!a || !content?.audio_url) return;
    a.currentTime = 0; a.play(); setPlaying(true);
  };

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
      const n = attempts + 1;
      setAttempts(n);
      setResult('needsHelp');
      setStage('result');
    }
  };

  const tryAgain = () => { setResult(null); setFeedback(''); setStage('assess'); };
  const comeBackLater = () => { setResult('notReady'); setStage('result'); };
  const watchAgain = () => { setResult(null); setFeedback(''); setStage('video'); };

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <StageDots stage={stage} />

      {content?.audio_url && <audio ref={audioRef} src={content.audio_url} onEnded={() => setPlaying(false)} />}

      {/* ───────── INTRO ───────── */}
      {stage === 'intro' && (
        <div className="mt-3 flex flex-col items-center text-center">
          <Zoodo size={80} bounce={playing} />
          <h2 className="mt-2 text-lg font-bold text-black/80">
            Today we're learning {subject}, {kidName}!
          </h2>

          {contentStatus === 'generating' && (
            <div className="flex flex-col items-center py-6">
              <Loader2 className="h-7 w-7 animate-spin text-[#D96969]" />
              <p className="mt-2 text-sm font-semibold text-black/50">Making something fun…</p>
            </div>
          )}
          {contentStatus === 'error' && (
            <p className="py-4 text-sm font-semibold text-red-500">{error}</p>
          )}

          {contentStatus === 'ready' && content && (
            <>
              {/* Mouth model — "watch my mouth" */}
              {content.mouth_model_url && (
                <div className="mt-2 flex flex-col items-center rounded-2xl bg-gradient-to-b from-[#FFF6E6] to-white p-2.5 ring-1 ring-[#D96969]/10">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#D96969]">👄 Watch my mouth</div>
                  <Image src={content.mouth_model_url} alt={`Mouth showing the ${content.sound || content.letter} sound`} fittingType="fill" className="mt-1 h-24 w-24 rounded-2xl shadow-md ring-2 ring-[#D96969]/20" />
                  {content.phonetic_cue && <p className="mt-2 text-xs font-semibold text-black/50">{content.phonetic_cue}</p>}
                </div>
              )}

              {/* Visual scaffolding */}
              {(content.letter || content.picture_url) && (
                <div className="mt-2 rounded-2xl bg-[#FFF6E6] p-2">
                  <div className="flex items-center justify-center gap-2">
                    {content.letter && (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-4xl font-bold text-[#D96969] shadow-sm">
                        {content.letter}
                      </div>
                    )}
                    {content.picture_url && (
                      <Image src={content.picture_url} alt={content.word || content.title} fittingType="fill" className="h-16 w-16 shrink-0 rounded-2xl shadow-sm" />
                    )}
                    {content.word && <div className="text-xl font-bold text-black/70">{content.word}</div>}
                  </div>
                  {content.sound && (
                    <div className="mt-2 text-center text-sm font-bold text-[#D96969]">Say “{content.sound}” like {content.word}</div>
                  )}
                </div>
              )}
              {content.counting_cards && content.counting_cards.length >= 2 && (
                <div className="mt-3 w-full"><CountingCards cards={content.counting_cards} /></div>
              )}
              {content.bombardment_words && content.bombardment_words.length > 0 && (
                <div className="mt-2 w-full rounded-2xl bg-[#EEF2FF] p-2">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#4969E1]">Listen for the sound</div>
                  <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                    {content.bombardment_words.map((w, i) => (
                      <span key={i} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-[#4969E1] shadow-sm">{w}</span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={togglePlay}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4969E1] py-2.5 text-base font-bold text-white active:scale-[0.98] transition hover:bg-[#3b54c9]"
              >
                {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                {playing ? 'Pause' : 'Hear it again'}
              </button>

              <SensoryButton
                onClick={() => setStage('video')}
                glow="#7B4FE0"
                className="mt-2 flex w-full items-center justify-center gap-2 bg-[#7B4FE0] py-3 text-base text-white"
              >
                Let's watch how it's done! <ArrowRight className="h-5 w-5" />
              </SensoryButton>
            </>
          )}
        </div>
      )}

      {/* ───────── VIDEO ───────── */}
      {stage === 'video' && (
        <div className="mt-3">
          <LessonVideo
            kidName={kidName}
            age={age}
            milestone={milestone}
            supportNeeds={supportNeeds}
            subject={subject}
          />
          <SensoryButton
            onClick={() => setStage('explain')}
            glow="#F2A03D"
            className="mt-3 flex w-full items-center justify-center gap-2 bg-[#F2A03D] py-4 text-lg text-white"
          >
            I'm ready to try! <ArrowRight className="h-5 w-5" />
          </SensoryButton>
        </div>
      )}

      {/* ───────── EXPLAIN (post-video, caregiver prep) ───────── */}
      {stage === 'explain' && (
        <div className="mt-3 flex flex-col items-center text-center">
          {content?.gesture_url ? (
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold uppercase tracking-wide text-black/40">Watch the real way</span>
              <Image src={content.gesture_url} alt={assessTarget} fittingType="fill" className="mt-1 h-32 w-32 rounded-2xl shadow-sm" />
            </div>
          ) : (
            <Zoodo size={96} bounce />
          )}
          <h2 className="mt-2 text-lg font-bold text-black/80">Now it's your turn, {kidName}!</h2>
          <p className="mt-1 text-sm font-semibold text-black/50">
            Did you see how? Let's try it together — nice and slow.
          </p>
          <button
            onClick={replayModel}
            className="mt-2 inline-flex items-center gap-2 rounded-2xl border-2 border-black/10 bg-white px-4 py-2 text-sm font-bold text-black/60 active:scale-95"
          >
            <RotateCw className="h-4 w-4" /> Hear it again
          </button>
          {content?.phonetic_cue && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#EEF2FF] p-3 text-left">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#4969E1]" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-[#4969E1]">Therapist tip</span>
                <p className="text-xs font-semibold text-black/70">{content.phonetic_cue}</p>
              </div>
            </div>
          )}
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#FFF6E6] p-3 text-left">
            <Heart className="mt-0.5 h-4 w-4 shrink-0 text-[#D96969]" />
            <p className="text-xs font-semibold text-black/60">
              For the grown-up: help {kidName} get ready — sit together, give a big smile, and cheer them on!
            </p>
          </div>
          <SensoryButton
            onClick={() => setStage('assess')}
            glow="#4FAE5A"
            className="mt-3 flex w-full items-center justify-center gap-2 bg-[#4FAE5A] py-4 text-lg text-white"
          >
            Ready to try? <ArrowRight className="h-5 w-5" />
          </SensoryButton>
        </div>
      )}

      {/* ───────── ASSESS ───────── */}
      {stage === 'assess' && (
        <div className="mt-3">
          <div className="flex items-center justify-center gap-2 text-black/40">
            {verbal ? <Mic className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            <span className="text-xs font-bold uppercase tracking-wide">
              {verbal ? 'Say it for me!' : 'Show me!'}
            </span>
          </div>
          {!verbal && content?.gesture_url && (
            <div className="mb-2 flex flex-col items-center">
              <span className="text-xs font-semibold text-black/50">Copy the real hand</span>
              <Image src={content.gesture_url} alt={assessTarget} fittingType="fill" className="mt-1 h-24 w-24 rounded-2xl shadow-sm" />
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
        <div className="mt-3 flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            {result === 'success' && (
              <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                <Zoodo size={120} bounce />
                <h2 className="mt-2 text-2xl font-bold text-[#4FAE5A]">You did it, {kidName}!</h2>
                <div className="mt-1 flex items-center gap-1">
                  {Array.from({ length: Math.max(1, stars) }).map((_, i) => (
                    <Sparkles key={i} className="h-5 w-5 text-[#FFE08A] fill-[#FFE08A]" />
                  ))}
                </div>
                {feedback && <p className="mt-2 rounded-2xl bg-green-100 px-4 py-2 text-sm font-bold text-green-700">{feedback}</p>}
                <SensoryButton
                  onClick={() => onComplete?.()}
                  glow="#D96969"
                  className="mt-4 flex w-full items-center justify-center gap-2 bg-[#D96969] py-4 text-lg text-white"
                >
                  <Sparkles className="h-5 w-5" /> See your cheer!
                </SensoryButton>
              </motion.div>
            )}

            {result === 'needsHelp' && (
              <motion.div key="needsHelp" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex w-full flex-col items-center">
                <Zoodo size={96} bounce={false} />
                <h2 className="mt-2 text-xl font-bold text-[#F2A03D]">Let's try that again!</h2>
                <p className="mt-1 text-sm font-semibold text-black/50">
                  That one was a little tricky. That's okay — we learn by trying!
                </p>
                {feedback && <p className="mt-2 rounded-2xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700">{feedback}</p>}
                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#FFF6E6] p-3 text-left">
                  <Heart className="mt-0.5 h-4 w-4 shrink-0 text-[#D96969]" />
                  <p className="text-xs font-semibold text-black/60">
                    Grown-up: help {kidName} try again — model it slowly, then let them copy you.
                  </p>
                </div>
                <div className="mt-3 flex w-full gap-2">
                  <button onClick={watchAgain} className="flex-1 rounded-2xl border-2 border-black/10 bg-white py-3 font-bold text-black/60 active:scale-95">
                    Watch again
                  </button>
                  <SensoryButton onClick={tryAgain} glow="#4969E1" className="flex-[2] bg-[#4969E1] py-3 text-white">
                    Try again
                  </SensoryButton>
                </div>
                <button onClick={comeBackLater} className="mt-2 text-sm font-semibold text-black/40 underline underline-offset-2">
                  Come back later
                </button>
              </motion.div>
            )}

            {result === 'notReady' && (
              <motion.div key="notReady" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex w-full flex-col items-center">
                <Zoodo size={96} bounce={false} />
                <h2 className="mt-2 text-xl font-bold text-black/70">Good try, {kidName}!</h2>
                <p className="mt-1 text-sm font-semibold text-black/50">
                  Let's revisit this later. You're doing great!
                </p>
                <SensoryButton
                  onClick={() => onNotReady?.()}
                  glow="#4969E1"
                  className="mt-4 flex w-full items-center justify-center gap-2 bg-[#4969E1] py-4 text-lg text-white"
                >
                  <Home className="h-5 w-5" /> Back to home
                </SensoryButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}