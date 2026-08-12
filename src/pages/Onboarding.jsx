import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles, Camera, Check, Loader2 } from 'lucide-react';

const AGES = [2, 3, 4, 5, 6, 7, 8];

// First screen: the caregiver enters the child's name + age before the plan appears.
export default function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [age, setAge] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('form');
  const [camStream, setCamStream] = useState(null);
  const [camStatus, setCamStatus] = useState('asking');
  const videoRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter the child\'s name');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await base44.entities.Kid.create({ name: trimmed, age: Number(age) });
      setStep('camera');
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

  const finish = () => navigate('/');

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
            onClick={finish}
            disabled={camStatus === 'asking'}
            className="mt-6 w-full rounded-2xl bg-[#7B4FE0] py-6 text-lg font-bold text-white hover:bg-[#6a3fd0] disabled:opacity-60"
          >
            {camStatus === 'asking' ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Asking for permission…</span>
            ) : camStatus === 'ready' ? 'Continue to home' : 'Continue'}
          </Button>
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
          Weekly<br />Lesson Plan
        </h1>
        <p className="mt-3 text-black/60 font-medium">
          Let's set up a playful learning week. Who are we learning with today?
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
              Child's age <span className="text-black/40 font-normal">— this sets the level</span>
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