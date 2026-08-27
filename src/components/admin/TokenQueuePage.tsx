import React, { useState } from 'react';
import { 
  Ticket, 
  Search, 
  RotateCcw, 
  FastForward, 
  CheckCheck, 
  XCircle, 
  PhoneCall, 
  Stethoscope, 
  Volume2,
  Trash2
} from 'lucide-react';
import { Doctor, QueueToken, TokenStatus } from '../../types';
import { updateTokenStatus, deleteToken } from '../../services/clinicService';
import { playTokenCallSound } from '../../lib/sound';
import { ConfirmModal } from '../common/ConfirmModal';
import { useClinic } from '../../context/ClinicContext';

interface TokenQueuePageProps {
  tokens: QueueToken[];
  doctors: Doctor[];
}

export const TokenQueuePage: React.FC<TokenQueuePageProps> = ({ tokens, doctors }) => {
  const { activeClinicId, activeClinic } = useClinic();
  const [searchTerm, setSearchTerm] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning';
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    action: () => {}
  });

  const filteredTokens = tokens.filter((t) => {
    const matchesSearch = 
      t.tokenNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.patientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDoctor = doctorFilter === 'ALL' || t.doctorId === doctorFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesDoctor && matchesStatus;
  });

  const handleStatusChange = async (tokenId: string, status: TokenStatus) => {
    if (loadingId) return;
    setLoadingId(tokenId);
    setErrorMessage(null);
    try {
      if (status === 'CALLED') {
        playTokenCallSound();
      }
      await updateTokenStatus(activeClinicId, tokenId, status);
    } catch (err: any) {
      console.error('Status change error:', err);
      setErrorMessage(err.message || 'Queue changed. Please refresh and try again.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancelClick = (token: QueueToken) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Token?',
      message: `Are you sure you want to CANCEL token ${token.tokenNumber} for ${token.patientName}? Cancelled tokens cannot automatically return to the waiting queue.`,
      type: 'danger',
      action: async () => {
        if (loadingId) return;
        setLoadingId(token.id);
        setErrorMessage(null);
        try {
          await updateTokenStatus(activeClinicId, token.id, 'CANCELLED');
        } catch (err: any) {
          console.error('Cancel error:', err);
          setErrorMessage(err.message || 'Queue changed. Please refresh and try again.');
        } finally {
          setLoadingId(null);
        }
      }
    });
  };

  const handleSkipClick = (token: QueueToken) => {
    setConfirmModal({
      isOpen: true,
      title: 'Skip Patient Token?',
      message: `Are you sure you want to SKIP token ${token.tokenNumber}?`,
      type: 'warning',
      action: async () => {
        if (loadingId) return;
        setLoadingId(token.id);
        setErrorMessage(null);
        try {
          await updateTokenStatus(activeClinicId, token.id, 'SKIPPED');
        } catch (err: any) {
          console.error('Skip error:', err);
          setErrorMessage(err.message || 'Queue changed. Please refresh and try again.');
        } finally {
          setLoadingId(null);
        }
      }
    });
  };

  const handleDeleteClick = (token: QueueToken) => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete Token?',
      message: `Are you sure you want to PERMANENTLY DELETE token ${token.tokenNumber} for ${token.patientName}? This action cannot be undone and will permanently remove it from the live queue.`,
      type: 'danger',
      action: async () => {
        if (loadingId) return;
        setLoadingId(token.id);
        setErrorMessage(null);
        try {
          await deleteToken(activeClinicId, token.id);
        } catch (err: any) {
          console.error('Delete error:', err);
          setErrorMessage(err.message || 'Failed to delete token. Please try again.');
        } finally {
          setLoadingId(null);
        }
      }
    });
  };

  const getStatusBadge = (status: TokenStatus) => {
    switch (status) {
      case 'CALLED':
        return <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">CALLED</span>;
      case 'IN CONSULTATION':
        return <span className="bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">IN CONSULTATION</span>;
      case 'WAITING':
        return <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">WAITING</span>;
      case 'COMPLETED':
        return <span className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">COMPLETED</span>;
      case 'SKIPPED':
        return <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">SKIPPED</span>;
      case 'CANCELLED':
        return <span className="bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">CANCELLED</span>;
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* Header Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Token Queue Management {activeClinic?.name ? `(${activeClinic.name})` : ''}
            </h2>
            <p className="text-xs text-slate-500">Live Queue & Action Control Console • Isolated /clinics/{activeClinicId}</p>
          </div>
        </div>

        <button
          onClick={() => playTokenCallSound()}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          <Volume2 className="w-4 h-4 text-blue-500" />
          Test Chime
        </button>
      </div>

      {errorMessage && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-amber-600 hover:text-amber-800 font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Token or Patient..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Doctor Filter */}
        <div>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Doctors in Clinic</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.roomNumber})</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="WAITING">WAITING</option>
            <option value="CALLED">CALLED</option>
            <option value="IN CONSULTATION">IN CONSULTATION</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="SKIPPED">SKIPPED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

      </div>

      {/* Queue Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/80 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100 dark:border-slate-700">
                <th className="p-3.5">Token</th>
                <th className="p-3.5">Patient Details</th>
                <th className="p-3.5">Doctor & Room</th>
                <th className="p-3.5">Registration Time</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-700/60 font-medium text-slate-800 dark:text-slate-200">
              {filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No tokens matched your filter criteria for this clinic.
                  </td>
                </tr>
              ) : (
                filteredTokens.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                    
                    {/* Token Number */}
                    <td className="p-3.5 font-black font-mono text-base text-blue-600 dark:text-blue-400">
                      {t.tokenNumber}
                    </td>

                    {/* Patient */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{t.patientName}</div>
                      <div className="text-[11px] text-slate-400">
                        {t.patientAge || '30'}y / {t.patientGender || 'M'} • {t.patientPhone}
                      </div>
                    </td>

                    {/* Doctor */}
                    <td className="p-3.5">
                      <div className="font-semibold">{t.doctorName}</div>
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">{t.roomNumber}</div>
                    </td>

                    {/* Reg Time */}
                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      {getStatusBadge(t.status)}
                    </td>

                    {/* Action Controls */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        
                        {t.status === 'WAITING' && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'CALLED')}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <PhoneCall className="w-3 h-3" />
                            CALL
                          </button>
                        )}

                        {(t.status === 'CALLED' || t.status === 'SKIPPED') && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'CALLED')}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            RECALL
                          </button>
                        )}

                        {t.status === 'CALLED' && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'IN CONSULTATION')}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Stethoscope className="w-3 h-3" />
                            START
                          </button>
                        )}

                        {(t.status === 'CALLED' || t.status === 'IN CONSULTATION') && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'COMPLETED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCheck className="w-3 h-3" />
                            COMPLETE
                          </button>
                        )}

                        {(t.status === 'WAITING' || t.status === 'CALLED') && (
                          <button
                            onClick={() => handleSkipClick(t)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <FastForward className="w-3 h-3" />
                            SKIP
                          </button>
                        )}

                        {t.status !== 'CANCELLED' && t.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleCancelClick(t)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" />
                            CANCEL
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteClick(t)}
                          className="px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/60 text-red-700 dark:text-red-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          title="Permanently Delete Token"
                        >
                          <Trash2 className="w-3 h-3" />
                          DELETE
                        </button>

                      </div>
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
        type={confirmModal.type}
        onConfirm={confirmModal.action}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />

    </div>
  );
};
