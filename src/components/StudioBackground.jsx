import React from 'react';

// Cinematic "studio stage" backdrop for the Lesson Studio: a deep-navy gradient
// base, a warm radial spotlight glow behind the avatar/content, and a soft
// vignette around the edges. Purely decorative and non-interactive.
export default function StudioBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-studio-bg2 to-studio-bg" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(62% 52% at 50% 36%, rgba(232,177,74,0.20), rgba(27,34,64,0) 70%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(125% 100% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)',
        }}
      />
    </div>
  );
}