import React, { useState, useEffect } from 'react';
import { BarChart3, Download, FileSpreadsheet, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { Doctor, QueueToken } from '../../types';
import { getTokensByDateRange, getTodayDateString } from '../../services/clinicService';
import { useClinic } from '../../context/ClinicContext';

interface ReportsPageProps {
  doctors: Doctor[];
  todayTokens: QueueToken[];
}

type DateRangeFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS';

export const ReportsPage: React.FC<ReportsPageProps> = ({ doctors, todayTokens }) => {
  const { activeClinicId, activeClinic } = useClinic();
  const [filter, setFilter] = useState<DateRangeFilter>('TODAY');
  const [reportTokens, setReportTokens] = useState<QueueToken[]>(todayTokens);
  const [_loading, setLoading] = useState(false);

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
        const list = await getTokensByDateRange(activeClinicId, startStr, endStr);
        setReportTokens(list);
      } catch (err) {
        console.error('Failed to fetch report tokens:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRangeTokens();
  }, [filter, todayTokens, activeClinicId]);

  // Aggregation for filtered range
  const totalCount = reportTokens.length;
  const completedCount = reportTokens.filter(t => t.status === 'COMPLETED').length;
  const waitingCount = reportTokens.filter(t => t.status === 'WAITING').length;
  const inConsultationCount = reportTokens.filter(t => t.status === 'IN CONSULTATION' || t.status === 'CALLED').length;
  const cancelledCount = reportTokens.filter(t => t.status === 'CANCELLED').length;
  const skippedCount = reportTokens.filter(t => t.status === 'SKIPPED').length;

  // Doctor Breakdown for filtered range
  const doctorStats = doctors.map(doc => {
    const docTokens = reportTokens.filter(t => t.doctorId === doc.id);
    return {
      name: doc.name,
      specialization: doc.specialization,
      roomNumber: doc.roomNumber || '-',
      total: docTokens.length,
      completed: docTokens.filter(t => t.status === 'COMPLETED').length,
      waiting: docTokens.filter(t => t.status === 'WAITING').length,
      inConsultation: docTokens.filter(t => t.status === 'IN CONSULTATION' || t.status === 'CALLED').length,
      skipped: docTokens.filter(t => t.status === 'SKIPPED').length,
      cancelled: docTokens.filter(t => t.status === 'CANCELLED').length,
    };
  });

  // Helper to safely format CSV cells with quote escaping
  const escapeCsv = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  /**
   * Download Current Day's Token Statistics CSV
   * Compiles executive KPI summary, doctor breakdown, and today's full token log.
   */
  const downloadTodayTokenStatisticsCSV = () => {
    const clinicName = activeClinic?.name || activeClinicId || 'Clinic';
    const todayDateStr = getTodayDateString();
    const generatedTimestamp = new Date().toLocaleString();

    // Calculations specifically for today's tokens
    const todayTotal = todayTokens.length;
    const todayCompleted = todayTokens.filter(t => t.status === 'COMPLETED').length;
    const todayWaiting = todayTokens.filter(t => t.status === 'WAITING').length;
    const todayInConsultation = todayTokens.filter(t => t.status === 'IN CONSULTATION' || t.status === 'CALLED').length;
    const todaySkipped = todayTokens.filter(t => t.status === 'SKIPPED').length;
    const todayCancelled = todayTokens.filter(t => t.status === 'CANCELLED').length;
    const completionRate = todayTotal > 0 ? ((todayCompleted / todayTotal) * 100).toFixed(1) : '0.0';

    const calcPct = (count: number) => (todayTotal > 0 ? ((count / todayTotal) * 100).toFixed(1) : '0.0');

    // Doctor breakdown specifically for today
    const todayDoctorStats = doctors.map(doc => {
      const dTokens = todayTokens.filter(t => t.doctorId === doc.id);
      const dTotal = dTokens.length;
      const dCompleted = dTokens.filter(t => t.status === 'COMPLETED').length;
      const dWaiting = dTokens.filter(t => t.status === 'WAITING').length;
      const dInConsult = dTokens.filter(t => t.status === 'IN CONSULTATION' || t.status === 'CALLED').length;
      const dSkipped = dTokens.filter(t => t.status === 'SKIPPED').length;
      const dCancelled = dTokens.filter(t => t.status === 'CANCELLED').length;
      const dRate = dTotal > 0 ? ((dCompleted / dTotal) * 100).toFixed(1) : '0.0';

      return [
        escapeCsv(doc.name),
        escapeCsv(doc.specialization),
        escapeCsv(doc.roomNumber || '-'),
        dTotal,
        dCompleted,
        dWaiting,
        dInConsult,
        dSkipped,
        dCancelled,
        `${dRate}%`
      ].join(',');
    });

    // Detailed token rows for today
    const tokenRows = todayTokens.map(t => {
      const createdTime = t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : '-';
      const calledTime = t.calledAt ? new Date(t.calledAt).toLocaleTimeString() : '-';
      const completedTime = t.completedAt ? new Date(t.completedAt).toLocaleTimeString() : '-';

      return [
        escapeCsv(t.tokenNumber),
        escapeCsv(t.patientName),
        escapeCsv(t.patientAge || '-'),
        escapeCsv(t.patientGender || '-'),
        escapeCsv(t.patientPhone || '-'),
        escapeCsv(t.doctorName),
        escapeCsv(t.roomNumber || '-'),
        escapeCsv(t.status),
        escapeCsv(createdTime),
        escapeCsv(calledTime),
        escapeCsv(completedTime),
        escapeCsv(t.queueDate)
      ].join(',');
    });

    const csvSections = [
      '# =========================================================================',
      `# MEDIQUEUE DAILY TOKEN STATISTICS REPORT`,
      '# =========================================================================',
      `Report Date,${escapeCsv(todayDateStr)}`,
      `Clinic Name,${escapeCsv(clinicName)}`,
      `Clinic ID,${escapeCsv(activeClinicId)}`,
      `Export Timestamp,${escapeCsv(generatedTimestamp)}`,
      '',
      '# =========================================================================',
      '# CURRENT DAY TOKEN SUMMARY METRICS',
      '# =========================================================================',
      'Metric,Count,Percentage',
      `Total Tokens Generated,${todayTotal},100%`,
      `Completed Consultations,${todayCompleted},${calcPct(todayCompleted)}%`,
      `Currently Waiting in Queue,${todayWaiting},${calcPct(todayWaiting)}%`,
      `In Consultation / Called,${todayInConsultation},${calcPct(todayInConsultation)}%`,
      `Skipped Tokens,${todaySkipped},${calcPct(todaySkipped)}%`,
      `Cancelled Tokens,${todayCancelled},${calcPct(todayCancelled)}%`,
      `Overall Completion Rate,${completionRate}%,-`,
      '',
      '# =========================================================================',
      '# DOCTOR-WISE TOKEN STATISTICS (TODAY)',
      '# =========================================================================',
      'Doctor Name,Specialization,Room,Total Tokens,Completed,Waiting,In Consultation,Skipped,Cancelled,Completion Rate',
      ...(todayDoctorStats.length > 0 ? todayDoctorStats : ['"No doctors assigned",-,-,0,0,0,0,0,0,0%']),
      '',
      '# =========================================================================',
      "TODAY'S INDIVIDUAL TOKEN RECORDS",
      '# =========================================================================',
      'Token Number,Patient Name,Age,Gender,Phone,Doctor Name,Room,Status,Created Time,Called Time,Completed Time,Queue Date',
      ...(tokenRows.length > 0 ? tokenRows : ['"No tokens issued today",-,-,-,-,-,-,-,-,-,-,-'])
    ];

    const csvContent = '\uFEFF' + csvSections.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MediQueue_Daily_Token_Statistics_${activeClinicId}_${todayDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Export Filtered Date Range CSV
   */
  const exportFilteredCSV = () => {
    if (reportTokens.length === 0) return;
    const headers = ['Token Number', 'Clinic', 'Patient Name', 'Age', 'Gender', 'Phone', 'Doctor', 'Room', 'Status', 'Date', 'Time'];
    const rows = reportTokens.map(t => [
      escapeCsv(t.tokenNumber),
      escapeCsv(activeClinic?.name || activeClinicId || 'Clinic'),
      escapeCsv(t.patientName),
      escapeCsv(t.patientAge || ''),
      escapeCsv(t.patientGender || ''),
      escapeCsv(t.patientPhone || ''),
      escapeCsv(t.doctorName),
      escapeCsv(t.roomNumber || ''),
      escapeCsv(t.status),
      escapeCsv(t.queueDate),
      escapeCsv(new Date(t.createdAt).toLocaleTimeString())
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MediQueue_Tokens_${activeClinicId}_${filter}_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Clinic Operational Reports</span>
              {activeClinic?.name && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                  {activeClinic.name}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">Patient Volume & Doctor Throughput Analytics • Scoped to /clinics/{activeClinicId}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Button: Download Current Day's Token Statistics CSV */}
          <button
            id="download-today-stats-csv-btn"
            onClick={downloadTodayTokenStatisticsCSV}
            title="Download full daily token statistics report including KPI summary, doctor breakdown, and token records"
            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer hover:shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Download Today's Statistics (CSV)</span>
            <span className="bg-emerald-800/60 text-emerald-100 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {todayTokens.length} Today
            </span>
          </button>

          {/* Secondary Export for Filtered Range */}
          {filter !== 'TODAY' && (
            <button
              onClick={exportFilteredCSV}
              disabled={reportTokens.length === 0}
              className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {filter.replace(/_/g, ' ')} ({reportTokens.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Filter & View Controller */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-semibold">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Select Time Range:</span>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilter('TODAY')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filter === 'TODAY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('YESTERDAY')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filter === 'YESTERDAY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setFilter('LAST_7_DAYS')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filter === 'LAST_7_DAYS' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setFilter('LAST_30_DAYS')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${filter === 'LAST_30_DAYS' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Patients</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">{totalCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-emerald-600">Completed</span>
          <p className="text-2xl font-black text-emerald-600 font-mono mt-1">{completedCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-blue-600">In Consult / Called</span>
          <p className="text-2xl font-black text-blue-600 font-mono mt-1">{inConsultationCount}</p>
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
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            Doctor-Wise Patient Count Breakdown ({filter.replace(/_/g, ' ')})
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {doctors.length} Doctors Registered
          </span>
        </div>

        <div className="space-y-3">
          {doctorStats.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No doctors found for this clinic.
            </div>
          ) : (
            doctorStats.map((stat, idx) => {
              const percentage = totalCount > 0 ? Math.round((stat.total / totalCount) * 100) : 0;
              return (
                <div key={idx} className="space-y-1.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{stat.name}</span>
                      <span className="text-slate-400 text-[11px] font-normal">({stat.specialization})</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                        Room {stat.roomNumber}
                      </span>
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

                  <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 pt-0.5">
                    <span>Completed: <strong className="text-emerald-600">{stat.completed}</strong></span>
                    <span>Waiting: <strong className="text-amber-500">{stat.waiting}</strong></span>
                    <span>In Consult: <strong className="text-blue-600">{stat.inConsultation}</strong></span>
                    <span>Skipped/Cancelled: <strong className="text-slate-600">{stat.skipped + stat.cancelled}</strong></span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};

