import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Mail, 
  Building2, 
  ShieldCheck, 
  ChevronDown, 
  MapPin,
  ArrowLeft,
  Key
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { ClinicSettings, Clinic } from '../../types';

interface AdminLoginProps {
  settings: ClinicSettings | null;
  onLoginSuccess: () => void;
  onNavigateToPatientPortal: () => void;
  onNavigateToSuperAdmin?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ 
  settings, 
  onLoginSuccess,
  onNavigateToPatientPortal,
  onNavigateToSuperAdmin
}) => {
  const { login, resetPassword } = useAuth();
  const { allClinics, switchClinic, activeClinicId } = useClinic();

  // Clinic selection for Clinic Admin login
  const [selectedClinicId, setSelectedClinicId] = useState<string>(() => {
    return activeClinicId || (allClinics.length > 0 ? allClinics[0].id : '');
  });

  // Clinic Admin Email & Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Selected clinic object
  const selectedClinic: Clinic | undefined = allClinics.find(c => c.id === selectedClinicId) || allClinics[0];

  const handleClinicAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      // Authenticate clinic staff user with Firebase Auth and verify backend role authorization
      const authenticatedProfile = await login(trimmedEmail, password, selectedClinicId);

      // Set active clinic for Clinic Admin portal
      const targetId = selectedClinicId || authenticatedProfile?.clinicId || (authenticatedProfile?.clinicIds && authenticatedProfile.clinicIds[0]);
      if (targetId) {
        switchClinic(targetId);
      }

      onLoginSuccess();
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      
      if (
        firebaseError.code === 'auth/wrong-password' || 
        firebaseError.code === 'auth/invalid-credential' || 
        firebaseError.code === 'auth/user-not-found'
      ) {
        setError('Invalid clinic admin email or password. Please verify your credentials and try again.');
      } else if (firebaseError.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError(firebaseError.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setError(null);
    try {
      await resetPassword(resetEmail.trim());
      setInfoMessage(`Password reset link sent to ${resetEmail.trim()}. Check your inbox.`);
      setShowForgotPassword(false);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'Failed to send reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const headerClinicName = selectedClinic?.name || settings?.clinicName || 'MediQueue Clinic';
  const headerClinicLogo = selectedClinic?.logo || settings?.clinicLogo;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans antialiased text-slate-100 selection:bg-emerald-500 selection:text-white">
      
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.12),rgba(255,255,255,0))] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative z-10">
        
        {/* Header Clinic Branding */}
        <div className="px-8 pt-7 pb-5 border-b border-slate-800/60 text-center flex flex-col items-center">
          {headerClinicLogo ? (
            <img 
              src={headerClinicLogo} 
              alt={headerClinicName} 
              className="w-14 h-14 rounded-2xl object-cover mb-3.5 border border-slate-700 shadow-md"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3.5 shadow-md shadow-emerald-600/20">
              <Building2 className="w-7 h-7" />
            </div>
          )}

          <h2 className="text-xl font-bold text-white tracking-tight">
            {headerClinicName}
          </h2>
          
          <p className="text-xs text-slate-400 mt-1">
            Clinic Administrator & Staff Portal
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 space-y-4">
          
          {/* Alerts */}
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 animate-in fade-in flex items-start gap-2">
              <span className="shrink-0 text-red-400 font-bold">✕</span>
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 animate-in fade-in flex items-start gap-2">
              <span className="shrink-0 text-emerald-400 font-bold">✓</span>
              <span>{infoMessage}</span>
            </div>
          )}

          {/* CLINIC ADMIN FORM: Email & Password */}
          <form onSubmit={handleClinicAdminLogin} className="space-y-4">
            
            {/* Clinic Branch Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Assigned Clinic Branch</span>
              </label>

              <div className="relative">
                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs font-semibold text-white appearance-none cursor-pointer"
                >
                  {allClinics.map(clinic => (
                    <option key={clinic.id} value={clinic.id} className="bg-slate-900 text-white">
                      {clinic.name} ({clinic.tokenPrefix || clinic.id})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {selectedClinic && (
                <div className="flex items-center gap-1 text-[11px] text-slate-400 pl-1">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{selectedClinic.address || 'Medical Facility'}</span>
                </div>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Admin Email Address</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  required
                  placeholder="admin@clinic.com"
                  className="w-full pl-3.5 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs font-medium text-white placeholder-slate-500 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Password</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  required
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs font-medium text-white placeholder-slate-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4" />
                  <span>Sign In to {selectedClinic?.name || 'Clinic'}</span>
                </>
              )}
            </button>
          </form>

          {/* Navigation Links */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            {onNavigateToSuperAdmin && (
              <button
                type="button"
                onClick={onNavigateToSuperAdmin}
                className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer py-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Super Admin (PIN Only)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onNavigateToPatientPortal}
              className="text-slate-400 hover:text-slate-200 font-medium transition-colors flex items-center gap-1 cursor-pointer py-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Patient Portal</span>
            </button>
          </div>

        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Reset Clinic Password</h3>
                <p className="text-[11px] text-slate-400">Receive reset instructions by email</p>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="admin@clinic.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
