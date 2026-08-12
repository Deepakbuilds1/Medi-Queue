import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Calendar, Users, CheckCircle, Clock, XCircle, FastForward } from 'lucide-react';
import { Doctor, QueueToken } from '../../types';
import { getTokensByDateRange, getTodayDateString } from '../../services/clinicService';

interface ReportsPageProps {
  doctors: Doctor[];
  todayTokens: QueueToken[];
}

type DateRangeFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS';

export const ReportsPage: React.FC<ReportsPageProps> = ({ doctors, todayTokens }) => {
  const [filter, setFilter] = useState<DateRangeFilter>('TODAY');
  const [reportTokens, setReportTokens] = useState<QueueToken[]>(todayTokens);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRangeTokens = async () => {
      setLoading(true);
      const today = new Date();
      let startDate = new Date();
      let endDate = new Date();

      if (filter === 'TODAY') {
        setReportTokens(todayTokens);
        setLoading(false);
        return;
      } else if (filter === 'YESTERDAY') {
        startDate.setDate(today.getDate() - 1);
        endDate.setDate(today.getDate() - 1);
      } else if (filter === 'LAST_7_DAYS') {
        startDate.setDate(today.getDate() - 6);
      } else if (filter === 'LAST_30_DAYS') {
        startDate.setDate(today.getDate() - 29);
      }

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      try {
        const list = await getTokensByDateRange(startStr, endStr);
        setReportTokens(list);
      } catch (err) {
        console.error('Failed to fetch report tokens:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRangeTokens();
  }, [filter, todayTokens]);

  // Aggregation
  const totalCount = reportTokens.length;
  const completedCount = reportTokens.filter(t => t.status === 'COMPLETED').length;
  const waitingCount = reportTokens.filter(t => t.status === 'WAITING').length;
  const cancelledCount = reportTokens.filter(t => t.status === 'CANCELLED').length;
  const skippedCount = reportTokens.filter(t => t.status === 'SKIPPED').length;

  // Doctor Breakdown
  const doctorStats = doctors.map(doc => {
    const docTokens = reportTokens.filter(t => t.doctorId === doc.id);
    return {
      name: doc.name,
      specialization: doc.specialization,
      total: docTokens.length,
      completed: docTokens.filter(t => t.status === 'COMPLETED').length,
      waiting: docTokens.filter(t => t.status === 'WAITING').length
    };
  });

  const exportCSV = () => {
    if (reportTokens.length === 0) return;
    const headers = ['Token Number', 'Patient Name', 'Age', 'Gender', 'Phone', 'Doctor', 'Room', 'Status', 'Date', 'Time'];
    const rows = reportTokens.map(t => [
      t.tokenNumber,
      `"${t.patientName}"`,
      t.patientAge || '',
      t.patientGender || '',
      t.patientPhone || '',
      `"${t.doctorName}"`,
      t.roomNumber || '',
      t.status,
      t.queueDate,
      new Date(t.createdAt).toLocaleTimeString()
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MediQueue_Report_${filter}_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Clinic Operational Reports</h2>
            <p className="text-xs text-slate-500">Patient Volume & Doctor Throughput Analytics</p>
          </div>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilter('TODAY')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filter === 'TODAY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('YESTERDAY')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filter === 'YESTERDAY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setFilter('LAST_7_DAYS')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filter === 'LAST_7_DAYS' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setFilter('LAST_30_DAYS')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filter === 'LAST_30_DAYS' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
          >
            Last 30 Days
          </button>
        </div>

        <button
          onClick={exportCSV}
          disabled={reportTokens.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Patients</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">{totalCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-emerald-600">Completed</span>
          <p className="text-2xl font-black text-emerald-600 font-mono mt-1">{completedCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-amber-500">Waiting</span>
          <p className="text-2xl font-black text-amber-500 font-mono mt-1">{waitingCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500">Skipped</span>
          <p className="text-2xl font-black text-slate-600 dark:text-slate-300 font-mono mt-1">{skippedCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs col-span-2 md:col-span-1">
          <span className="text-[10px] uppercase font-bold text-red-500">Cancelled</span>
          <p className="text-2xl font-black text-red-500 font-mono mt-1">{cancelledCount}</p>
        </div>
      </div>

      {/* Doctor-wise Breakdown Table & Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
          Doctor-Wise Patient Count Breakdown
        </h3>

        <div className="space-y-3">
          {doctorStats.map((stat, idx) => {
            const percentage = totalCount > 0 ? Math.round((stat.total / totalCount) * 100) : 0;
            return (
              <div key={idx} className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {stat.name} <span className="text-slate-400 text-[11px] font-normal">({stat.specialization})</span>
                  </div>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-blue-600 dark:text-blue-400">{stat.total} Patients</span> ({percentage}%)
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  <div 
                    style={{ width: `${percentage}%` }} 
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  />
                </div>

                <div className="flex gap-4 text-[10px] text-slate-500 pt-0.5">
                  <span>Completed: <strong className="text-emerald-600">{stat.completed}</strong></span>
                  <span>Waiting: <strong className="text-amber-500">{stat.waiting}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
