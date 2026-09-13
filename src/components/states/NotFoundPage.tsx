import React from 'react';
import { FileQuestion, Home, Monitor, Building2 } from 'lucide-react';
import { Button } from '../shared/Button';

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
          <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
            The requested destination <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 font-mono text-xs break-all">{requestedPath}</code> does not exist or has been relocated within the MediQueue system.
          </p>
        </div>

        {/* Recovery Links */}
        <div className="space-y-2 pt-2">
          <Button
            type="button"
            variant="Primary"
            size="md"
            fullWidth
            onClick={onNavigateHome}
            leftIcon={<Home className="w-4 h-4" />}
          >
            Return to Patient Portal
          </Button>

          {onNavigateDisplay && (
            <Button
              type="button"
              variant="Secondary"
              size="md"
              fullWidth
              onClick={onNavigateDisplay}
              leftIcon={<Monitor className="w-4 h-4 text-emerald-600" />}
            >
              Open TV Waiting Display
            </Button>
          )}

          {onNavigateAdmin && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              fullWidth
              onClick={onNavigateAdmin}
              leftIcon={<Building2 className="w-3.5 h-3.5" />}
            >
              Clinic Administration Login
            </Button>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400">
          MediQueue Multi-Clinic OS • Real-Time Token Routing
        </div>

      </div>
    </div>
  );
};
