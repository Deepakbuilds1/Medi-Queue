import React, { useState } from 'react';
import { Stethoscope, Plus, Edit, UserCheck, UserX, X, Building2 } from 'lucide-react';
import { Doctor } from '../../types';
import { addDoctor, updateDoctor } from '../../services/clinicService';
import { useClinic } from '../../context/ClinicContext';

interface DoctorManagementPageProps {
  doctors: Doctor[];
}

export const DoctorManagementPage: React.FC<DoctorManagementPageProps> = ({ doctors }) => {
  const { activeClinicId, activeClinic } = useClinic();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [tokenPrefix, setTokenPrefix] = useState('A');
  const [saving, setSaving] = useState(false);

  const handleOpenAdd = () => {
    setName('');
    setSpecialization('');
    setRoomNumber(`Room ${doctors.length + 1}`);
    const nextPrefixChar = String.fromCharCode(65 + (doctors.length % 26));
    setTokenPrefix(nextPrefixChar);
    setShowAddModal(true);
  };

  const handleOpenEdit = (doc: Doctor) => {
    setEditingDoctor(doc);
    setName(doc.name);
    setSpecialization(doc.specialization);
    setRoomNumber(doc.roomNumber);
    setTokenPrefix(doc.tokenPrefix);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addDoctor(activeClinicId, {
        name: name.trim(),
        specialization: specialization.trim() || 'General Practitioner',
        roomNumber: roomNumber.trim() || 'Room 1',
        tokenPrefix: tokenPrefix.trim().toUpperCase() || 'A',
        status: 'ACTIVE'
      });
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add doctor:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    setSaving(true);
    try {
      await updateDoctor(activeClinicId, editingDoctor.id, {
        name,
        specialization,
        roomNumber,
        tokenPrefix: tokenPrefix.toUpperCase()
      });
      setEditingDoctor(null);
    } catch (err) {
      console.error('Failed to update doctor:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (doctor: Doctor) => {
    const newStatus = doctor.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await updateDoctor(activeClinicId, doctor.id, { status: newStatus });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Doctor Directory {activeClinic?.name ? `(${activeClinic.name})` : ''}
            </h2>
            <p className="text-xs text-slate-500">Configure Doctor Profiles, Rooms, and Token Prefix Assignments</p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          + Add New Doctor
        </button>
      </div>

      {/* Doctor Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {doctors.map((doc) => {
          const isActive = doc.status === 'ACTIVE';
          return (
            <div 
              key={doc.id}
              className={`
                bg-white dark:bg-slate-800 rounded-2xl p-5 border transition-all shadow-xs flex flex-col justify-between space-y-4
                ${isActive ? 'border-slate-200 dark:border-slate-700' : 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50 dark:bg-slate-900'}
              `}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold rounded-xl flex items-center justify-center text-sm border border-blue-200 dark:border-blue-900">
                      {doc.tokenPrefix}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">{doc.name}</h3>
                      <p className="text-xs text-slate-500 font-medium">{doc.specialization}</p>
                    </div>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {doc.status}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Assigned Room:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{doc.roomNumber}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Token Prefix:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">"{doc.tokenPrefix}-"</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <button
                  onClick={() => handleToggleStatus(doc)}
                  className={`text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    isActive 
                      ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100' 
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                </button>

                <button
                  onClick={() => handleOpenEdit(doc)}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Add / Edit Doctor Modal */}
      {(showAddModal || editingDoctor) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="font-bold text-base">
                {showAddModal ? 'Add Doctor Profile' : 'Edit Doctor Profile'}
              </h3>
              <button 
                onClick={() => { setShowAddModal(false); setEditingDoctor(null); }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleSaveAdd : handleSaveEdit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Doctor Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Sharma"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Specialization</label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. General Physician, Dentist, Cardiologist..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Room Number</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. Room 1"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Token Prefix</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={tokenPrefix}
                    onChange={(e) => setTokenPrefix(e.target.value)}
                    placeholder="e.g. A"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingDoctor(null); }}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-500 shadow-xs cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Doctor Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
