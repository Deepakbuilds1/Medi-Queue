import React from 'react';
import { FileQuestion, ArrowLeft, Home, Monitor, Building2, ShieldAlert } from 'lucide-react';

interface NotFoundPageProps {
  onNavigateHome: () => void;
  onNavigateAdmin?: () => void;
  onNavigateDisplay?: () => void;
  requestedPath?: string;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  onNavigateHome,
  onNavigateAdmin,
  onNavigateDisplay,
  requestedPath = window.location.pathname,
}) => {
  return (
    <div 
      role="main"
      className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 text-slate-800 dark:text-slate-200 font-sans"
    >
      <div className="max-w-md w-full bg-white dark:bg-slate-800/90 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center space-y-6">
        
        {/* Visual 404 Badge */}
        <div className="relative mx-auto w-20 h-20 bg-teal-50 dark:bg-teal-950/60 rounded-3xl flex items-center justify-center border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 shadow-sm">
          <FileQuestion className="w-10 h-10 animate-bounce" />
          <span className="absolute -bottom-2 px-2 py-0.5 bg-slate-900 text-white rounded-full text-[10px] font-black tracking-widest uppercase">
            404
          </span>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Page Not Found
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            The requested destination <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-mono text-[11px] break-all">{requestedPath}</code> does not exist or has been relocated within the MediQueue system.
          </p>
        </div>

        {/* Recovery Links */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onNavigateHome}
            className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Patient Portal</span>
          </button>

          {onNavigateDisplay && (
            <button
              type="button"
              onClick={onNavigateDisplay}
              className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Monitor className="w-4 h-4 text-emerald-500" />
              <span>Open TV Waiting Display</span>
            </button>
          )}

          {onNavigateAdmin && (
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="w-full py-2 px-4 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Clinic Administration Login</span>
            </button>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-400">
          MediQueue Multi-Clinic OS • Real-Time Token Routing
        </div>

      </div>
    </div>
  );
};
