import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { triggerMusicCelebrationBoost, vibrate } from '@/lib/sensoryAudio';

const COLORS = ['#FF9EC4', '#4969E1', '#FFE08A', '#4FAE5A', '#FFD9E6', '#7B4FE0'];

export default function CelebrationSequence({ tier = 'first', burstAround }) {
  useEffect(() => {
    const particleCount =
      tier === 'weekly' ? 220 :
      tier === 'streak' ? 150 : 90;
    const spread =
      tier === 'weekly' ? 120 :
      tier === 'streak' ? 100 : 80;

    confetti({ particleCount, spread, origin: { y: 0.6 }, colors: COLORS });
    setTimeout(() => confetti({ particleCount: Math.round(particleCount * 0.6), angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: COLORS }), 180);
    setTimeout(() => confetti({ particleCount: Math.round(particleCount * 0.6), angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: COLORS }), 360);

    if (tier === 'streak') vibrate([60, 40, 60]);
    if (tier === 'weekly') vibrate([80, 40, 80, 40, 120]);
    if (tier === 'first') vibrate([30]);
    triggerMusicCelebrationBoost(tier === 'weekly' ? 0.34 : 0.28, 1300);
    burstAround?.();
  }, [tier, burstAround]);

  return null;
}
