import React, { useState, useEffect, useCallback } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
  /** Optional override for total duration in ms. Default is 3400ms (3.4s) */
  duration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  duration = 3400,
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isUnmounted, setIsUnmounted] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleFinish = useCallback(() => {
    setIsFadingOut(true);
    const exitTimer = setTimeout(() => {
      setIsUnmounted(true);
      if (onComplete) {
        onComplete();
      }
    }, 450); // 450ms clean exit fade
    return () => clearTimeout(exitTimer);
  }, [onComplete]);

  // Animation timeline sequencing
  useEffect(() => {
    if (prefersReducedMotion) {
      setShowTitle(true);
      setShowSubtitle(true);
      setShowIndicators(true);
      const timer = setTimeout(handleFinish, 1800);
      return () => clearTimeout(timer);
    }

    // 1.15s: "MediQueue" fades in (after logo has completely settled at ~0.75s)
    const titleTimer = setTimeout(() => {
      setShowTitle(true);
    }, 1150);

    // 1.65s: Subtitle fades in
    const subtitleTimer = setTimeout(() => {
      setShowSubtitle(true);
    }, 1650);

    // 2.10s: Minimal 3-dot pulse indicators appear
    const indicatorTimer = setTimeout(() => {
      setShowIndicators(true);
    }, 2100);

    // 2.95s: Begin smooth fade-out (total animation ~3.4s)
    const fadeOutTimer = setTimeout(() => {
      handleFinish();
    }, duration - 450);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(subtitleTimer);
      clearTimeout(indicatorTimer);
      clearTimeout(fadeOutTimer);
    };
  }, [duration, handleFinish, prefersReducedMotion]);

  // Allow keyboard skip (Escape, Space, Enter) for clinical accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFinish]);

  if (isUnmounted) {
    return null;
  }

  return (
    <div
      id="mediqueue-startup-splash"
      role="status"
      aria-live="polite"
      aria-label="MediQueue Clinic Token Management System loading"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#F5F7F9',
        backgroundImage: 'radial-gradient(circle at 50% 46%, rgba(255, 255, 255, 0.95) 0%, rgba(245, 247, 249, 0.98) 65%, #F5F7F9 100%)',
      }}
    >
      {/* Central Brand Unit */}
      <div className="flex flex-col items-center justify-center text-center px-6 max-w-sm sm:max-w-md w-full">
        
        {/* Crisp Vector Logo Container */}
        <div className="mb-4 sm:mb-5 flex flex-col items-center justify-center">
          {/* Professional Healthcare Logo Badge */}
          <div
            className={`w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-2xl flex items-center justify-center ${
              prefersReducedMotion ? 'animate-mediqueue-fade-up' : 'animate-mediqueue-logo'
            }`}
            style={{
              backgroundColor: '#087F73',
              boxShadow: '0 4px 14px -2px rgba(8, 127, 115, 0.25), 0 2px 5px -1px rgba(15, 23, 42, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderTop: '1px solid rgba(255, 255, 255, 0.26)',
            }}
          >
            {/* Precision Vector Medical Cross & Lifeline Symbol */}
            <svg 
              className="w-10 h-10 sm:w-11 sm:h-11"
              viewBox="0 0 44 44" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              shapeRendering="geometricPrecision"
              aria-hidden="true"
            >
              {/* Perfectly Centered Medical Cross Foundation */}
              <rect x="18" y="5" width="8" height="34" rx="2.5" fill="#FFFFFF" />
              <rect x="5" y="18" width="34" height="8" rx="2.5" fill="#FFFFFF" />

              {/* Clean Negative-Space Clinical Vital Rhythm */}
              <path 
                d="M5 22H14.5L18.5 13L25.5 31L29.5 22H39" 
                stroke="#087F73" 
                strokeWidth="3.2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>
          </div>
        </div>

        {/* Brand Name: MediQueue */}
        <div className="min-h-[40px] sm:min-h-[46px] flex items-center justify-center">
          {showTitle ? (
            <h1 
              className="text-[27px] sm:text-[34px] font-bold text-[#0F172A] tracking-tight leading-none animate-mediqueue-fade-up"
              style={{
                fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                letterSpacing: '-0.025em',
                fontWeight: 700,
              }}
            >
              MediQueue
            </h1>
          ) : (
            <div className="h-[34px]" aria-hidden="true" />
          )}
        </div>

        {/* Subtitle: Clinic Token Management System */}
        <div className="min-h-[22px] mt-1 sm:mt-1.5 flex items-center justify-center">
          {showSubtitle ? (
            <p 
              className="text-[13px] sm:text-[14.5px] text-slate-500 font-medium tracking-wide animate-mediqueue-fade-up"
              style={{
                fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                letterSpacing: '0.035em',
                fontWeight: 500,
              }}
            >
              Clinic Token Management System
            </p>
          ) : (
            <div className="h-[20px]" aria-hidden="true" />
          )}
        </div>

        {/* Minimalist 3-Dot Clinical Activity Indicator: • • • */}
        <div className="h-6 mt-5 sm:mt-6 flex items-center justify-center gap-1.5">
          {showIndicators ? (
            <div 
              className="flex items-center gap-1.5 animate-mediqueue-fade-up"
              aria-hidden="true"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#087F73]/80 animate-mediqueue-dot-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#087F73]/80 animate-mediqueue-dot-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#087F73]/80 animate-mediqueue-dot-3" />
            </div>
          ) : (
            <div className="w-12 h-1.5" aria-hidden="true" />
          )}
        </div>

      </div>

      {/* Subtle Accessibility Skip (Visible on Keyboard Tab Focus) */}
      <button
        type="button"
        onClick={handleFinish}
        className="sr-only focus:not-sr-only focus:absolute focus:bottom-6 focus:px-4 focus:py-2 focus:bg-white focus:text-[#087F73] focus:rounded-lg focus:shadow-md focus:border focus:border-slate-300 focus:text-xs focus:font-semibold focus:outline-hidden"
      >
        Skip to main content
      </button>

      {/* Discreet Version Tag at bottom footer */}
      <div className="absolute bottom-6 text-[10.5px] text-slate-400 font-medium tracking-wider uppercase select-none opacity-60">
        Enterprise Healthcare Edition
      </div>
    </div>
  );
};
