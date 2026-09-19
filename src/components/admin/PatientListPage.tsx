import React, { useState } from 'react';
import { Users, Search, History, Edit2, X, Phone, Calendar, Clock, FileText } from 'lucide-react';
import { Patient, QueueToken } from '../../types';
import { updatePatientRecord } from '../../services/clinicService';
import { useClinic } from '../../context/ClinicContext';
import { Button } from '../shared/Button';

interface PatientListPageProps {
  patients: Patient[];
  tokens: QueueToken[];
  loading?: boolean;
}

export const PatientListPage: React.FC<PatientListPageProps> = ({ patients, tokens, loading = false }) => {
  const { activeClinicId, activeClinic } = useClinic();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected Patient Modals
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState<number>(30);
  const [editPhone, setEditPhone] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [savingEdit, setSavingEdit] = useState(false);

  const filteredPatients = patients.filter((p) => {
    const query = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.patientId.toLowerCase().includes(query) ||
      p.phone.includes(query)
    );
  });

  const handleStartEdit = (p: Patient) => {
    setEditingPatient(p);
    setEditName(p.name);
    setEditAge(p.age);
    setEditPhone(p.phone);
    setEditGender(p.gender);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    setSavingEdit(true);
    try {
      await updatePatientRecord(activeClinicId, editingPatient.id, {
        name: editName,
        age: editAge,
        phone: editPhone,
        gender: editGender
      });
      setEditingPatient(null);
    } catch (err) {
      console.error('Failed to update patient:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const getPatientTokens = (patientRecordId: string, phone: string) => {
    return tokens.filter(t => t.patientId === patientRecordId || t.patientPhone === phone);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">
              Patient Directory {activeClinic?.name ? `• ${activeClinic.name}` : ''}
            </h1>
            <p className="text-xs text-slate-500">Comprehensive patient records, visit histories, and demographic data</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Name, Phone, ID..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
          />
        </div>
      </div>

      {/* Patient Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <th className="p-3.5">Patient ID</th>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Demographics</th>
                <th className="p-3.5">Phone Number</th>
                <th className="p-3.5">Last Visit</th>
                <th className="p-3.5">Visits</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="patient-list-table-body" className="text-xs divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr
                    key={`patient-skeleton-row-${index}`}
                    id={`patient-skeleton-row-${index}`}
                    className="animate-pulse"
                  >
                    {/* Patient ID */}
                    <td className="p-3.5">
                      <div
                        id={`patient-skeleton-id-${index}`}
                        className="h-4 w-20 bg-slate-200/80 rounded font-mono"
                      />
                    </td>

                    {/* Name */}
                    <td className="p-3.5">
                      <div className={`h-4 bg-slate-200/80 rounded ${index % 3 === 0 ? 'w-36' : index % 2 === 0 ? 'w-28' : 'w-32'}`} />
                    </td>

                    {/* Demographics */}
                    <td className="p-3.5">
                      <div className={`h-3.5 bg-slate-200/80 rounded ${index % 2 === 0 ? 'w-24' : 'w-20'}`} />
                    </td>

                    {/* Phone Number */}
                    <td className="p-3.5">
                      <div className="h-3.5 w-28 bg-slate-200/80 rounded font-mono" />
                    </td>

                    {/* Last Visit */}
                    <td className="p-3.5">
                      <div className="h-3.5 w-20 bg-slate-200/80 rounded" />
                    </td>

                    {/* Visits */}
                    <td className="p-3.5">
                      <div className="h-5 w-8 bg-slate-200/80 rounded" />
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right space-x-1.5">
                      <div className="inline-block h-7 w-18 bg-slate-200/80 rounded-lg" />
                      <div className="inline-block h-7 w-14 bg-slate-200/80 rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400">
                    No patient records found matching your search.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-teal-800">
                      {p.patientId}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900">
                      {p.name}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {p.age} yrs • {p.gender}
                    </td>
                    <td className="p-3.5 text-slate-700 font-mono text-[11px]">
                      {p.phone}
                    </td>
                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {p.lastVisit || new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {p.totalVisits || 1}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5">
                      <Button
                        variant="Secondary"
                        size="sm"
                        onClick={() => setSelectedPatientHistory(p)}
                        title="View History"
                        leftIcon={<History className="w-3.5 h-3.5" />}
                      >
                        History
                      </Button>
                      <Button
                        variant="Secondary"
                        size="sm"
                        onClick={() => handleStartEdit(p)}
                        title="Edit Patient"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient History Modal */}
      {selectedPatientHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {selectedPatientHistory.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  ID: {selectedPatientHistory.patientId} • Phone: {selectedPatientHistory.phone}
                </p>
              </div>
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPatientHistory(null)}
                aria-label="Close history modal"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Consultation & Token Log</h4>
              
              {getPatientTokens(selectedPatientHistory.id, selectedPatientHistory.phone).length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No token history found for this patient in this facility.</p>
              ) : (
                getPatientTokens(selectedPatientHistory.id, selectedPatientHistory.phone).map(t => (
                  <div key={t.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-teal-800 font-mono">{t.tokenNumber}</div>
                      <div className="text-slate-800 font-medium">{t.doctorName} • {t.roomNumber}</div>
                      <div className="text-[10px] text-slate-400">{new Date(t.createdAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-white border border-slate-200 text-slate-700">
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-[#E2E8F0] text-right">
              <Button
                variant="Secondary"
                size="sm"
                onClick={() => setSelectedPatientHistory(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Edit Patient Record</h3>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setEditingPatient(null)} 
                aria-label="Close edit modal"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                  <input
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-teal-700"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="Secondary"
                  size="sm"
                  onClick={() => setEditingPatient(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="Primary"
                  size="sm"
                  disabled={savingEdit}
                  isLoading={savingEdit}
                >
                  Save Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
