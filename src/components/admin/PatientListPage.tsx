import React, { useState } from 'react';
import { Users, Search, History, Edit2, X, Phone, Calendar, Clock, FileText } from 'lucide-react';
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
            <tbody className="text-xs divide-y divide-slate-100 font-medium text-slate-800">
              {filteredPatients.length === 0 ? (
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
                      <button
                        onClick={() => setSelectedPatientHistory(p)}
                        title="View History"
                        className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>History</span>
                      </button>
                      <button
                        onClick={() => handleStartEdit(p)}
                        title="Edit Patient"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
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
              <button 
                onClick={() => setSelectedPatientHistory(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
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
              <button
                onClick={() => setSelectedPatientHistory(null)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-xs font-medium rounded-lg text-slate-700 cursor-pointer"
              >
                Close
              </button>
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
              <button onClick={() => setEditingPatient(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
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
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
