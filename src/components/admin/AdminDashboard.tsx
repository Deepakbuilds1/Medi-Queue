import React, { useState } from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  Activity, 
  Volume2, 
  PlusCircle, 
  PhoneCall, 
  RotateCcw, 
  FastForward, 
  CheckCheck, 
  Building2,
  Stethoscope,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Doctor, QueueToken, TokenStatus } from '../../types';
import { callNextToken, updateTokenStatus } from '../../services/clinicService';
import { playTokenCallSound } from '../../lib/sound';
import { ConfirmModal } from '../common/ConfirmModal';
import { useClinic } from '../../context/ClinicContext';

interface AdminDashboardProps {
  tokens: QueueToken[];
  doctors: Doctor[];
  onOpenPatientRegistration: () => void;
  onNavigateToQueuePage: () => void;
  onNavigateToPatientPortal: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  tokens,
  doctors,
  onOpenPatientRegistration,
  onNavigateToQueuePage,
  onNavigateToPatientPortal
}) => {
  const { activeClinicId, activeClinic } = useClinic();
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('ALL');
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {}
  });

  // Filter tokens by doctor
  const filteredTokens = selectedDoctorFilter === 'ALL'
    ? tokens
    : tokens.filter(t => t.doctorId === selectedDoctorFilter);

  // Calculate Metrics
  const totalToday = filteredTokens.length;
  const waitingCount = filteredTokens.filter(t => t.status === 'WAITING').length;
  const inConsultationCount = filteredTokens.filter(t => t.status === 'IN CONSULTATION' || t.status === 'CALLED').length;
  const completedCount = filteredTokens.filter(t => t.status === 'COMPLETED').length;

  // Active token being called or in consultation (null if none active)
  const activeToken = filteredTokens
    .filter(t => t.status === 'CALLED' || t.status === 'IN CONSULTATION')
    .sort((a, b) => new Date(b.calledAt || b.createdAt).getTime() - new Date(a.calledAt || a.createdAt).getTime())[0];

  const handleCallNext = async () => {
    if (loadingAction) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const doctorIdToCall = selectedDoctorFilter === 'ALL' ? undefined : selectedDoctorFilter;
      const called = await callNextToken(activeClinicId, doctorIdToCall);
      if (called) {
        playTokenCallSound();
      } else {
        setActionError('No WAITING patients in queue.');
      }
    } catch (err: any) {
      console.error('Call next error:', err);
      setActionError(err.message || 'Queue changed. Please refresh and try again.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRecall = async (token: QueueToken) => {
    if (loadingAction) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      await updateTokenStatus(activeClinicId, token.id, 'CALLED');
      playTokenCallSound();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Queue changed. Please refresh and try again.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSkip = (token: QueueToken) => {
    setConfirmModal({
      isOpen: true,
      title: 'Skip Patient Token?',
      message: `Are you sure you want to skip token ${token.tokenNumber} (${token.patientName})?`,
      action: async () => {
        if (loadingAction) return;
        setLoadingAction(true);
        setActionError(null);
        try {
          await updateTokenStatus(activeClinicId, token.id, 'SKIPPED');
        } catch (err: any) {
          setActionError(err.message || 'Queue changed. Please refresh and try again.');
        } finally {
          setLoadingAction(false);
        }
      }
    });
  };

  const handleStartConsultation = async (token: QueueToken) => {
    if (loadingAction) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      await updateTokenStatus(activeClinicId, token.id, 'IN CONSULTATION');
    } catch (err: any) {
      setActionError(err.message || 'Queue changed. Please refresh and try again.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleComplete = async (token: QueueToken) => {
    if (loadingAction) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      await updateTokenStatus(activeClinicId, token.id, 'COMPLETED');
    } catch (err: any) {
      setActionError(err.message || 'Queue changed. Please refresh and try again.');
    } finally {
      setLoadingAction(false);
    }
  };

  const getStatusBadge = (status: TokenStatus) => {
    switch (status) {
      case 'CALLED':
        return <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">CALLED</span>;
      case 'IN CONSULTATION':
        return <span className="bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">IN CONSULTATION</span>;
      case 'WAITING':
        return <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">WAITING</span>;
      case 'COMPLETED':
        return <span className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">COMPLETED</span>;
      case 'SKIPPED':
        return <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">SKIPPED</span>;
      case 'CANCELLED':
        return <span className="bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">CANCELLED</span>;
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* Top Doctor Filter Bar & Clinic Status Banner */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>FILTER BY DOCTOR:</span>
          <select
            value={selectedDoctorFilter}
            onChange={(e) => setSelectedDoctorFilter(e.target.value)}
            className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold focus:outline-none"
          >
            <option value="ALL">All Doctors Queue ({doctors.length})</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
            Active Tenant: <strong className="text-slate-800 dark:text-slate-200">{activeClinic?.name || (activeClinicId ? `Clinic: ${activeClinicId}` : 'None')}</strong>
          </span>
          <button
            onClick={onOpenPatientRegistration}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            + Register New Patient
          </button>
        </div>
      </div>

      {actionError && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-amber-600 hover:text-amber-800 font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Dashboard Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Today's Patients</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white font-mono">{totalToday}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Waiting</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl md:text-3xl font-black text-amber-500 font-mono">{String(waitingCount).padStart(2, '0')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">In Consultation</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl md:text-3xl font-black text-blue-500 font-mono">{String(inConsultationCount).padStart(2, '0')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl md:text-3xl font-black text-emerald-500 font-mono">{String(completedCount).padStart(2, '0')}</p>
        </div>
      </div>

      {/* Main Section: Current Token Console + Live View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* CURRENT TOKEN CALLING CONSOLE (Spans 2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Active Consultation Console {activeClinic?.name ? `(${activeClinic.name})` : ''}
                </p>
              </div>
              <button
                onClick={() => playTokenCallSound()}
                title="Test Call Chime Sound"
                className="text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Test Chime</span>
              </button>
            </div>

            {activeToken ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                
                {/* Big Token Display */}
                <div className="bg-slate-50 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">CURRENT TOKEN</span>
                  <h2 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white font-mono tracking-tight my-1">
                    {activeToken.tokenNumber}
                  </h2>
                  <div className="mt-2">
                    {getStatusBadge(activeToken.status)}
                  </div>
                </div>

                {/* Patient & Doctor Context */}
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient Name</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-white">{activeToken.patientName}</span>
                    <span className="text-slate-500 ml-2">({activeToken.patientAge || '30'}y / {activeToken.patientGender || 'M'})</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Doctor & Room</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeToken.doctorName}</span>
                    <span className="text-blue-600 font-semibold ml-2">({activeToken.roomNumber})</span>
                  </div>

                  {activeToken.reason && (
                    <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-400">Reason:</span> {activeToken.reason}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">No active consultation. Click "CALL NEXT" to call the next waiting patient.</p>
              </div>
            )}
          </div>

          {/* Action Control Buttons Grid */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2">
            <button
              onClick={handleCallNext}
              disabled={loadingAction || waitingCount === 0}
              className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PhoneCall className="w-4 h-4" />
              CALL NEXT
            </button>

            {activeToken && (
              <>
                <button
                  onClick={() => handleRecall(activeToken)}
                  disabled={loadingAction}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  RECALL
                </button>

                <button
                  onClick={() => handleSkip(activeToken)}
                  disabled={loadingAction}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  SKIP
                </button>

                {activeToken.status === 'CALLED' && (
                  <button
                    onClick={() => handleStartConsultation(activeToken)}
                    disabled={loadingAction}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    START CONSULT
                  </button>
                )}

                <button
                  onClick={() => handleComplete(activeToken)}
                  disabled={loadingAction}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ml-auto"
                >
                  <CheckCheck className="w-4 h-4" />
                  COMPLETE
                </button>
              </>
            )}
          </div>

        </div>

        {/* SIDE PREVIEW: Public Patient View Card */}
        <div className="bg-slate-900 rounded-xl p-4 text-white flex flex-col justify-between border border-slate-800 shadow-md">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                  Patient Portal Live View
                </span>
              </div>
              <button 
                onClick={onNavigateToPatientPortal}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold underline"
              >
                Open Full →
              </button>
            </div>

            <div className="bg-slate-800/90 rounded-xl p-4 border border-slate-700 text-center space-y-3">
              <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center mx-auto text-white">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-xs font-bold text-white uppercase">{activeClinic?.name || 'Clinic'}</p>

              <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">NOW SERVING</p>
                <p className="text-2xl font-black text-emerald-400 font-mono my-0.5">
                  {activeToken ? activeToken.tokenNumber : 'None'}
                </p>
              </div>

              <div className="space-y-1.5 text-[11px] pt-1">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Next Token:</span>
                  <span className="font-bold text-white font-mono">
                    {filteredTokens.find(t => t.status === 'WAITING')?.tokenNumber || 'None'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Total In Waiting:</span>
                  <span className="font-bold text-amber-400">{waitingCount} Patients</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 text-center">
            <p className="text-[10px] text-slate-400">
              Tenant isolated queue: <code className="text-blue-400 font-mono">/clinics/{activeClinicId}</code>
            </p>
          </div>
        </div>

      </div>

      {/* Live Queue Table Overview */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            Live Today's Queue ({filteredTokens.length})
          </h3>
          <button 
            onClick={onNavigateToQueuePage}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Manage Full Queue</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100 dark:border-slate-700">
                <th className="p-3">Token</th>
                <th className="p-3">Patient Name</th>
                <th className="p-3">Doctor</th>
                <th className="p-3">Time</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-700/60 font-medium text-slate-800 dark:text-slate-200">
              {filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    No tokens generated for today in this clinic. Click "Register Patient" to generate a token.
                  </td>
                </tr>
              ) : (
                filteredTokens.slice(0, 8).map((t) => (
                  <tr key={t.id} className={t.status === 'CALLED' ? 'bg-blue-50/50 dark:bg-blue-950/30' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'}>
                    <td className="p-3 font-bold font-mono text-slate-900 dark:text-white">{t.tokenNumber}</td>
                    <td className="p-3 font-semibold">{t.patientName}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{t.doctorName}</td>
                    <td className="p-3 text-slate-500 text-[11px]">
                      {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">{getStatusBadge(t.status)}</td>
                    <td className="p-3 text-right space-x-1">
                      {t.status === 'WAITING' && (
                        <button
                          onClick={async () => {
                            if (loadingAction) return;
                            setLoadingAction(true);
                            setActionError(null);
                            try {
                              await updateTokenStatus(activeClinicId, t.id, 'CALLED');
                              playTokenCallSound();
                            } catch (err: any) {
                              setActionError(err.message || 'Unable to call patient');
                            } finally {
                              setLoadingAction(false);
                            }
                          }}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          CALL
                        </button>
                      )}
                      {t.status === 'CALLED' && (
                        <button
                          onClick={() => handleStartConsultation(t)}
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          START
                        </button>
                      )}
                      {(t.status === 'CALLED' || t.status === 'IN CONSULTATION') && (
                        <button
                          onClick={() => handleComplete(t)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold cursor-pointer"
                        >
                          COMPLETE
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.action}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

    </div>
  );
};
