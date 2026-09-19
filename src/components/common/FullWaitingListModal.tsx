import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Clock, Users, ShieldCheck, Stethoscope } from 'lucide-react';
import { QueueToken } from '../../types';

interface FullWaitingListModalProps {
  isOpen: boolean;
  onClose: () => void;
  waitingTokens: QueueToken[];
  clinicName?: string;
  theme?: 'light' | 'dark';
  userTokenId?: string;
}

export const FullWaitingListModal: React.FC<FullWaitingListModalProps> = ({
  isOpen,
  onClose,
  waitingTokens,
  clinicName = 'MediQueue Clinic',
  theme = 'light',
  userTokenId
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Filter tokens by tokenNumber or patientName
  const filteredTokens = useMemo(() => {
    if (!searchTerm.trim()) return waitingTokens;
    const term = searchTerm.toLowerCase().trim();
    return waitingTokens.filter(t => 
      t.tokenNumber.toLowerCase().includes(term) ||
      (t.patientName && t.patientName.toLowerCase().includes(term)) ||
      (t.doctorName && t.doctorName.toLowerCase().includes(term))
    );
  }, [waitingTokens, searchTerm]);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-waiting-list-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border transition-all duration-150 overflow-hidden ${
          isDark 
            ? 'bg-slate-900 border-slate-800 text-slate-100' 
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div 
          className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 shrink-0 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 
                id="full-waiting-list-title" 
                className={`text-base sm:text-lg font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                FULL WAITING LIST
              </h2>
              <span 
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                  isDark 
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' 
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {waitingTokens.length} {waitingTokens.length === 1 ? 'patient waiting' : 'patients waiting'}
              </span>
            </div>
            <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {clinicName} • Real-time queue order
            </p>
          </div>

          <button
            type="button"
            id="close-waiting-list-modal-btn"
            onClick={onClose}
            aria-label="Close waiting list"
            className={`p-2 rounded-xl transition-colors shrink-0 cursor-pointer ${
              isDark 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Privacy Notice Bar */}
        <div 
          className={`px-4 py-3 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-100'
          }`}
        >
          <div className="relative flex-1">
            <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              id="waiting-list-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search token number or patient..."
              className={`w-full pl-9 pr-3 py-1.5 rounded-lg text-xs transition-colors focus:outline-hidden ${
                isDark
                  ? 'bg-slate-950 border border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-teal-500'
                  : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-teal-600'
              }`}
            />
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Public queue view • Privacy protected</span>
          </div>
        </div>

        {/* Scrollable Waiting Queue List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 divide-y-0">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <Users className={`w-10 h-10 mx-auto ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {waitingTokens.length === 0 
                  ? 'No patients currently waiting.' 
                  : `No tokens matching "${searchTerm}".`}
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {waitingTokens.length === 0 
                  ? 'New patients joining the queue will appear here in real-time.' 
                  : 'Try searching with a different token number or clear the search.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredTokens.map((token, index) => {
                const isUserToken = userTokenId && token.id === userTokenId;
                const queuePosition = waitingTokens.findIndex(t => t.id === token.id) + 1;

                return (
                  <div
                    key={token.id}
                    id={`waiting-token-row-${token.id}`}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                      isUserToken
                        ? isDark 
                          ? 'bg-teal-950/60 border-teal-700/80 ring-1 ring-teal-600' 
                          : 'bg-teal-50/80 border-teal-300 ring-1 ring-teal-500'
                        : isDark
                          ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {/* Left: Position & Token Number */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span 
                        className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                          isDark 
                            ? 'bg-slate-800 text-slate-300' 
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {queuePosition || index + 1}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span 
                            className={`font-mono font-black text-sm sm:text-base tracking-wide ${
                              isDark ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {token.tokenNumber}
                          </span>
                          {isUserToken && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-600 text-white px-1.5 py-0.5 rounded">
                              Your Token
                            </span>
                          )}
                        </div>
                        {token.patientName && (
                          <span 
                            className={`text-xs font-semibold block truncate max-w-[140px] sm:max-w-[200px] ${
                              isDark ? 'text-slate-300' : 'text-slate-700'
                            }`}
                          >
                            {token.patientName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Physician / Room & Arrival */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-1.5 text-xs font-medium">
                        <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className={`truncate max-w-[130px] sm:max-w-[180px] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          {token.doctorName || 'General Consultation'}
                        </span>
                        {token.roomNumber && (
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                            isDark ? 'bg-slate-800 text-teal-300' : 'bg-slate-200 text-teal-800'
                          }`}>
                            {token.roomNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {new Date(token.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="mx-1">•</span>
                        <span className="font-semibold text-amber-600">WAITING</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className={`p-3.5 sm:p-4 border-t flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
          }`}
        >
          <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Live queue updates in real-time
          </span>

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
