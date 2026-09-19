import React, { useState, useEffect, useMemo } from 'react';
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
import { Button } from '../shared/Button';

interface TokenQueuePageProps {
  tokens: QueueToken[];
  doctors: Doctor[];
  loading?: boolean;
}

export const TokenQueuePage: React.FC<TokenQueuePageProps> = ({ tokens, doctors, loading = false }) => {
  const { activeClinicId, activeClinic } = useClinic();
  const [searchTerm, setSearchTerm] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Optimistic overrides map (tokenId -> partial QueueToken)
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, Partial<QueueToken>>>({});
  // Optimistically deleted token IDs
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set());

  // Merge server tokens with optimistic overrides and deletions
  const effectiveTokens = useMemo(() => {
    return tokens
      .filter(t => !optimisticDeletedIds.has(t.id))
      .map(t => {
        const override = optimisticOverrides[t.id];
        return override ? { ...t, ...override } : t;
      });
  }, [tokens, optimisticOverrides, optimisticDeletedIds]);

  // Clean up optimistic overrides once the real-time listener delivers the updated status
  useEffect(() => {
    setOptimisticOverrides(prev => {
      const remaining: Record<string, Partial<QueueToken>> = {};
      let changed = false;
      for (const [id, override] of Object.entries(prev)) {
        const liveToken = tokens.find(t => t.id === id);
        if (!liveToken || liveToken.status === override.status) {
          changed = true;
        } else {
          remaining[id] = override;
        }
      }
      return changed ? remaining : prev;
    });

    setOptimisticDeletedIds(prev => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      for (const id of prev) {
        if (!tokens.some(t => t.id === id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tokens]);

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

  const filteredTokens = effectiveTokens.filter((t) => {
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

    // Optimistically update status
    const nowIso = new Date().toISOString();
    const updatePayload: Partial<QueueToken> = { status };
    if (status === 'CALLED') {
      updatePayload.calledAt = nowIso;
      playTokenCallSound();
    } else if (status === 'COMPLETED' || status === 'CANCELLED') {
      updatePayload.completedAt = nowIso;
    }

    setOptimisticOverrides(prev => ({
      ...prev,
      [tokenId]: updatePayload
    }));

    try {
      await updateTokenStatus(activeClinicId, tokenId, status);
    } catch (err: any) {
      console.error('Status change error:', err);
      // Rollback on failure
      setOptimisticOverrides(prev => {
        const next = { ...prev };
        delete next[tokenId];
        return next;
      });
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

        // Optimistically mark as CANCELLED
        const nowIso = new Date().toISOString();
        setOptimisticOverrides(prev => ({
          ...prev,
          [token.id]: { status: 'CANCELLED', completedAt: nowIso }
        }));

        try {
          await updateTokenStatus(activeClinicId, token.id, 'CANCELLED');
        } catch (err: any) {
          console.error('Cancel error:', err);
          // Rollback on failure
          setOptimisticOverrides(prev => {
            const next = { ...prev };
            delete next[token.id];
            return next;
          });
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

        // Optimistically mark as SKIPPED
        setOptimisticOverrides(prev => ({
          ...prev,
          [token.id]: { status: 'SKIPPED' }
        }));

        try {
          await updateTokenStatus(activeClinicId, token.id, 'SKIPPED');
        } catch (err: any) {
          console.error('Skip error:', err);
          // Rollback on failure
          setOptimisticOverrides(prev => {
            const next = { ...prev };
            delete next[token.id];
            return next;
          });
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

        // Optimistically remove token from view
        setOptimisticDeletedIds(prev => new Set(prev).add(token.id));

        try {
          await deleteToken(activeClinicId, token.id);
        } catch (err: any) {
          console.error('Delete error:', err);
          // Rollback on failure
          setOptimisticDeletedIds(prev => {
            const next = new Set(prev);
            next.delete(token.id);
            return next;
          });
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

        <Button
          type="button"
          variant="Secondary"
          size="sm"
          onClick={() => playTokenCallSound()}
          leftIcon={<Volume2 className="w-3.5 h-3.5 text-teal-700" />}
        >
          Test Audio Chime
        </Button>
      </div>

      {errorMessage && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-800 text-xs font-medium flex items-center justify-between">
          <span>{errorMessage}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            className="text-amber-600 hover:text-amber-800 font-bold ml-2 p-1 h-auto"
            aria-label="Dismiss error"
          >
            ✕
          </Button>
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
            <tbody id="token-queue-table-body" className="text-xs divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr
                    key={`token-skeleton-row-${index}`}
                    id={`token-skeleton-row-${index}`}
                    className="animate-pulse"
                  >
                    {/* Token Number */}
                    <td className="p-3.5">
                      <div
                        id={`token-skeleton-badge-${index}`}
                        className={`h-7 bg-slate-200/80 rounded-md ${index % 2 === 0 ? 'w-16' : 'w-14'}`}
                      />
                    </td>

                    {/* Patient */}
                    <td className="p-3.5">
                      <div className={`h-4 bg-slate-200/80 rounded mb-1.5 ${index % 3 === 0 ? 'w-36' : index % 2 === 0 ? 'w-28' : 'w-32'}`} />
                      <div className={`h-3 bg-slate-100 rounded ${index % 2 === 0 ? 'w-44' : 'w-36'}`} />
                    </td>

                    {/* Doctor */}
                    <td className="p-3.5">
                      <div className={`h-4 bg-slate-200/80 rounded mb-1 ${index % 2 === 0 ? 'w-28' : 'w-32'}`} />
                      <div className="h-3 w-16 bg-slate-100 rounded" />
                    </td>

                    {/* Reg Time */}
                    <td className="p-3.5">
                      <div className="h-3.5 w-14 bg-slate-200/80 rounded" />
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      <div className={`h-5 bg-slate-200/80 rounded-full ${index % 2 === 0 ? 'w-20' : 'w-24'}`} />
                    </td>

                    {/* Action Controls */}
                    <td className="p-3.5 text-right">
                      <div className="inline-block h-7 w-20 bg-slate-200/80 rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : filteredTokens.length === 0 ? (
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
                          <Button
                            type="button"
                            variant="Primary"
                            size="sm"
                            onClick={() => handleStatusChange(t.id, 'CALLED')}
                            disabled={loadingId === t.id}
                            leftIcon={<PhoneCall className="w-3 h-3" />}
                            className="text-[11px] py-1 px-2.5 h-auto"
                          >
                            Call
                          </Button>
                        )}

                        {(t.status === 'CALLED' || t.status === 'SKIPPED') && (
                          <Button
                            type="button"
                            variant="Secondary"
                            size="sm"
                            onClick={() => handleStatusChange(t.id, 'CALLED')}
                            disabled={loadingId === t.id}
                            leftIcon={<RotateCcw className="w-3 h-3" />}
                            className="text-[11px] py-1 px-2.5 h-auto"
                          >
                            Recall
                          </Button>
                        )}

                        {t.status === 'CALLED' && (
                          <Button
                            type="button"
                            variant="Secondary"
                            size="sm"
                            onClick={() => handleStatusChange(t.id, 'IN CONSULTATION')}
                            disabled={loadingId === t.id}
                            leftIcon={<Stethoscope className="w-3 h-3" />}
                            className="text-[11px] py-1 px-2.5 h-auto bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                          >
                            Start
                          </Button>
                        )}

                        {(t.status === 'CALLED' || t.status === 'IN CONSULTATION') && (
                          <Button
                            type="button"
                            variant="Secondary"
                            size="sm"
                            onClick={() => handleStatusChange(t.id, 'COMPLETED')}
                            disabled={loadingId === t.id}
                            leftIcon={<CheckCheck className="w-3 h-3" />}
                            className="text-[11px] py-1 px-2.5 h-auto bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                          >
                            Complete
                          </Button>
                        )}

                        {(t.status === 'WAITING' || t.status === 'CALLED') && (
                          <Button
                            type="button"
                            variant="Secondary"
                            size="sm"
                            onClick={() => handleSkipClick(t)}
                            disabled={loadingId === t.id}
                            leftIcon={<FastForward className="w-3 h-3" />}
                            className="text-[11px] py-1 px-2 h-auto"
                          >
                            Skip
                          </Button>
                        )}

                        {t.status !== 'CANCELLED' && t.status !== 'COMPLETED' && (
                          <Button
                            type="button"
                            variant="Destructive"
                            size="sm"
                            onClick={() => handleCancelClick(t)}
                            disabled={loadingId === t.id}
                            leftIcon={<XCircle className="w-3 h-3" />}
                            className="text-[11px] py-1 px-2 h-auto"
                          >
                            Cancel
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(t)}
                          disabled={loadingId === t.id}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 w-7 h-7"
                          title="Delete Token"
                          aria-label="Delete Token"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>

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
