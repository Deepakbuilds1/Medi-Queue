import React, { useState, useEffect } from 'react';
import { Cookie, X, SlidersHorizontal, Check } from 'lucide-react';
import { getStoredCookiePreferences, saveStoredCookiePreferences } from './CookiePreferencesModal';

interface CookieConsentBannerProps {
  onOpenPreferences: () => void;
  onOpenPrivacyPolicy: () => void;
}

const BANNER_DISMISSED_KEY = 'mediqueue_cookie_banner_dismissed';

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  onOpenPreferences,
  onOpenPrivacyPolicy,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
      if (!dismissed) {
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  const handleAcceptAll = () => {
    saveStoredCookiePreferences({
      essential: true,
      soundAlerts: true,
      themePersistence: true,
      analyticsTelemetry: true,
    });
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    } catch {}
    setIsVisible(false);
  };

  const handleReject = () => {
    saveStoredCookiePreferences({
      essential: true,
      soundAlerts: false,
      themePersistence: false,
      analyticsTelemetry: false,
    });
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    } catch {}
    setIsVisible(false);
  };

  return (
    <aside 
      role="region"
      aria-label="Cookie & Storage Consent"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 text-slate-800 dark:text-slate-200 text-xs animate-in slide-in-from-bottom duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 rounded-xl shrink-0 mt-0.5 border border-teal-200 dark:border-teal-800">
          <Cookie className="w-4 h-4" />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-xs">
              Storage & Queue Preferences
            </h3>
            <button
              type="button"
              onClick={handleReject}
              aria-label="Dismiss cookie banner"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
            MediQueue uses essential browser storage for clinic session sync, sound announcements, and queue updates. Review our{' '}
            <button
              type="button"
              onClick={onOpenPrivacyPolicy}
              className="text-teal-700 dark:text-teal-400 underline font-semibold"
            >
              Privacy Policy
            </button>.
          </p>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              type="button"
              onClick={handleAcceptAll}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-lg transition-colors cursor-pointer text-[11px] flex items-center gap-1 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept All</span>
            </button>
            <button
              type="button"
              onClick={onOpenPreferences}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer text-[11px] flex items-center gap-1"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Customize</span>
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="px-2 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-[11px]"
            >
              Essential Only
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
