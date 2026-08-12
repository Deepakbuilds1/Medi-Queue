import React, { useState } from 'react';
import { LogIn, UserPlus, X, Mail, Lock, User, Phone, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface PatientAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup';
}

export const PatientAuthModal: React.FC<PatientAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signup'
}) => {
  const { signInPatient, signUpPatient } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  
  // Sign In State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sign Up State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<number | ''>(28);
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim() || !phone.trim() || !age) {
          setError('Please fill in all required patient fields.');
          setLoading(false);
          return;
        }
        await signUpPatient(email.trim(), password, {
          name: name.trim(),
          phone: phone.trim(),
          age: Number(age),
          gender,
        });
      } else {
        await signInPatient(email.trim(), password);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Patient Auth Error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 bg-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-800 rounded-xl border border-teal-600">
              {mode === 'signup' ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">
                {mode === 'signup' ? 'Patient Sign Up' : 'Patient Sign In'}
              </h3>
              <p className="text-xs text-teal-100">
                {mode === 'signup' ? 'Create profile to book queue tokens' : 'Sign in to access your queue tokens'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-teal-200 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-3 text-center transition-all cursor-pointer ${
              mode === 'signup' ? 'bg-white text-teal-700 border-b-2 border-teal-600 font-extrabold shadow-2xs' : 'hover:bg-slate-100'
            }`}
          >
            NEW PATIENT SIGN UP
          </button>
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(null); }}
            className={`flex-1 py-3 text-center transition-all cursor-pointer ${
              mode === 'signin' ? 'bg-white text-teal-700 border-b-2 border-teal-600 font-extrabold shadow-2xs' : 'hover:bg-slate-100'
            }`}
          >
            EXISTING PATIENT SIGN IN
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-slate-800 text-xs">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Full Patient Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Phone Number *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Age & Gender *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min={1}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      placeholder="Age"
                      className="w-16 px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none text-center font-bold"
                    />
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="flex-1 px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none font-semibold text-xs"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@example.com"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading 
                ? 'Processing...' 
                : mode === 'signup' 
                  ? 'CREATE PATIENT ACCOUNT' 
                  : 'SIGN IN TO PATIENT PORTAL'
              }
            </button>
          </div>

          <div className="text-center pt-1">
            <p className="text-[11px] text-slate-400">
              Your patient details will be securely stored in Firebase Firestore.
            </p>
          </div>

        </form>

      </div>
    </div>
  );
};
