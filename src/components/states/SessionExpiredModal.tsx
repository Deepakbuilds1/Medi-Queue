import React from 'react';
import { Clock, LogIn, ShieldAlert, ArrowRight } from 'lucide-react';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onLogin: () => void;
  message?: string;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  onLogin,
  message = 'Your administrative security session has timed out due to inactivity.'
}) => {
  if (!isOpen) return null;

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4">
        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2 id="session-expired-title" className="text-base font-extrabold text-slate-900 dark:text-white">
            Session Expired
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {message}
          </p>
        </div>

        <button
          type="button"
          onClick={onLogin}
          className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In Again</span>
        </button>
      </div>
    </div>
  );
};
