// Premium voice narration hook — generates warm, personalised speech via the
// backend generateSpeech function (ElevenLabs "Rachel" voice) and plays it back
// through an HTMLAudioElement. Child's name is woven into every line.
//
// Usage:
//   const { speak, speaking } = usePremiumVoice(kidName);
//   speak('lessonStart', { subject: 'Colors' });

import { useCallback, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { generateVoicePrompts } from '@/lib/voicePersonalization';

export default function usePremiumVoice(kidName) {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);

  // Cancel any currently-playing narration.
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setSpeaking(false);
  }, []);

  // Speak a named prompt key (from generateVoicePrompts) or a raw text string.
  // Extra args are forwarded to the prompt template function.
  const speak = useCallback(
    async (promptKeyOrText, extraArgs = {}) => {
      let text;
      if (typeof promptKeyOrText === 'string' && generateVoicePrompts[promptKeyOrText]) {
        const fn = generateVoicePrompts[promptKeyOrText];
        // Most templates are (kidName, secondArg) shaped.
        const second = extraArgs.subject || extraArgs.letter || extraArgs.number || extraArgs.activity || '';
        const third = extraArgs.sound || extraArgs.count || '';
        text = fn(kidName || 'friend', second, third);
      } else {
        text = promptKeyOrText || '';
      }

      if (!text.trim()) return;

      stop();
      setSpeaking(true);

      try {
        const result = await base44.functions.generateSpeech({ text: text.trim() });
        const url = result?.audio_url;
        if (url) {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => setSpeaking(false);
          audio.onerror = () => setSpeaking(false);
          await audio.play();
        } else {
          setSpeaking(false);
        }
      } catch {
        setSpeaking(false);
      }
    },
    [kidName, stop],
  );

  return { speak, speaking, stop };
}
