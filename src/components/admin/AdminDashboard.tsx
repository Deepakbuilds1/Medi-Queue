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
  Filter,
  ArrowUpRight,
  Sparkles
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
        setActionError('No patients currently waiting in queue.');
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
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">CALLED</span>;
      case 'IN CONSULTATION':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">IN CONSULTATION</span>;
      case 'WAITING':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">WAITING</span>;
      case 'COMPLETED':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">COMPLETED</span>;
      case 'SKIPPED':
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">SKIPPED</span>;
      case 'CANCELLED':
        return <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">CANCELLED</span>;
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      
      {/* Top Filter & Control Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Filter className="w-3.5 h-3.5 text-teal-700" />
          <span>Physician Filter:</span>
          <select
            id="admin-doctor-filter-select"
            aria-label="Filter queue by doctor"
            value={selectedDoctorFilter}
            onChange={(e) => setSelectedDoctorFilter(e.target.value)}
            className="bg-slate-50 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-teal-700"
          >
            <option value="ALL">All Clinic Physicians ({doctors.length})</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name} • {d.specialization}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="hidden sm:inline">Facility:</span>
            <strong className="text-slate-800 font-semibold">{activeClinic?.name || 'MediQueue'}</strong>
          </div>

          <button
            onClick={onOpenPatientRegistration}
            className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Register Patient</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl text-amber-800 text-xs font-medium flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-amber-600 hover:text-amber-800 font-semibold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* KPI Cards (4 Balanced Clinical Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Waiting */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Patients Waiting</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-slate-900 font-mono tracking-tight">{waitingCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">In queue for consultation</p>
        </div>

        {/* In Consultation */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">In Consultation</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-teal-700" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-teal-700 font-mono tracking-tight">{inConsultationCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Active with physicians</p>
        </div>

        {/* Completed */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Completed Today</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-emerald-700 font-mono tracking-tight">{completedCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Visits completed</p>
        </div>

        {/* Total Registered */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Registered</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold text-slate-900 font-mono tracking-tight">{totalToday}</p>
          <p className="text-[11px] text-slate-500 mt-1">Total volume today</p>
        </div>

      </div>

      {/* Main Section: Calling Console & Public Display Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Active Consultation Console (Spans 2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-700 animate-pulse" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Active Consultation Console
                </h2>
              </div>
              <button
                onClick={() => playTokenCallSound()}
                title="Test Call Chime Sound"
                className="text-xs text-slate-600 hover:text-teal-700 flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Test Chime</span>
              </button>
            </div>

            {activeToken ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                
                {/* Big Token Display */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/80 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    ACTIVE TOKEN NUMBER
                  </span>
                  <div className="text-5xl md:text-6xl font-black text-slate-900 font-mono tracking-tight my-1">
                    {activeToken.tokenNumber}
                  </div>
                  <div className="mt-2">
                    {getStatusBadge(activeToken.status)}
                  </div>
                </div>

                {/* Patient & Doctor Context */}
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient Name</span>
                    <span className="font-bold text-sm text-slate-900">{activeToken.patientName}</span>
                    <span className="text-slate-500 ml-2">({activeToken.patientAge || '30'}y • {activeToken.patientGender || 'M'})</span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Physician & Room</span>
                    <span className="font-semibold text-slate-800">{activeToken.doctorName}</span>
                    <span className="text-teal-700 font-semibold ml-2">({activeToken.roomNumber})</span>
                  </div>

                  {activeToken.reason && (
                    <div className="p-2 bg-slate-50 rounded-md text-slate-600">
                      <span className="font-semibold text-slate-400">Chief Complaint:</span> {activeToken.reason}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-medium text-slate-500">No active consultation in progress. Click "Call Next" to summon the next patient.</p>
              </div>
            )}
          </div>

          {/* Action Control Buttons Grid */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-2 items-center">
            <button
              onClick={handleCallNext}
              disabled={loadingAction || waitingCount === 0}
              className="flex-1 min-w-[140px] bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white px-4 py-2.5 rounded-lg font-medium text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PhoneCall className="w-4 h-4" />
              <span>CALL NEXT PATIENT</span>
            </button>

            {activeToken && (
              <>
                <button
                  onClick={() => handleRecall(activeToken)}
                  disabled={loadingAction}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Recall</span>
                </button>

                <button
                  onClick={() => handleSkip(activeToken)}
                  disabled={loadingAction}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Skip</span>
                </button>

                {activeToken.status === 'CALLED' && (
                  <button
                    onClick={() => handleStartConsultation(activeToken)}
                    disabled={loadingAction}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3.5 py-2.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>Start Consult</span>
                  </button>
                )}

                <button
                  onClick={() => handleComplete(activeToken)}
                  disabled={loadingAction}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer ml-auto disabled:opacity-50"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Complete</span>
                </button>
              </>
            )}
          </div>

        </div>

        {/* Side Preview: Public Patient Waiting Room View */}
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Waiting Room Monitor
                </span>
              </div>
              <button 
                onClick={onNavigateToPatientPortal}
                className="text-[11px] text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
              >
                <span>Portal View</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center space-y-3">
              <div className="w-9 h-9 bg-teal-50 rounded-full flex items-center justify-center mx-auto text-teal-700">
                <Building2 className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-800 uppercase tracking-tight">{activeClinic?.name || 'Clinic'}</p>

              <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">NOW SERVING</p>
                <p className="text-2xl font-black text-teal-700 font-mono my-0.5">
                  {activeToken ? activeToken.tokenNumber : 'None'}
                </p>
              </div>

              <div className="space-y-1.5 text-xs pt-1">
                <div className="flex justify-between text-slate-600">
                  <span className="text-slate-400">Next In Line:</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {filteredTokens.find(t => t.status === 'WAITING')?.tokenNumber || 'None'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="text-slate-400">Patients In Queue:</span>
                  <span className="font-bold text-amber-700">{waitingCount} Waiting</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-center">
            <button
              onClick={onNavigateToQueuePage}
              className="text-xs text-teal-700 hover:text-teal-800 font-semibold flex items-center justify-center gap-1 mx-auto"
            >
              <span>View Full Queue Management</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Live Queue Table Overview */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-[#E2E8F0] bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Today's Queue ({filteredTokens.length})
          </h3>
          <button 
            onClick={onNavigateToQueuePage}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Manage All Tokens</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                <th className="p-3">Token</th>
                <th className="p-3">Patient Name</th>
                <th className="p-3">Physician</th>
                <th className="p-3">Arrival Time</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 font-medium text-slate-800">
              {filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No tokens registered for today in this clinic. Click "Register Patient" to add a patient.
                  </td>
                </tr>
              ) : (
                filteredTokens.slice(0, 10).map((t) => (
                  <tr key={t.id} className={t.status === 'CALLED' ? 'bg-teal-50/40' : 'hover:bg-slate-50/70 transition-colors'}>
                    <td className="p-3 font-bold font-mono text-teal-800">{t.tokenNumber}</td>
                    <td className="p-3 font-semibold text-slate-900">{t.patientName}</td>
                    <td className="p-3 text-slate-600">{t.doctorName}</td>
                    <td className="p-3 text-slate-500 text-[11px]">
                      {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">{getStatusBadge(t.status)}</td>
                    <td className="p-3 text-right space-x-1.5">
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
                          className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded text-[11px] font-medium cursor-pointer"
                        >
                          Call
                        </button>
                      )}
                      {t.status === 'CALLED' && (
                        <button
                          onClick={() => handleStartConsultation(t)}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-medium cursor-pointer"
                        >
                          Start
                        </button>
                      )}
                      {(t.status === 'CALLED' || t.status === 'IN CONSULTATION') && (
                        <button
                          onClick={() => handleComplete(t)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium cursor-pointer"
                        >
                          Done
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
