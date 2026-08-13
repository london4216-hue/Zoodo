import { useCallback, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const EMPTY_PARENT_NAMES = [];

// Shared premium narration helper that always passes child-name context
// and returns a playable audio URL from the backend voice generator.
export default function usePremiumVoice({ kidName = '', parentNames = EMPTY_PARENT_NAMES } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastAudioUrl, setLastAudioUrl] = useState('');
  const audioRef = useRef(null);

  const generate = useCallback(async (text, options = {}) => {
    if (!text) return '';
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('generateSpeech', {
        text,
        childName: options.childName || kidName || '',
        parentNames: options.parentNames || parentNames || [],
        style: options.style || 'warm_encouraging',
      });
      const url = res?.data?.audio_url || '';
      setLastAudioUrl(url);
      return url;
    } catch (e) {
      setError(e?.message || 'Could not generate narration');
      return '';
    } finally {
      setLoading(false);
    }
  }, [kidName, parentNames]);

  const speak = useCallback(async (text, options = {}) => {
    const url = await generate(text, options);
    if (!url) return '';
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (e) { /* ignore */ }
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    await audio.play().catch(() => {});
    return url;
  }, [generate]);

  return { generate, speak, loading, error, lastAudioUrl };
}
