import React, { useState, useEffect } from 'react';
import { PlusCircle, CheckCircle2, AlertCircle, Sparkles, User, LogIn, Building2 } from 'lucide-react';
import { Doctor, QueueToken } from '../../types';
import { subscribeDoctors, generateToken } from '../../services/clinicService';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { PatientAuthModal } from './PatientAuthModal';

interface BookTokenSectionProps {
  onTokenGenerated: (token: QueueToken) => void;
}

export const BookTokenSection: React.FC<BookTokenSectionProps> = ({ onTokenGenerated }) => {
  const { user, userProfile } = useAuth();
  const { activeClinicId, activeClinic, clinics, switchClinic } = useClinic();
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  
  // Patient details for guest or logged-in override
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [age, setAge] = useState<number>(30);
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setSelectedDoctorId('');
    const unsub = subscribeDoctors(activeClinicId, (docList) => {
      const active = docList.filter(d => d.status === 'ACTIVE');
      setDoctors(active);
      if (active.length > 0) {
        setSelectedDoctorId(active[0].id);
      }
    });
    return () => unsub();
  }, [activeClinicId]);

  // Sync state when userProfile loads or changes
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setPhone(userProfile.phone || '');
      setAge(userProfile.age || 30);
      setGender(userProfile.gender || 'Male');
    }
  }, [userProfile]);

  const handleBookToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedDoctorId) {
      setError('Please select a doctor for consultation.');
      return;
    }

    // Require Auth or prompt user
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!name.trim() || !phone.trim() || !age) {
      setError('Please provide patient name, phone number, and age.');
      return;
    }

    setLoading(true);
    try {
      const newToken = await generateToken({
        clinicId: activeClinicId,
        patientName: name.trim(),
        phone: phone.trim(),
        age: Number(age),
        gender,
        reason: reason.trim() || 'General Consultation',
        doctorId: selectedDoctorId,
        userId: user.uid,
      });

      onTokenGenerated(newToken);
      setReason('');
    } catch (err: any) {
      console.error('Token generation error:', err);
      setError(err.message || 'Failed to generate queue token. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const activeDoc = doctors.find(d => d.id === selectedDoctorId);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-5">
      
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
              Book Queue Token
            </h3>
            <p className="text-[11px] text-slate-500">
              {user ? `Logged in as ${userProfile?.name || user.email}` : 'Sign in or Sign up to generate a queue token'}
            </p>
          </div>
        </div>

        {/* Clinic Display / Selector */}
        {user && (userProfile?.role === 'PATIENT' || userProfile?.role === 'patient') ? (
          <div className="flex items-center gap-1.5 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200">
            <Building2 className="w-3.5 h-3.5 text-teal-700" />
            <span className="text-xs font-extrabold text-teal-900">
              {activeClinic?.name || userProfile?.clinicName || 'Registered Clinic'}
            </span>
          </div>
        ) : clinics.length > 1 ? (
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <select
              value={activeClinicId}
              onChange={(e) => switchClinic(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {clinics.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        {!user && (
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In / Sign Up
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleBookToken} className="space-y-4 text-xs">
        
        {/* 1. Doctor Selection */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
            1. Select Consulting Doctor at {activeClinic?.name || 'Clinic'} *
          </label>
          {doctors.length === 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 italic">
              No doctors currently available in this clinic.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {doctors.map((doc) => {
                const isSelected = doc.id === selectedDoctorId;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDoctorId(doc.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected 
                        ? 'border-2 border-teal-600 bg-teal-50/50 shadow-2xs' 
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <span className="font-extrabold text-slate-900 block">{doc.name}</span>
                      <span className="text-[10px] text-teal-700 font-semibold block">{doc.specialization}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{doc.roomNumber}</span>
                      <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">Prefix {doc.tokenPrefix}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Patient Profile Information */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-600" />
              2. Patient Information
            </span>
            {user && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified Firebase User
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Patient Full Name"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile / Phone Number"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Age & Gender</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold focus:border-teal-500 focus:outline-none text-center"
                />
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold focus:border-teal-500 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reason for Visit / Symptoms</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Fever, Dental checkup, Consultation"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={loading || !selectedDoctorId}
          className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          {loading 
            ? 'Generating Token...' 
            : user 
              ? `GENERATE TOKEN FOR ${activeDoc ? activeDoc.name : 'DOCTOR'}`
              : 'SIGN IN & GENERATE TOKEN'
          }
        </button>

      </form>

      {/* Auth Modal Trigger */}
      <PatientAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          // Retry generating token if doc was selected
        }}
      />

    </div>
  );
};
