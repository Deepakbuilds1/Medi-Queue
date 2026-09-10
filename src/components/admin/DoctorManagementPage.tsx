import React, { useState, useRef } from 'react';
import { Stethoscope, Plus, Edit, UserCheck, UserX, X, Building2, UploadCloud, Loader2, Image as ImageIcon } from 'lucide-react';
import { Doctor } from '../../types';
import { addDoctor, updateDoctor, uploadDoctorAvatar } from '../../services/clinicService';
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenAdd = () => {
    setName('');
    setSpecialization('');
    setRoomNumber(`Room ${doctors.length + 1}`);
    const nextPrefixChar = String.fromCharCode(65 + (doctors.length % 26));
    setTokenPrefix(nextPrefixChar);
    setAvatarFile(null);
    setAvatarPreview('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (doc: Doctor) => {
    setEditingDoctor(doc);
    setName(doc.name);
    setSpecialization(doc.specialization);
    setRoomNumber(doc.roomNumber);
    setTokenPrefix(doc.tokenPrefix);
    setAvatarFile(null);
    setAvatarPreview(doc.avatarUrl || '');
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const newDoc = await addDoctor(activeClinicId, {
        name: name.trim(),
        specialization: specialization.trim() || 'General Practitioner',
        roomNumber: roomNumber.trim() || 'Room 1',
        tokenPrefix: tokenPrefix.trim().toUpperCase() || 'A',
        status: 'ACTIVE'
      });

      if (avatarFile && newDoc?.id) {
        setUploadingAvatar(true);
        await uploadDoctorAvatar(activeClinicId, newDoc.id, avatarFile);
      }

      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add doctor:', err);
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
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

      if (avatarFile) {
        setUploadingAvatar(true);
        await uploadDoctorAvatar(activeClinicId, editingDoctor.id, avatarFile);
      }

      setEditingDoctor(null);
    } catch (err) {
      console.error('Failed to update doctor:', err);
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  };

  const handleToggleStatus = async (doctor: Doctor) => {
    const newStatus = doctor.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await updateDoctor(activeClinicId, doctor.id, { status: newStatus });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">
              Medical Staff Directory {activeClinic?.name ? `• ${activeClinic.name}` : ''}
            </h1>
            <p className="text-xs text-slate-500">Physicians, consultation rooms, and queue prefix routing</p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Physician</span>
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
                bg-white rounded-xl p-4 border transition-colors shadow-xs flex flex-col justify-between space-y-3.5
                ${isActive ? 'border-[#E2E8F0]' : 'border-slate-200 opacity-60 bg-slate-50/50'}
              `}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {doc.avatarUrl ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-xs bg-slate-100 shrink-0">
                        <img 
                          src={doc.avatarUrl} 
                          alt={doc.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-teal-50 text-teal-700 font-bold rounded-lg flex items-center justify-center text-sm border border-teal-100 shrink-0">
                        {doc.tokenPrefix}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900">{doc.name}</h3>
                      <p className="text-xs text-slate-500">{doc.specialization}</p>
                    </div>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                    {doc.status}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Assigned Room:</span>
                    <span className="font-semibold text-slate-900">{doc.roomNumber}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Token Prefix:</span>
                    <span className="font-mono font-bold text-teal-800">"{doc.tokenPrefix}-"</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleToggleStatus(doc)}
                  className={`text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                    isActive 
                      ? 'text-amber-700 bg-amber-50/70 border-amber-200 hover:bg-amber-100' 
                      : 'text-emerald-700 bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                  <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                </button>

                <button
                  onClick={() => handleOpenEdit(doc)}
                  className="text-xs font-medium text-slate-700 hover:text-teal-800 flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  <Edit className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Add / Edit Doctor Modal */}
      {(showAddModal || editingDoctor) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-[#E2E8F0] overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">
                {showAddModal ? 'Add Physician Profile' : 'Edit Physician Profile'}
              </h3>
              <button 
                onClick={() => { setShowAddModal(false); setEditingDoctor(null); }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={showAddModal ? handleSaveAdd : handleSaveEdit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Physician Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Sarah Jenkins"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Specialization</label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Internal Medicine, Pediatrics, Cardiology"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Room</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. Room 102"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Queue Prefix (Letter)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={tokenPrefix}
                    onChange={(e) => setTokenPrefix(e.target.value)}
                    placeholder="e.g. A"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold uppercase text-slate-800 focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              {/* Doctor Avatar Profile Picture */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Staff Photo / Avatar (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarSelect}
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Stored in cloud storage for this clinic
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingDoctor(null); }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-medium rounded-lg text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingAvatar}
                  className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {(saving || uploadingAvatar) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving || uploadingAvatar ? 'Saving...' : 'Save Physician'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
