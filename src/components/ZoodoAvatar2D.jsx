import React from 'react';
import { motion } from 'framer-motion';
import { Image } from '@/components/ui/image';

const AVATAR_URL = 'https://media.base44.com/images/public/6a7cd655c84da62a7d047f4c/d82baeabb_generated_image.png';

// Studio-grade 2D Zoodo avatar. Gentle breathing idle; when `talking` is true
// (narration audio playing), a faster scale/y pulse simulates lip movement.
// `bounce` adds an excited wiggle for celebrations.
export default function ZoodoAvatar2D({ size = 96, talking = false, bounce = false, className = '' }) {
  const animate = talking
    ? { y: [0, -2, 0], scale: [1, 1.05, 1] }
    : bounce
    ? { y: [0, -8, 0], rotate: [0, -3, 3, 0] }
    : { y: [0, -3, 0], scale: [1, 1.02, 1] };
  const transition = talking
    ? { duration: 0.42, repeat: Infinity, ease: 'easeInOut' }
    : bounce
    ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' };

  return (
    <motion.div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      animate={animate}
      transition={transition}
    >
      <div className="relative h-full w-full overflow-hidden rounded-full shadow-lg ring-4 ring-white/70 bg-white">
        <Image src={AVATAR_URL} alt="Zoodo" fittingType="fill" className="h-full w-full" />
      </div>
    </motion.div>
  );
}