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
  Trash2,
  Filter
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
      title: 'Cancel Patient Token?',
      message: `Are you sure you want to cancel token ${token.tokenNumber} for ${token.patientName}? Cancelled tokens cannot automatically return to the waiting queue.`,
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
      message: `Are you sure you want to skip token ${token.tokenNumber} (${token.patientName})?`,
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
      message: `Are you sure you want to permanently delete token ${token.tokenNumber} for ${token.patientName}? This action cannot be undone.`,
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
    <div className="space-y-4 max-w-7xl mx-auto">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">
              Live Queue Management {activeClinic?.name ? `• ${activeClinic.name}` : ''}
            </h1>
            <p className="text-xs text-slate-500">Real-time token queue progression and action controls</p>
          </div>
        </div>

        <button
          onClick={() => playTokenCallSound()}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors"
        >
          <Volume2 className="w-3.5 h-3.5 text-teal-700" />
          <span>Test Audio Chime</span>
        </button>
      </div>

      {errorMessage && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-800 text-xs font-medium flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-amber-600 hover:text-amber-800 font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs">
        
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Token or Patient..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
          />
        </div>

        {/* Doctor Filter */}
        <div>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-700"
          >
            <option value="ALL">All Physicians ({doctors.length})</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name} • {d.roomNumber || 'Room'}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-700"
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
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <th className="p-3.5">Token</th>
                <th className="p-3.5">Patient Details</th>
                <th className="p-3.5">Physician & Room</th>
                <th className="p-3.5">Arrival Time</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 font-medium text-slate-800">
              {filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    No tokens match the current filter criteria for this clinic.
                  </td>
                </tr>
              ) : (
                filteredTokens.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* Token Number */}
                    <td className="p-3.5 font-bold font-mono text-base text-teal-800">
                      {t.tokenNumber}
                    </td>

                    {/* Patient */}
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{t.patientName}</div>
                      <div className="text-[11px] text-slate-500">
                        {t.patientAge || '30'}y / {t.patientGender || 'M'} • {t.patientPhone}
                      </div>
                    </td>

                    {/* Doctor */}
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800">{t.doctorName}</div>
                      <div className="text-[11px] text-teal-700 font-medium">{t.roomNumber}</div>
                    </td>

                    {/* Reg Time */}
                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                            disabled={loadingId === t.id}
                            className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>Call</span>
                          </button>
                        )}

                        {(t.status === 'CALLED' || t.status === 'SKIPPED') && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'CALLED')}
                            disabled={loadingId === t.id}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Recall</span>
                          </button>
                        )}

                        {t.status === 'CALLED' && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'IN CONSULTATION')}
                            disabled={loadingId === t.id}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Stethoscope className="w-3 h-3" />
                            <span>Start</span>
                          </button>
                        )}

                        {(t.status === 'CALLED' || t.status === 'IN CONSULTATION') && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'COMPLETED')}
                            disabled={loadingId === t.id}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCheck className="w-3 h-3" />
                            <span>Complete</span>
                          </button>
                        )}

                        {(t.status === 'WAITING' || t.status === 'CALLED') && (
                          <button
                            onClick={() => handleSkipClick(t)}
                            disabled={loadingId === t.id}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <FastForward className="w-3 h-3" />
                            <span>Skip</span>
                          </button>
                        )}

                        {t.status !== 'CANCELLED' && t.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleCancelClick(t)}
                            disabled={loadingId === t.id}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteClick(t)}
                          disabled={loadingId === t.id}
                          className="px-2 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                          title="Delete Token"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
