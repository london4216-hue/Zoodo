// iPad-first, single-screen layout system
// No scrolling - all content fits on one screen via flexbox optimization
// Designed for iPad landscape (1024x768+) and portrait, with mobile fallback

export const ippadScreenLayouts = {
  // Lesson flow - one activity at a time, perfectly sized
  lessonFlow: `
    flex flex-col h-screen bg-gradient-to-b from-[#FFFDF8] to-[#FDE9F0]
    
    /* Persistent top bar - no scroll */
    h-[56px] flex items-center justify-between px-4 
    flex-shrink-0
    
    /* Main content area - takes remaining space */
    flex-1 overflow-hidden flex flex-col
    
    /* Bottom action buttons - always visible */
    h-[64px] flex gap-2 px-4 py-2 
    flex-shrink-0
  `,

  // Video player - optimized for iPad landscape
  videoContainer: `
    w-full aspect-video rounded-2xl bg-black/10
    md:max-h-[60vh] lg:max-h-[70vh]
    shadow-lg
  `,

  // Activity card - centered, scaled for touch
  activityCard: `
    bg-white rounded-3xl shadow-sm
    p-4 md:p-6 lg:p-8
    w-full max-w-3xl mx-auto
    h-auto flex flex-col justify-center
  `,

  // Button sizing for iPad touch targets
  primaryButton: `
    rounded-2xl px-6 py-4 md:py-5 lg:py-6
    font-bold text-base md:text-lg lg:text-xl
    active:scale-95 transition-transform
    min-h-[48px] md:min-h-[56px] lg:min-h-[64px]
    touch-action-manipulation
  `,

  // Grid for multiple items - iPad optimized
  gridLayout: `
    grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
    gap-3 md:gap-4 lg:gap-6
    auto-rows-fr
  `,

  // Modal - centered, respects safe areas
  modal: `
    fixed inset-0 z-50
    flex items-center justify-center
    p-4 md:p-6 lg:p-8
    max-h-screen overflow-auto
  `,
};

// Responsive size system for different devices
export const responsiveSizes = {
  // Touch target minimums (44x44 for phones, 48x48+ for tablets)
  touchTarget: {
    small: 'h-11 w-11',      // Phone
    medium: 'h-12 w-12',     // Tablet
    large: 'h-14 w-14',      // iPad landscape
  },

  // Text sizing
  text: {
    caption: 'text-xs md:text-xs lg:text-sm',
    body: 'text-sm md:text-base lg:text-lg',
    title: 'text-lg md:text-2xl lg:text-3xl',
    heading: 'text-2xl md:text-3xl lg:text-4xl',
  },

  // Spacing
  spacing: {
    compact: 'gap-2 md:gap-3 lg:gap-4',
    normal: 'gap-3 md:gap-4 lg:gap-6',
    relaxed: 'gap-4 md:gap-6 lg:gap-8',
  },

  // Container widths
  container: {
    compact: 'max-w-xs md:max-w-md lg:max-w-2xl',
    normal: 'max-w-sm md:max-w-lg lg:max-w-3xl',
    wide: 'max-w-md md:max-w-2xl lg:max-w-4xl',
  },
};

// iPad landscape detection and layout hooks
export const useIpadLayout = () => {
  const [isLandscape, setIsLandscape] = React.useState(
    typeof window !== 'undefined' && window.innerHeight < window.innerWidth
  );
  const [isTablet, setIsTablet] = React.useState(
    typeof window !== 'undefined' && window.innerWidth >= 768
  );

  React.useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerHeight < window.innerWidth);
      setIsTablet(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isLandscape, isTablet };
};

// Single-screen activity wrapper - everything fits without scroll
export const SingleScreenLayout = ({ children, header, footer, bgColor = 'bg-[#FFFDF8]' }) => {
  return (
    <div className={`flex flex-col h-screen ${bgColor}`}>
      {/* Header - fixed height */}
      {header && (
        <div className="flex-shrink-0 border-b border-black/5">
          {header}
        </div>
      )}

      {/* Content - takes remaining space, no scroll */}
      <div className="flex-1 overflow-hidden flex flex-col justify-center items-center p-4 md:p-6 lg:p-8">
        {children}
      </div>

      {/* Footer - fixed height, always visible */}
      {footer && (
        <div className="flex-shrink-0 border-t border-black/5">
          {footer}
        </div>
      )}
    </div>
  );
};

// Responsive video grid for imported/suggested videos
export const VideoGridLayout = ({ videos, renderItem }) => {
  return (
    <div className="grid auto-rows-max gap-3 md:gap-4 lg:gap-6 w-full max-h-full overflow-auto">
      {/* iPad landscape: 4 columns, portrait: 2-3 columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6 auto-rows-max">
        {videos.map((video, idx) => (
          <div key={idx} className="aspect-video bg-black/10 rounded-lg overflow-hidden hover:scale-105 transition-transform duration-200">
            {renderItem(video)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Prevent unwanted scrolling on iPad when showing modals/keyboards
export const usePreventScroll = (isActive) => {
  React.useEffect(() => {
    if (!isActive) return;
    
    const scrollAmount = window.scrollY || document.documentElement.scrollTop;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollAmount}px`;

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, scrollAmount);
    };
  }, [isActive]);
};

import React from 'react';
