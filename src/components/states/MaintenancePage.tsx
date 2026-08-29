import React, { useState } from 'react';
import { Wrench, RefreshCw, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { useClinic } from '../../context/ClinicContext';

interface MaintenancePageProps {
  onRetry?: () => void;
  expectedDowntime?: string;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({
  onRetry,
  expectedDowntime = '15 minutes',
}) => {
  const { activeClinic } = useClinic();
  const [checking, setChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'IDLE' | 'ONLINE' | 'OFFLINE'>('IDLE');

  const checkHealth = async () => {
    setChecking(true);
    setHealthStatus('IDLE');

    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setHealthStatus('ONLINE');
        if (onRetry) {
          setTimeout(() => onRetry(), 1000);
        }
      } else {
        setHealthStatus('OFFLINE');
      }
    } catch {
      setHealthStatus('OFFLINE');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div 
      role="main"
      className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 text-slate-800 dark:text-slate-200 font-sans"
    >
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-amber-200 dark:border-amber-900/40 p-8 text-center space-y-6">
        
        {/* Visual Badge */}
        <div className="relative mx-auto w-20 h-20 bg-amber-50 dark:bg-amber-950/60 rounded-3xl flex items-center justify-center border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 shadow-sm">
          <Wrench className="w-10 h-10 animate-spin" />
          <span className="absolute -bottom-2 px-2 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-black tracking-widest uppercase">
            MAINTENANCE
          </span>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            System Maintenance Underway
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {activeClinic?.name || 'MediQueue'} is currently performing database schema optimization and security upgrades. Consultation queues will resume immediately upon completion.
          </p>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2 text-left">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Estimated Duration:
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {expectedDowntime}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
              Queue Data Safety:
            </span>
            <span className="font-bold text-emerald-600">Preserved in Firestore</span>
          </div>
        </div>

        {healthStatus === 'ONLINE' && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Server is back online! Refreshing portal...</span>
          </div>
        )}

        {healthStatus === 'OFFLINE' && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>Maintenance still active. Please retry in a few minutes.</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={checkHealth}
            disabled={checking}
            className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Status...' : 'Check Server Status'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
