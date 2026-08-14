import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { base44 } from '@/api/base44Client';
import { Loader2, Play, Mic, Camera, Home, Heart, Sparkles, Check } from 'lucide-react';
import CountingCards from '@/components/CountingCards';
import CameraValidator from '@/components/CameraValidator';
import MicAssessment from '@/components/MicAssessment';
import SensoryButton from '@/components/SensoryButton';
import ZoodoAvatar2D from '@/components/ZoodoAvatar2D';
import { Image } from '@/components/ui/image';
import { playOutro, playPraiseJingle, playSparkle, duckMusic, unDuckMusic } from '@/lib/sensoryAudio';

const COLORS = ['#E8B14A', '#E26D6D', '#FBF7EE', '#4969E1', '#4FAE5A'];
// Hybrid flow: Zoodo intro → continuous teaching narration over reveal cards →
// participation assessment → result. (No mid-lesson YouTube; the mic/camera
// check is the final step before the parent celebration.)
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
  const [voDone, setVoDone] = useState(false);
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [stars, setStars] = useState(0);
  const [revealStep, setRevealStep] = useState(0);
  const [introPhase, setIntroPhase] = useState('zoodo');
  const [greeting, setGreeting] = useState(null);
  const [greetingPlaying, setGreetingPlaying] = useState(false);
  const audioRef = useRef(null);
  const greetingRef = useRef(null);
  const pacingRef = useRef(null);

  const revealCards = content ? [
    ...(content.letter ? [{ kind: 'letter' }] : []),
    ...(content.picture_url ? [{ kind: 'picture' }] : []),
    ...(content.word ? [{ kind: 'word' }] : []),
    ...(content.sound ? [{ kind: 'sound' }] : []),
    ...(content.bombardment_words?.length ? [{ kind: 'bombardment' }] : []),
  ] : [];

  // Load cached activity if present; otherwise generate + cache it. Greeting
  // is always fetched (lightweight) so Zoodo's intro VO is fresh.
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
        const gres = await base44.functions.invoke('generateGreeting', { kidName, subject, day: dayLabel });
        if (!cancelled && gres?.data?.audio_url) setGreeting(gres.data);
      } catch (e) { /* greeting optional */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, dayLabel, kidName, age]);

  // Play Zoodo's intro greeting as soon as it's ready.
  useEffect(() => {
    if (stage === 'intro' && introPhase === 'zoodo' && greeting?.audio_url && greetingRef.current) {
      greetingRef.current.play().then(() => setGreetingPlaying(true)).catch(() => {});
    }
  }, [stage, introPhase, greeting]);

  // Teaching phase: one continuous narration VO plays over the reveal cards,
  // auto-advancing the cards paced to the VO duration, then transitions to the
  // assessment when the narration ends.
  useEffect(() => {
    if (stage !== 'intro' || introPhase !== 'vo') return;
    if (!content?.audio_url || !audioRef.current) return;
    const a = audioRef.current;
    const startPacing = () => {
      const dur = a.duration && isFinite(a.duration) ? a.duration : 0;
      const n = revealCards.length || 1;
      const interval = dur > 0 ? (dur * 1000) / n : 3500;
      setRevealStep(0);
      if (pacingRef.current) clearInterval(pacingRef.current);
      pacingRef.current = setInterval(() => {
        setRevealStep((s) => (s + 1 >= revealCards.length ? s : s + 1));
      }, interval);
    };
    a.play().then(() => { setPlaying(true); duckMusic(); }).catch(() => {});
    if (a.readyState >= 1) startPacing();
    else a.addEventListener('loadedmetadata', startPacing, { once: true });
    return () => {
      if (pacingRef.current) { clearInterval(pacingRef.current); pacingRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, introPhase, content]);

  const playGreeting = () => {
    const a = greetingRef.current;
    if (!a) { setIntroPhase('vo'); return; }
    a.play().then(() => setGreetingPlaying(true)).catch(() => setIntroPhase('vo'));
  };

  const goToAssess = () => {
    if (pacingRef.current) { clearInterval(pacingRef.current); pacingRef.current = null; }
    setVoDone(false);
    setStage('assess');
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
      setAttempts((n) => n + 1);
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
            setRevealStep(revealCards.length - 1);
            setVoDone(true);
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
              {/* Phase 1 — Zoodo's silly intro greeting */}
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
                  {!greeting?.audio_url && contentStatus === 'generating' && (
                    <div className="flex flex-col items-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-studio-coral" />
                      <p className="mt-2 text-sm font-semibold text-studio-ink/50">Zoodo's getting ready…</p>
                    </div>
                  )}
                  {greeting?.audio_url && !greetingPlaying && (
                    <SensoryButton
                      onClick={playGreeting}
                      glow="#E8B14A"
                      className="mt-4 flex items-center justify-center gap-2 bg-studio-gold px-6 py-3 text-studio-ink"
                    >
                      <Play className="h-5 w-5" /> Tap to say hi!
                    </SensoryButton>
                  )}
                  {!greeting?.audio_url && contentStatus === 'ready' && (
                    <SensoryButton
                      onClick={() => setIntroPhase('vo')}
                      glow="#E8B14A"
                      className="mt-4 flex items-center justify-center gap-2 bg-studio-gold px-6 py-3 text-studio-ink"
                    >
                      <Play className="h-5 w-5" /> Let's start!
                    </SensoryButton>
                  )}
                  {contentStatus === 'error' && (
                    <p className="py-4 text-sm font-semibold text-studio-coral">{error}</p>
                  )}
                </motion.div>
              )}

              {/* Phase 2 — continuous teaching narration over reveal cards */}
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
                    <>
                      {content.counting_cards && content.counting_cards.length >= 2 ? (
                        <div className="mt-3 w-full"><CountingCards cards={content.counting_cards} /></div>
                      ) : (
                        <div className="mt-3 flex w-full flex-col items-center">
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={revealStep}
                              initial={{ opacity: 0, scale: 0.85, y: 8 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.85, y: -8 }}
                              transition={{ duration: 0.35, ease: 'easeOut' }}
                              className="flex w-full flex-col items-center"
                            >
                              {revealCards[revealStep]?.kind === 'letter' && (
                                <div className="flex flex-col items-center rounded-2xl bg-studio-gold/10 p-3">
                                  <span className="text-xs font-bold uppercase tracking-wide text-studio-ink/40">This is the letter</span>
                                  <div className="mt-1 flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-5xl font-bold text-studio-coral shadow-md">
                                    {content.letter}
                                  </div>
                                </div>
                              )}
                              {revealCards[revealStep]?.kind === 'picture' && (
                                <div className="flex flex-col items-center rounded-2xl bg-studio-gold/10 p-3">
                                  <span className="text-xs font-bold uppercase tracking-wide text-studio-ink/40">Look at this!</span>
                                  <Image src={content.picture_url} alt={content.word || content.title} fittingType="fill" className="mt-1 h-20 w-20 rounded-2xl shadow-md" />
                                </div>
                              )}
                              {revealCards[revealStep]?.kind === 'word' && (
                                <div className="flex flex-col items-center rounded-2xl bg-studio-gold/10 p-3">
                                  <span className="text-xs font-bold uppercase tracking-wide text-studio-ink/40">This word says</span>
                                  <div className="mt-1 text-3xl font-bold text-studio-ink">{content.word}</div>
                                </div>
                              )}
                              {revealCards[revealStep]?.kind === 'sound' && (
                                <div className="flex flex-col items-center rounded-2xl bg-studio-gold/10 p-3">
                                  <span className="text-xs font-bold uppercase tracking-wide text-studio-ink/40">Say this sound</span>
                                  <div className="mt-1 text-4xl font-bold text-studio-coral">“{content.sound}”</div>
                                  <div className="mt-1 text-sm font-semibold text-studio-ink/50">like {content.word}</div>
                                </div>
                              )}
                              {revealCards[revealStep]?.kind === 'bombardment' && (
                                <div className="w-full rounded-2xl bg-studio-coral/10 p-3">
                                  <div className="text-center text-xs font-bold uppercase tracking-wide text-studio-coral">Listen for the sound</div>
                                  <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                                    {content.bombardment_words.map((w, i) => (
                                      <span key={i} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-studio-coral shadow-sm">{w}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          </AnimatePresence>

                          <div className="mt-3 flex items-center gap-2 text-studio-ink/40">
                            {playing ? (
                              <>
                                <span className="flex h-2 w-2 rounded-full bg-studio-coral animate-pulse" />
                                <span className="text-xs font-semibold">Listening…</span>
                              </>
                            ) : (voDone || !content?.audio_url) ? (
                              <SensoryButton
                                onClick={goToAssess}
                                glow="#E8B14A"
                                className="flex items-center justify-center gap-2 bg-studio-gold px-6 py-2.5 text-studio-ink"
                              >
                                Ready to try! <Play className="h-4 w-4" />
                              </SensoryButton>
                            ) : (
                              <span className="text-xs font-semibold">Listening…</span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
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