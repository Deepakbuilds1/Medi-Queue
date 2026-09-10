import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Building2, Monitor, ArrowLeft } from 'lucide-react';
import { ClinicSettings, QueueToken } from '../../types';
import { subscribePublicQueue } from '../../services/clinicService';
import { playTokenCallSound } from '../../lib/sound';
import { useClinic } from '../../context/ClinicContext';

interface PublicDisplayProps {
  settings: ClinicSettings | null;
  onNavigateBack: () => void;
}

export const PublicDisplay: React.FC<PublicDisplayProps> = ({ settings, onNavigateBack }) => {
  const { activeClinicId, activeClinic, clinics, switchClinic } = useClinic();

  const [publicQueue, setPublicQueue] = useState<{
    nowServing: QueueToken[];
    upNext: QueueToken[];
  }>({ nowServing: [], upNext: [] });

  const lastCalledIdRef = useRef<string | null>(null);
  const [highlightingId, setHighlightingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribePublicQueue(activeClinicId, (data) => {
      setPublicQueue(data);

      // Check if a new token was called
      if (data.nowServing.length > 0) {
        const topServing = data.nowServing[0];
        if (lastCalledIdRef.current && lastCalledIdRef.current !== topServing.id) {
          playTokenCallSound();
          setHighlightingId(topServing.id);
          setTimeout(() => setHighlightingId(null), 5000);
        }
        lastCalledIdRef.current = topServing.id;
      }
    });

    return () => unsubscribe();
  }, [activeClinicId]);

  const clinicName = activeClinic?.name || settings?.clinicName || (activeClinicId ? `Clinic: ${activeClinicId}` : 'MediQueue Public Display');
  const clinicLogo = activeClinic?.logo || settings?.clinicLogo;

  const activeServing = publicQueue.nowServing[0];
  const otherServing = publicQueue.nowServing.slice(1);

  return (
    <div className="w-full max-w-full min-h-[100dvh] lg:h-screen lg:overflow-hidden bg-slate-950 text-white font-sans overflow-x-hidden flex flex-col justify-between select-none box-border">
      
      {/* Top TV Banner */}
      <header className="bg-slate-900 border-b border-slate-800 px-3.5 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4 shrink-0 w-full box-border">
        {/* Brand & Clinic Title */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 max-w-full">
          <button
            onClick={onNavigateBack}
            className="p-2 sm:p-2.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[38px] min-h-[38px] flex items-center justify-center"
            aria-label="Back to patient portal"
            title="Back to patient portal"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </button>
          
          {clinicLogo ? (
            <img 
              src={clinicLogo} 
              alt={`${clinicName} logo`} 
              className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover border-2 border-slate-700 shrink-0" 
            />
          ) : (
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-base sm:text-xl shadow-lg shrink-0">
              🏥
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 
              className="font-black tracking-tight text-white break-words [overflow-wrap:anywhere] leading-snug"
              style={{ fontSize: 'clamp(0.95rem, 3.8vw, 1.5rem)' }}
            >
              {clinicName}
            </h1>
            <p 
              className="font-bold text-blue-400 uppercase tracking-widest mt-0.5"
              style={{ fontSize: 'clamp(0.6rem, 2vw, 0.75rem)' }}
            >
              Live TV Queue Display
            </p>
          </div>
        </div>

        {/* Live Clock & Sound Test & Clinic Selector */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t border-slate-800/80 sm:border-t-0 w-full sm:w-auto">
          {clinics.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 sm:px-2.5 py-1.5 rounded-xl border border-slate-700 max-w-[150px] sm:max-w-[220px]">
              <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
              <select
                value={activeClinicId}
                onChange={(e) => switchClinic(e.target.value)}
                className="bg-transparent text-[11px] sm:text-xs font-bold text-slate-200 focus:outline-none cursor-pointer truncate w-full"
                aria-label="Select Clinic"
              >
                {clinics.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => playTokenCallSound()}
            className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[34px]"
            style={{ fontSize: 'clamp(0.6875rem, 2.2vw, 0.75rem)' }}
            aria-label="Test chime notification sound"
          >
            <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" aria-hidden="true" />
            <span>Test Chime</span>
          </button>

          <div className="text-right font-mono shrink-0 pl-1">
            <div 
              className="font-bold text-white leading-tight"
              style={{ fontSize: 'clamp(0.8125rem, 2.8vw, 1.25rem)' }}
            >
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div 
              className="text-slate-400 leading-tight"
              style={{ fontSize: 'clamp(0.625rem, 2vw, 0.75rem)' }}
            >
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Waiting Room TV Display Grid */}
      <main className="flex-1 p-3.5 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 overflow-visible lg:overflow-hidden w-full max-w-full box-border">
        
        {/* NOW SERVING (Spans 2 Columns - Giant Display) */}
        <div 
          style={{ minHeight: 'auto' }}
          className="lg:col-span-2 bg-slate-900/90 rounded-2xl sm:rounded-3xl border-2 border-slate-800 p-4 sm:p-6 lg:p-8 flex flex-col justify-between shadow-2xl relative w-full box-border h-auto min-h-[auto]"
        >
          
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden="true" />
              <h2 
                className="font-black uppercase tracking-widest text-emerald-400"
                style={{ fontSize: 'clamp(0.7rem, 2.4vw, 0.875rem)' }}
              >
                NOW SERVING / CALLED
              </h2>
            </div>
            <span 
              className="font-mono text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800 shrink-0"
              style={{ fontSize: 'clamp(0.65rem, 2.2vw, 0.75rem)' }}
            >
              Proceed to Room
            </span>
          </div>

          {/* Main Giant Active Token */}
          {activeServing ? (
            <div 
              style={{ minHeight: 'auto' }}
              className={`
              my-auto text-center p-3 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl transition-all duration-500 w-full box-border h-auto min-h-[auto]
              ${highlightingId === activeServing.id ? 'bg-blue-600/30 border-4 border-blue-500 animate-pulse' : 'bg-slate-950/80 border border-slate-800'}
            `}>
              <span 
                className="font-extrabold uppercase tracking-widest text-slate-400 block mb-1 sm:mb-2"
                style={{ fontSize: 'clamp(0.65rem, 2.2vw, 0.75rem)' }}
              >
                CURRENT TOKEN
              </span>
              
              <div 
                className="font-black text-emerald-400 font-mono tracking-tighter my-2 drop-shadow-lg leading-none break-all max-w-full"
                style={{ fontSize: 'clamp(2rem, 9.5vw, 8rem)' }}
              >
                {activeServing.tokenNumber}
              </div>

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-2 sm:gap-4 bg-slate-900 px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-800 max-w-full mx-auto">
                <span 
                  className="font-bold text-white text-center break-words [overflow-wrap:anywhere]"
                  style={{ fontSize: 'clamp(0.8125rem, 2.8vw, 1rem)' }}
                >
                  {activeServing.doctorName}
                </span>
                <span 
                  className="font-black text-blue-400 bg-blue-950 px-2.5 sm:px-3 py-1 rounded-lg sm:rounded-xl border border-blue-800 shrink-0"
                  style={{ fontSize: 'clamp(0.7rem, 2.4vw, 0.875rem)' }}
                >
                  {activeServing.roomNumber}
                </span>
              </div>
            </div>
          ) : (
            <div 
              style={{ minHeight: 'auto' }}
              className="my-auto text-center py-10 sm:py-16 text-slate-500 space-y-2 sm:space-y-3 h-auto min-h-[auto]"
            >
              <Monitor className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-slate-700" aria-hidden="true" />
              <p 
                className="font-semibold px-4 break-words [overflow-wrap:anywhere]"
                style={{ fontSize: 'clamp(0.875rem, 2.8vw, 1.125rem)' }}
              >
                No patient currently being served in {clinicName}.
              </p>
            </div>
          )}

          {/* Secondary Serving tokens if multiple doctors active */}
          {otherServing.length > 0 && (
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-800 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 overflow-x-auto max-w-full">
              <span 
                className="font-bold text-slate-500 uppercase tracking-widest shrink-0"
                style={{ fontSize: 'clamp(0.65rem, 2.2vw, 0.75rem)' }}
              >
                Also Serving:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {otherServing.map(t => (
                  <div key={t.id} className="bg-slate-800 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl border border-slate-700 flex items-center gap-2 sm:gap-3 shrink-0">
                    <span 
                      className="font-bold font-mono text-emerald-400"
                      style={{ fontSize: 'clamp(0.95rem, 3.2vw, 1.25rem)' }}
                    >
                      {t.tokenNumber}
                    </span>
                    <span 
                      className="text-slate-300 font-medium"
                      style={{ fontSize: 'clamp(0.65rem, 2.2vw, 0.75rem)' }}
                    >
                      {t.roomNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* UP NEXT QUEUE (Right Column) */}
        <div 
          style={{ minHeight: 'auto' }}
          className="bg-slate-900/90 rounded-2xl sm:rounded-3xl border-2 border-slate-800 p-4 sm:p-6 flex flex-col justify-between shadow-xl w-full box-border h-auto min-h-[auto]"
        >
          <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col min-h-0">
            <div className="border-b border-slate-800 pb-2.5 sm:pb-3 flex items-center justify-between gap-2">
              <h3 
                className="font-black uppercase tracking-widest text-slate-400"
                style={{ fontSize: 'clamp(0.7rem, 2.4vw, 0.75rem)' }}
              >
                UP NEXT
              </h3>
              <span 
                className="font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-800/40 shrink-0"
                style={{ fontSize: 'clamp(0.7rem, 2.4vw, 0.75rem)' }}
              >
                {publicQueue.upNext.length} Waiting
              </span>
            </div>

            <div className="space-y-2 sm:space-y-3 overflow-y-auto max-h-[300px] sm:max-h-[380px] lg:max-h-none flex-1 pr-1">
              {publicQueue.upNext.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 sm:py-10 text-center">Queue is empty.</p>
              ) : (
                publicQueue.upNext.slice(0, 7).map((t, index) => (
                  <div 
                    key={t.id}
                    className="p-2.5 sm:p-3.5 bg-slate-950/90 rounded-xl sm:rounded-2xl border border-slate-800 flex items-center justify-between gap-3 min-w-0"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                      <span 
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-800 text-slate-400 font-bold flex items-center justify-center shrink-0"
                        style={{ fontSize: 'clamp(0.6rem, 2vw, 0.75rem)' }}
                      >
                        {index + 1}
                      </span>
                      <span 
                        className="font-black font-mono text-white tracking-wider shrink-0"
                        style={{ fontSize: 'clamp(1.125rem, 4vw, 1.5rem)' }}
                      >
                        {t.tokenNumber}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 text-right">
                      {t.patientName && (
                        <span 
                          className="font-bold text-slate-200 block truncate sm:overflow-visible sm:whitespace-normal [overflow-wrap:anywhere]"
                          style={{ fontSize: 'clamp(0.75rem, 2.5vw, 0.875rem)' }}
                        >
                          {t.patientName}
                        </span>
                      )}
                      <span 
                        className="font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-slate-800 inline-block truncate max-w-full"
                        style={{ fontSize: 'clamp(0.625rem, 2vw, 0.75rem)' }}
                      >
                        {t.doctorName || t.roomNumber || 'Consultation'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-800/80 text-center shrink-0">
            <p 
              className="text-slate-500 font-medium"
              style={{ fontSize: 'clamp(0.625rem, 2vw, 0.6875rem)' }}
            >
              Please watch this screen for your token call
            </p>
          </div>
        </div>

      </main>

    </div>
  );
};
