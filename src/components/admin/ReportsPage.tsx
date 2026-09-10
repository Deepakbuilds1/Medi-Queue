import React, { useState, useEffect } from 'react';
import { BarChart3, Download, FileSpreadsheet, Calendar, CheckCircle2, Clock, Activity, Users } from 'lucide-react';
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
   */
  const downloadTodayTokenStatisticsCSV = () => {
    const clinicName = activeClinic?.name || activeClinicId || 'Clinic';
    const todayDateStr = getTodayDateString();
    const generatedTimestamp = new Date().toLocaleString();

    const todayTotal = todayTokens.length;
    const todayCompleted = todayTokens.filter(t => t.status === 'COMPLETED').length;
    const todayWaiting = todayTokens.filter(t => t.status === 'WAITING').length;
    const todayInConsultation = todayTokens.filter(t => t.status === 'IN CONSULTATION' || t.status === 'CALLED').length;
    const todaySkipped = todayTokens.filter(t => t.status === 'SKIPPED').length;
    const todayCancelled = todayTokens.filter(t => t.status === 'CANCELLED').length;
    const completionRate = todayTotal > 0 ? ((todayCompleted / todayTotal) * 100).toFixed(1) : '0.0';

    const calcPct = (count: number) => (todayTotal > 0 ? ((count / todayTotal) * 100).toFixed(1) : '0.0');

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
      `Generated At,${escapeCsv(generatedTimestamp)}`,
      `Export Type,"Daily Operational Audit & KPI Statistics"`,
      '',
      '# -------------------------------------------------------------------------',
      '# 1. CLINICAL KPI SUMMARY',
      '# -------------------------------------------------------------------------',
      'Metric,Count,Percentage',
      `Total Tokens Registered,${todayTotal},100.0%`,
      `Completed Consultations,${todayCompleted},${calcPct(todayCompleted)}%`,
      `Currently Waiting,${todayWaiting},${calcPct(todayWaiting)}%`,
      `In Consultation / Called,${todayInConsultation},${calcPct(todayInConsultation)}%`,
      `Skipped Tokens,${todaySkipped},${calcPct(todaySkipped)}%`,
      `Cancelled Tokens,${todayCancelled},${calcPct(todayCancelled)}%`,
      `Overall Completion Rate,"${completionRate}%","-"`,
      '',
      '# -------------------------------------------------------------------------',
      '# 2. DOCTOR-WISE THROUGHPUT & QUEUE BREAKDOWN',
      '# -------------------------------------------------------------------------',
      'Doctor Name,Specialization,Room,Total Tokens,Completed,Waiting,In Consult,Skipped,Cancelled,Completion Rate',
      ...(todayDoctorStats.length > 0 ? todayDoctorStats : ['"No registered doctors for this clinic","-","-",0,0,0,0,0,0,"0.0%"']),
      '',
      '# -------------------------------------------------------------------------',
      '# 3. DETAILED TOKEN LEDGER (ALL OF TODAY)',
      '# -------------------------------------------------------------------------',
      'Token Number,Patient Name,Age,Gender,Phone,Assigned Doctor,Room,Status,Created At,Called At,Completed At,Queue Date',
      ...(tokenRows.length > 0 ? tokenRows : ['"No tokens registered today","-","-","-","-","-","-","-","-","-","-","-"'])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvSections.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    const sanitizedClinic = clinicName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    link.setAttribute('download', `mediqueue-token-statistics-${sanitizedClinic}-${todayDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFilteredCSV = () => {
    const headers = ['Token Number', 'Patient Name', 'Doctor', 'Room', 'Status', 'Date', 'Created Time'];
    const rows = reportTokens.map(t => [
      escapeCsv(t.tokenNumber),
      escapeCsv(t.patientName),
      escapeCsv(t.doctorName),
      escapeCsv(t.roomNumber),
      escapeCsv(t.status),
      escapeCsv(t.queueDate),
      escapeCsv(new Date(t.createdAt).toLocaleTimeString())
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      encodeURIComponent([headers.join(','), ...rows.map(e => e.join(','))].join('\n'));
    
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `mediqueue-report-${filter.toLowerCase()}-${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">
              Operational Analytics {activeClinic?.name ? `• ${activeClinic.name}` : ''}
            </h1>
            <p className="text-xs text-slate-500">Patient volume throughput, physician workload, and exportable ledger</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="download-today-stats-csv-btn"
            onClick={downloadTodayTokenStatisticsCSV}
            className="bg-teal-700 hover:bg-teal-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-200" />
            <span>Export Daily CSV</span>
            <span className="bg-teal-900/60 text-teal-100 text-[10px] px-1.5 py-0.5 rounded font-mono">
              {todayTokens.length} Today
            </span>
          </button>

          {filter !== 'TODAY' && (
            <button
              onClick={exportFilteredCSV}
              disabled={reportTokens.length === 0}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {filter.replace(/_/g, ' ')} ({reportTokens.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Reporting Window:</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => setFilter('TODAY')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${filter === 'TODAY' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('YESTERDAY')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${filter === 'YESTERDAY' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setFilter('LAST_7_DAYS')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${filter === 'LAST_7_DAYS' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setFilter('LAST_30_DAYS')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${filter === 'LAST_30_DAYS' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Volume</span>
          <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{totalCount}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[10px] uppercase font-bold text-emerald-700">Completed</span>
          <p className="text-2xl font-bold text-emerald-700 font-mono mt-1">{completedCount}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[10px] uppercase font-bold text-teal-700">Active Consult</span>
          <p className="text-2xl font-bold text-teal-700 font-mono mt-1">{inConsultationCount}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[10px] uppercase font-bold text-amber-700">Waiting</span>
          <p className="text-2xl font-bold text-amber-700 font-mono mt-1">{waitingCount}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500">Skipped</span>
          <p className="text-2xl font-bold text-slate-700 font-mono mt-1">{skippedCount}</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs col-span-2 md:col-span-1">
          <span className="text-[10px] uppercase font-bold text-red-600">Cancelled</span>
          <p className="text-2xl font-bold text-red-600 font-mono mt-1">{cancelledCount}</p>
        </div>
      </div>

      {/* Doctor-wise Breakdown Table & Chart */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Physician Patient Volume ({filter.replace(/_/g, ' ')})
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {doctors.length} Registered Staff
          </span>
        </div>

        <div className="space-y-2.5">
          {doctorStats.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No doctors found for this facility.
            </div>
          ) : (
            doctorStats.map((stat, idx) => {
              const percentage = totalCount > 0 ? Math.round((stat.total / totalCount) * 100) : 0;
              return (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span>{stat.name}</span>
                      <span className="text-slate-400 text-[11px] font-normal">({stat.specialization})</span>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                        Room {stat.roomNumber}
                      </span>
                    </div>
                    <div className="font-mono text-slate-700 text-xs">
                      <span className="font-bold text-teal-800">{stat.total} Patients</span> ({percentage}%)
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                    <div 
                      style={{ width: `${percentage}%` }} 
                      className="bg-teal-700 h-full rounded-full transition-all duration-300"
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 pt-0.5">
                    <span>Completed: <strong className="text-emerald-700">{stat.completed}</strong></span>
                    <span>Waiting: <strong className="text-amber-700">{stat.waiting}</strong></span>
                    <span>In Consult: <strong className="text-teal-700">{stat.inConsultation}</strong></span>
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
