import React, { useState, useEffect } from 'react';
import { Cookie, Check, X, Shield, Volume2, Moon, SlidersHorizontal, Info } from 'lucide-react';

export interface CookiePreferences {
  essential: boolean; // Always true
  soundAlerts: boolean;
  themePersistence: boolean;
  analyticsTelemetry: boolean;
}

const STORAGE_KEY = 'mediqueue_cookie_preferences';

export const getStoredCookiePreferences = (): CookiePreferences => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to read cookie preferences:', e);
  }
  return {
    essential: true,
    soundAlerts: true,
    themePersistence: true,
    analyticsTelemetry: false,
  };
};

export const saveStoredCookiePreferences = (prefs: CookiePreferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save cookie preferences:', e);
  }
};

interface CookiePreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (prefs: CookiePreferences) => void;
}

export const CookiePreferencesModal: React.FC<CookiePreferencesModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [preferences, setPreferences] = useState<CookiePreferences>(getStoredCookiePreferences());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPreferences(getStoredCookiePreferences());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveStoredCookiePreferences(preferences);
    setSavedSuccess(true);
    if (onSaved) onSaved(preferences);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleAcceptAll = () => {
    const allEnabled: CookiePreferences = {
      essential: true,
      soundAlerts: true,
      themePersistence: true,
      analyticsTelemetry: true,
    };
    setPreferences(allEnabled);
    saveStoredCookiePreferences(allEnabled);
    if (onSaved) onSaved(allEnabled);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleRejectNonEssential = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      soundAlerts: false,
      themePersistence: false,
      analyticsTelemetry: false,
    };
    setPreferences(essentialOnly);
    saveStoredCookiePreferences(essentialOnly);
    if (onSaved) onSaved(essentialOnly);
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="cookie-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        
        {/* Header */}
        <header className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Cookie className="w-5 h-5" />
            </div>
            <div>
              <h2 id="cookie-modal-title" className="font-bold text-base text-white">
                Browser Storage & Cookie Preferences
              </h2>
              <p className="text-xs text-slate-400">
                Configure your local storage and session settings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-slate-800 dark:text-slate-200 text-xs">
          
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            MediQueue uses browser local storage to maintain clinic queue sessions, sound alerts, and login authentication. You can customize your optional preferences below:
          </p>

          {/* 1. Essential Storage (Locked) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>Essential Session & Security Storage</span>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono font-extrabold uppercase">
                  Required
                </span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Stores Firebase authentication tokens, multi-tenant active clinic IDs, and Super Admin security tokens. Cannot be disabled.
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <div className="w-10 h-6 bg-emerald-600 rounded-full flex items-center justify-end px-1 cursor-not-allowed opacity-80">
                <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-emerald-700" />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Audio Callout Preferences */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Volume2 className="w-4 h-4 text-blue-500" />
                <span>Token Audio Chime & Speech Synthesizer</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Allows the browser to play an audible bell chime and synthesize voice callouts when your queue token is called.
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <button
                type="button"
                role="switch"
                aria-checked={preferences.soundAlerts}
                onClick={() => setPreferences(prev => ({ ...prev, soundAlerts: !prev.soundAlerts }))}
                className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${
                  preferences.soundAlerts ? 'bg-teal-700 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
              </button>
            </div>
          </div>

          {/* 3. Theme & UI Preferences */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Moon className="w-4 h-4 text-indigo-500" />
                <span>Theme & Display Preference Storage</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Remembers dark/light mode and TV display fullscreen configurations across browser sessions.
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <button
                type="button"
                role="switch"
                aria-checked={preferences.themePersistence}
                onClick={() => setPreferences(prev => ({ ...prev, themePersistence: !prev.themePersistence }))}
                className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${
                  preferences.themePersistence ? 'bg-teal-700 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
              </button>
            </div>
          </div>

          {/* 4. Performance & Telemetry */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                <span>Operational Queue Performance Metrics</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Aggregates anonymous token wait time averages to improve patient queue scheduling estimates.
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <button
                type="button"
                role="switch"
                aria-checked={preferences.analyticsTelemetry}
                onClick={() => setPreferences(prev => ({ ...prev, analyticsTelemetry: !prev.analyticsTelemetry }))}
                className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors cursor-pointer ${
                  preferences.analyticsTelemetry ? 'bg-teal-700 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
              </button>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <footer className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRejectNonEssential}
              className="w-full sm:w-auto px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Essential Only
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="w-full sm:w-auto px-3 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Enable All
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full sm:w-auto px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Preferences Saved!</span>
              </>
            ) : (
              <span>Save Choices</span>
            )}
          </button>
        </footer>

      </div>
    </div>
  );
};
