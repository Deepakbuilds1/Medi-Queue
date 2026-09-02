import React, { useState, useEffect } from 'react';
import { 
  LogIn, 
  UserPlus, 
  X, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  ShieldCheck, 
  AlertCircle, 
  Building2, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Search,
  MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { parseAuthError, logAuthError } from '../../services/authErrorHandler';
import { Clinic } from '../../types';

interface PatientAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup';
  onOpenForgotPassword?: () => void;
  onOpenLegalDoc?: (doc: string) => void;
}

export const PatientAuthModal: React.FC<PatientAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signup',
  onOpenForgotPassword,
  onOpenLegalDoc,
}) => {
  const { signInPatient, signUpPatient } = useAuth();
  const { allClinics, switchClinic } = useClinic();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  // Active Clinics available for registration
  const activeClinics = allClinics.filter(c => c.status === 'ACTIVE');

  // Step 1: Selected Clinic
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [clinicSearch, setClinicSearch] = useState('');

  // Step 2 / Sign Up State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<number | ''>(28);
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected clinic when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setSignupStep(1);
      setError(null);
      if (activeClinics.length > 0 && !selectedClinicId) {
        setSelectedClinicId(activeClinics[0].id);
      }
    }
  }, [isOpen, initialMode, activeClinics.length]);

  if (!isOpen) return null;

  const selectedClinic = allClinics.find(c => c.id === selectedClinicId);

  const filteredClinics = activeClinics.filter(c => {
    if (!clinicSearch.trim()) return true;
    const q = clinicSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q);
  });

  const handleStep1Continue = () => {
    setError(null);
    if (!selectedClinicId) {
      setError('Please select a clinic to proceed with registration.');
      return;
    }
    const target = allClinics.find(c => c.id === selectedClinicId);
    if (!target || target.status !== 'ACTIVE') {
      setError('This clinic is currently unavailable. Please select another clinic.');
      return;
    }
    setSignupStep(2);
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate step 1 clinic selection
    if (!selectedClinic || selectedClinic.status !== 'ACTIVE') {
      setError('The selected clinic is currently unavailable. Please select another clinic.');
      setSignupStep(1);
      return;
    }

    // Validate inputs
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your mobile phone number.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters in length.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);
    try {
      const savedProfile = await signUpPatient(email.trim(), password, {
        name: name.trim(),
        phone: phone.trim(),
        age: age ? Number(age) : 30,
        gender,
        clinicId: selectedClinic.id,
        clinicName: selectedClinic.name
      });

      // Switch active clinic to registered clinic
      switchClinic(selectedClinic.id);

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      logAuthError('Patient Registration', err);
      const parsed = parseAuthError(err, 'Registration failed. Please try again.');
      setError(parsed.userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = signInEmail.trim();
    if (!cleanEmail || !signInPassword) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const profile = await signInPatient(cleanEmail, signInPassword);
      
      // Auto-switch clinic to patient's registered clinic
      if (profile?.clinicId) {
        switchClinic(profile.clinicId);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      logAuthError('Patient Sign In', err);
      const parsed = parseAuthError(err, 'Sign in failed. Please verify your email and password.');
      setError(parsed.userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 bg-teal-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-900 rounded-xl border border-teal-700">
              {mode === 'signup' ? <UserPlus className="w-5 h-5 text-teal-200" /> : <LogIn className="w-5 h-5 text-teal-200" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">
                {mode === 'signup' 
                  ? (signupStep === 1 ? 'Patient Signup — Select Clinic' : 'Patient Signup — Your Details')
                  : 'Patient Portal Sign In'
                }
              </h3>
              <p className="text-xs text-teal-200">
                {mode === 'signup' 
                  ? (signupStep === 1 ? 'Step 1 of 2: Choose your medical clinic' : `Step 2 of 2: Registering at ${selectedClinic?.name || 'Clinic'}`)
                  : 'Sign in to access your tokens and queue status'
                }
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-teal-200 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 shrink-0">
          <button
            type="button"
            onClick={() => { 
              setMode('signup'); 
              setSignupStep(1); 
              setError(null); 
            }}
            className={`flex-1 py-3 text-center transition-all cursor-pointer ${
              mode === 'signup' 
                ? 'bg-white text-teal-700 border-b-2 border-teal-600 font-extrabold shadow-2xs' 
                : 'hover:bg-slate-100'
            }`}
          >
            NEW PATIENT SIGN UP
          </button>
          <button
            type="button"
            onClick={() => { 
              setMode('signin'); 
              setError(null); 
            }}
            className={`flex-1 py-3 text-center transition-all cursor-pointer ${
              mode === 'signin' 
                ? 'bg-white text-teal-700 border-b-2 border-teal-600 font-extrabold shadow-2xs' 
                : 'hover:bg-slate-100'
            }`}
          >
            EXISTING PATIENT SIGN IN
          </button>
        </div>

        {/* Modal Body with Scroll */}
        <div className="p-5 overflow-y-auto flex-1 text-slate-800 text-xs space-y-4">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* SIGN UP: STEP 1 - SELECT CLINIC                              */}
          {/* ============================================================ */}
          {mode === 'signup' && signupStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Clinic for Registration *
                </label>
                <p className="text-[11px] text-slate-500 mb-3">
                  Your patient account will be permanently associated with your chosen clinic.
                </p>

                {/* Optional Search if more than 3 clinics */}
                {activeClinics.length > 2 && (
                  <div className="relative mb-3">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={clinicSearch}
                      onChange={(e) => setClinicSearch(e.target.value)}
                      placeholder="Search clinic name or address..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-teal-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                )}

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {filteredClinics.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 italic">
                      No active clinics found matching your search.
                    </div>
                  ) : (
                    filteredClinics.map((clinic) => {
                      const isSelected = clinic.id === selectedClinicId;
                      return (
                        <div
                          key={clinic.id}
                          onClick={() => {
                            setSelectedClinicId(clinic.id);
                            setError(null);
                          }}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                            isSelected
                              ? 'border-2 border-teal-600 bg-teal-50/60 shadow-xs'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                              isSelected ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
                            }`}>
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-xs">
                                  {clinic.name}
                                </span>
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                                  Active
                                </span>
                              </div>
                              {clinic.address && (
                                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{clinic.address}</span>
                                </p>
                              )}
                              {clinic.phone && (
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Tel: {clinic.phone}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 pt-1">
                            {isSelected ? (
                              <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center text-white">
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 border-2 border-slate-300 rounded-full" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStep1Continue}
                  disabled={!selectedClinicId}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>CONTINUE TO PATIENT DETAILS</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SIGN UP: STEP 2 - PATIENT DETAILS FORM                       */}
          {/* ============================================================ */}
          {mode === 'signup' && signupStep === 2 && (
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
              
              {/* Selected Clinic Banner */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-teal-800 uppercase block">Selected Clinic</span>
                    <span className="font-extrabold text-teal-950 text-xs">{selectedClinic?.name}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSignupStep(1)}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Full Patient Name *</label>
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
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Phone Number *</label>
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
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Age & Gender *</label>
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

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email Address *</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSignupStep(1)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{loading ? 'CREATING ACCOUNT...' : 'COMPLETE REGISTRATION'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* SIGN IN: EMAIL & PASSWORD (NO CLINIC SELECTOR ON LOGIN)       */}
          {/* ============================================================ */}
          {mode === 'signin' && (
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              
              <p className="text-[11px] text-slate-500">
                Sign in with your patient email and password. Your account will automatically connect to your registered clinic.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="patient@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-teal-500 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Password *</label>
                  {onOpenForgotPassword && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenForgotPassword();
                      }}
                      className="text-[10px] font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
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
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? 'AUTHENTICATING...' : 'SIGN IN TO PATIENT PORTAL'}</span>
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setSignupStep(1);
                    setError(null);
                  }}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                >
                  Don't have an account? Sign up here
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center shrink-0 space-y-1">
          <p className="text-[10px] text-slate-400">
            MediQueue OS • Multi-Tenant Clinic Isolation & Security
          </p>
          {onOpenLegalDoc && (
            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLegalDoc('privacy');
                }}
                className="hover:underline hover:text-teal-700"
              >
                Privacy Policy
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLegalDoc('terms');
                }}
                className="hover:underline hover:text-teal-700"
              >
                Terms of Service
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLegalDoc('disclaimer');
                }}
                className="hover:underline hover:text-amber-600 font-semibold"
              >
                Medical Disclaimer
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
