import React, { useState, useEffect } from 'react';
import { Cookie, X, SlidersHorizontal, Check } from 'lucide-react';
import { getStoredCookiePreferences, saveStoredCookiePreferences } from './CookiePreferencesModal';
import { Button } from '../shared/Button';

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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleReject}
              aria-label="Dismiss cookie banner"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 h-6 w-6"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-slate-700 dark:text-slate-300 text-base leading-relaxed">
            MediQueue uses essential browser storage for clinic session sync, sound announcements, and queue updates. Review our{' '}
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={onOpenPrivacyPolicy}
              className="inline p-0 h-auto underline font-bold text-teal-800 dark:text-teal-300 align-baseline"
            >
              Privacy Policy
            </Button>.
          </p>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Button
              type="button"
              variant="Primary"
              size="sm"
              onClick={handleAcceptAll}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Accept All
            </Button>
            <Button
              type="button"
              variant="Secondary"
              size="sm"
              onClick={onOpenPreferences}
              leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            >
              Customize
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReject}
            >
              Essential Only
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};
