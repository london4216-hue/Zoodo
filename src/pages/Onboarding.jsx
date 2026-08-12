import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const AGES = [2, 3, 4, 5, 6, 7, 8];

// First screen: the caregiver enters the child's name + age before the plan appears.
export default function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [age, setAge] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      navigate('/');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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