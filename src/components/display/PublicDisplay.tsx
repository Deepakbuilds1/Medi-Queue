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

  const clinicName = activeClinic?.name || settings?.clinicName || 'CITY CARE CLINIC';
  const clinicLogo = activeClinic?.logo || settings?.clinicLogo;

  const activeServing = publicQueue.nowServing[0];
  const otherServing = publicQueue.nowServing.slice(1);

  return (
    <div className="w-screen h-screen bg-slate-950 text-white font-sans overflow-hidden flex flex-col justify-between select-none">
      
      {/* Top TV Banner */}
      <header className="bg-slate-900 border-b border-slate-800 px-8 py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onNavigateBack}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Back to portal"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {clinicLogo ? (
            <img src={clinicLogo} alt={clinicName} className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-700" />
          ) : (
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">
              🏥
            </div>
          )}

          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">{clinicName}</h1>
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Live TV Queue Display</p>
          </div>
        </div>

        {/* Live Clock & Sound Test & Clinic Selector */}
        <div className="flex items-center gap-4">
          {clinics.length > 1 && (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              <Building2 className="w-4 h-4 text-blue-400" />
              <select
                value={activeClinicId}
                onChange={(e) => switchClinic(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
              >
                {clinics.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => playTokenCallSound()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-blue-400" />
            <span>Test Chime</span>
          </button>

          <div className="text-right font-mono">
            <div className="text-xl font-bold text-white">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-slate-400">
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Waiting Room TV Display Grid */}
      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
        
        {/* NOW SERVING (Spans 2 Columns - Giant Display) */}
        <div className="lg:col-span-2 bg-slate-900/90 rounded-3xl border-2 border-slate-800 p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-black uppercase tracking-widest text-emerald-400">
                NOW SERVING / CALLED
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">Proceed to Room</span>
          </div>

          {/* Main Giant Active Token */}
          {activeServing ? (
            <div className={`
              my-auto text-center p-8 rounded-3xl transition-all duration-500
              ${highlightingId === activeServing.id ? 'bg-blue-600/30 border-4 border-blue-500 animate-pulse' : 'bg-slate-950/80 border border-slate-800'}
            `}>
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-2">
                CURRENT TOKEN
              </span>
              
              <div className="text-8xl md:text-9xl font-black text-emerald-400 font-mono tracking-tighter my-2 drop-shadow-lg">
                {activeServing.tokenNumber}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800/80 inline-flex items-center gap-4 bg-slate-900 px-6 py-2.5 rounded-2xl border border-slate-800">
                <span className="text-base font-bold text-white">{activeServing.doctorName}</span>
                <span className="text-sm font-black text-blue-400 bg-blue-950 px-3 py-1 rounded-xl border border-blue-800">
                  {activeServing.roomNumber}
                </span>
              </div>
            </div>
          ) : (
            <div className="my-auto text-center py-16 text-slate-500 space-y-3">
              <Monitor className="w-16 h-16 mx-auto text-slate-700" />
              <p className="text-lg font-semibold">No patient currently being served in {clinicName}.</p>
            </div>
          )}

          {/* Secondary Serving tokens if multiple doctors active */}
          {otherServing.length > 0 && (
            <div className="pt-4 border-t border-slate-800 flex items-center gap-4 overflow-x-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0">Also Serving:</span>
              {otherServing.map(t => (
                <div key={t.id} className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 flex items-center gap-3">
                  <span className="text-xl font-bold font-mono text-emerald-400">{t.tokenNumber}</span>
                  <span className="text-xs text-slate-300 font-medium">{t.roomNumber}</span>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* UP NEXT QUEUE (Right Column) */}
        <div className="bg-slate-900/90 rounded-3xl border-2 border-slate-800 p-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                UP NEXT
              </h3>
              <span className="text-xs font-mono font-bold text-amber-400">
                {publicQueue.upNext.length} Waiting
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {publicQueue.upNext.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-10 text-center">Queue is empty.</p>
              ) : (
                publicQueue.upNext.slice(0, 7).map((t, index) => (
                  <div 
                    key={t.id}
                    className="p-3.5 bg-slate-950/90 rounded-2xl border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-2xl font-black font-mono text-white tracking-wider">
                        {t.tokenNumber}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                      {t.doctorName}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              Please watch this screen for your token call
            </p>
          </div>
        </div>

      </main>

    </div>
  );
};
