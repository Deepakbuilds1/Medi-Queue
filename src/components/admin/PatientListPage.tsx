import React, { useState } from 'react';
import { Users, Search, History, Edit2, X } from 'lucide-react';
import { Patient, QueueToken } from '../../types';
import { updatePatientRecord } from '../../services/clinicService';
import { useClinic } from '../../context/ClinicContext';

interface PatientListPageProps {
  patients: Patient[];
  tokens: QueueToken[];
}

export const PatientListPage: React.FC<PatientListPageProps> = ({ patients, tokens }) => {
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
    <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Registered Patient Directory {activeClinic?.name ? `(${activeClinic.name})` : ''}
            </h2>
            <p className="text-xs text-slate-500">Manage Patient Profiles & Consult History • Scoped to /clinics/{activeClinicId}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Name, Phone, ID..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Patient Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/80 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100 dark:border-slate-700">
                <th className="p-3.5">Patient ID</th>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Age / Gender</th>
                <th className="p-3.5">Phone Number</th>
                <th className="p-3.5">Last Visit</th>
                <th className="p-3.5">Total Visits</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-700/60 font-medium text-slate-800 dark:text-slate-200">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No patient records found in this clinic.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-blue-600 dark:text-blue-400">
                      {p.patientId}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {p.name}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400">
                      {p.age} yrs / {p.gender}
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300 font-mono">
                      {p.phone}
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {p.lastVisit || new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5">
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                        {p.totalVisits || 1}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedPatientHistory(p)}
                        title="View History"
                        className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>History</span>
                      </button>
                      <button
                        onClick={() => handleStartEdit(p)}
                        title="Edit Patient"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {selectedPatientHistory.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  ID: {selectedPatientHistory.patientId} • Phone: {selectedPatientHistory.phone}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPatientHistory(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visit & Token History</h4>
              
              {getPatientTokens(selectedPatientHistory.id, selectedPatientHistory.phone).length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No token history found for this patient in this clinic.</p>
              ) : (
                getPatientTokens(selectedPatientHistory.id, selectedPatientHistory.phone).map(t => (
                  <div key={t.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-blue-600 dark:text-blue-400 font-mono">{t.tokenNumber}</div>
                      <div className="text-slate-700 dark:text-slate-300 font-medium">{t.doctorName} ({t.roomNumber})</div>
                      <div className="text-[10px] text-slate-400">{new Date(t.createdAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 text-right">
              <button
                onClick={() => setSelectedPatientHistory(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Edit Patient Details</h3>
              <button onClick={() => setEditingPatient(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Age</label>
                  <input
                    type="number"
                    value={editAge}
                    onChange={(e) => setEditAge(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
