import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Camera, Check, Loader2, ArrowRight, Heart } from 'lucide-react';
import KidAvatar from '@/components/KidAvatar';
import ParentVideoRecorder from '@/components/ParentVideoRecorder';

const AGES = [2, 3, 4, 5, 6, 7, 8];
const PROGRAM_LENGTHS = [4, 8, 12, 16];

// First-run intake: a cute Zoodo intro, then a short questionnaire (name, age,
// program length, developmental milestone), then camera permission — all before
// the home page launches. Activities are generated based on the child's age.
export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState('intro'); // intro | form | camera
  const [name, setName] = useState('');
  const [age, setAge] = useState(4);
  const [programLength, setProgramLength] = useState(8);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [camStream, setCamStream] = useState(null);
  const [camStatus, setCamStatus] = useState('asking');
  const [introAudio, setIntroAudio] = useState('');
  const [uploading, setUploading] = useState(false);
  const [kidId, setKidId] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const videoRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter the child's name");
      return;
    }
    setSaving(true);
    setError('');
    try {
      const kid = await base44.entities.Kid.create({
        name: trimmed,
        age: Number(age),
        program_length: Number(programLength),
      });
      setKidId(kid.id);
      setStep('parent');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-request camera (+ mic) permission before the home page launches.
  useEffect(() => {
    if (step !== 'camera') return;
    let active = null;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
        active = s; setCamStream(s); setCamStatus('ready');
      } catch (e) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
          active = s; setCamStream(s); setCamStatus('ready');
        } catch (e2) { setCamStatus('denied'); }
      }
    })();
    return () => { if (active) active.getTracks().forEach((t) => t.stop()); };
  }, [step]);

  useEffect(() => {
    if (videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
      videoRef.current.play().catch(() => {});
    }
  }, [camStream]);

  // Fetch the lady-voice intro line so Zoodo speaks in the same voice as the app.
  useEffect(() => {
    if (step !== 'intro') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('generateSpeech', {
          text: "Hi! I'm Zoodo! Let's learn and play together!",
        });
        if (!cancelled && res?.data?.audio_url) setIntroAudio(res.data.audio_url);
      } catch (e) { /* ignore — Zoodo stays silent rather than use another voice */ }
    })();
    return () => { cancelled = true; };
  }, [step]);

  const saveParentVideo = async (file) => {
    if (!file || !kidId) { setStep('camera'); return; }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Kid.update(kidId, { parent_video_url: file_url });
    } catch (e) { /* non-fatal — celebration still works without it */ }
    setUploading(false);
    setStep('camera');
  };

  const startCountdown = () => {
    let n = 3;
    setCountdown(n);
    const tick = () => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
        setTimeout(tick, 800);
      } else {
        setCountdown(0);
        navigate('/');
      }
    };
    setTimeout(tick, 800);
  };

  const finish = () => navigate('/');

  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFFDF8] to-[#FDE9F0] flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
          <Sparkles className="h-6 w-6 text-[#D96969]" />
        </div>
        <KidAvatar greeting="Hi! I'm Zoodo! Let's learn and play together!" audioUrl={introAudio} size={180} />
        <h1 className="mt-6 text-4xl font-bold" style={{ color: '#7B4FE0' }}>
          Meet Zoodo!
        </h1>
        <p className="mt-3 max-w-sm text-black/60 font-medium">
          I'm your silly, giggly learning buddy! I'll make a fun plan just for your
          little one — full of music, movement, and bubbles!
        </p>
        <Button
          onClick={() => setStep('form')}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#7B4FE0] px-8 py-6 text-lg font-bold text-white hover:bg-[#6a3fd0]"
        >
          Let's go! <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  if (step === 'parent') {
    return (
      <div className="min-h-screen bg-[#FFFDF8] flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#FAD7D7]">
            <Heart className="h-8 w-8 text-[#D96969]" />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: '#D96969' }}>Record a cheer</h1>
          <p className="mt-2 text-black/60 font-medium">
            Record a short video of you saying the cheer. At the end of every
            lesson it'll play so {name || 'your child'} hears it from you!
          </p>

          <div className="mt-5">
            {uploading ? (
              <div className="flex flex-col items-center gap-2 py-10 text-black/50 font-semibold">
                <Loader2 className="h-7 w-7 animate-spin text-[#D96969]" /> Saving your cheer…
              </div>
            ) : (
              <ParentVideoRecorder
                cheer={`Yes! You did it, ${name || 'friend'}!`}
                onRecorded={saveParentVideo}
              />
            )}
          </div>

          <button
            onClick={() => setStep('camera')}
            className="mt-4 text-sm font-bold text-black/40 underline"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  if (step === 'camera') {
    return (
      <div className="min-h-screen bg-[#FFFDF8] flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#EDE6FF]">
            <Camera className="h-8 w-8 text-[#7B4FE0]" />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: '#7B4FE0' }}>Turn on the camera</h1>
          <p className="mt-2 text-black/60 font-medium">
            Zoodo uses the camera to cheer your child on during activities. Let's allow it now!
          </p>
          <div className="relative mx-auto mt-6 aspect-video w-full max-w-sm overflow-hidden rounded-3xl bg-black/10 shadow-inner">
            {camStatus === 'denied' ? (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm font-semibold text-black/50">
                Camera is off — that's okay, you can still play! You can enable it later.
              </div>
            ) : (
              <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
            )}
            {camStatus === 'ready' && (
              <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green-500 px-2.5 py-1 text-xs font-bold text-white shadow">
                <Check className="h-3.5 w-3.5" strokeWidth={3} /> Ready
              </span>
            )}
          </div>
          <Button
            onClick={startCountdown}
            disabled={camStatus === 'asking' || countdown > 0}
            className="mt-6 w-full rounded-2xl bg-[#7B4FE0] py-6 text-lg font-bold text-white hover:bg-[#6a3fd0] disabled:opacity-60"
          >
            {camStatus === 'asking' ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Asking for permission…</span>
            ) : 'Ready to record'}
          </Button>
          {countdown > 0 && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <span className="text-8xl font-bold text-white animate-ping-slow">{countdown}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#FAD7D7]">
          <Sparkles className="h-8 w-8 text-[#D96969]" />
        </div>
        <h1
          className="text-4xl font-bold leading-tight"
          style={{ color: '#D96969' }}
        >
          Let's set up<br />the week
        </h1>
        <p className="mt-3 text-black/60 font-medium">
          A few quick questions so Zoodo can tailor the fun to your child.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5 text-left">
          <div>
            <label className="block text-sm font-semibold text-black/70 mb-1.5">
              Child's name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Avi"
              className="w-full rounded-2xl border-2 border-black/10 bg-white px-4 py-3 text-lg font-semibold text-black placeholder:text-black/30 focus:border-[#4969E1] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-black/70 mb-2">
              Child's age <span className="text-black/40 font-normal">— sets the level</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AGES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAge(a)}
                  className={`h-12 w-12 rounded-2xl text-lg font-bold transition active:scale-95 ${
                    age === a
                      ? 'bg-[#4969E1] text-white border-2 border-[#4969E1] shadow'
                      : 'bg-white text-black/70 border-2 border-black/10 hover:border-[#4969E1]/50'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-black/70 mb-2">
              Program length <span className="text-black/40 font-normal">— weeks</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PROGRAM_LENGTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setProgramLength(w)}
                  className={`h-12 min-w-[3.5rem] rounded-2xl px-3 text-lg font-bold transition active:scale-95 ${
                    programLength === w
                      ? 'bg-[#7B4FE0] text-white border-2 border-[#7B4FE0] shadow'
                      : 'bg-white text-black/70 border-2 border-black/10 hover:border-[#7B4FE0]/50'
                  }`}
                >
                  {w}w
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm font-semibold text-red-500">{error}</p>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-[#4969E1] py-6 text-lg font-bold text-white hover:bg-[#3b54c9] disabled:opacity-60"
          >
            {saving ? 'Setting up…' : 'Start the week'}
          </Button>
        </form>
      </div>
    </div>
  );
}