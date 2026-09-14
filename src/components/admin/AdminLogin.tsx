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
import { useAuth, parseAuthError, logAuthError } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { ClinicSettings, Clinic } from '../../types';
import { LegalDocType } from '../legal/LegalPagesModal';
import { normalizeFirebaseError, safeRender, AppErrorState } from '../../utils/errorUtils';
import { Button } from '../shared/Button';

interface AdminLoginProps {
  settings: ClinicSettings | null;
  onLoginSuccess: () => void;
  onNavigateToPatientPortal: () => void;
  onNavigateToSuperAdmin?: () => void;
  onOpenLegalDoc?: (doc: LegalDocType) => void;
  onOpenHelpCenter?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ 
  settings, 
  onLoginSuccess,
  onNavigateToPatientPortal,
  onNavigateToSuperAdmin,
  onOpenLegalDoc,
  onOpenHelpCenter,
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
  const [errorState, setErrorState] = useState<AppErrorState | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Selected clinic object
  const selectedClinic: Clinic | undefined = allClinics.find(c => c.id === selectedClinicId) || allClinics[0];

  const handleClinicAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorState(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorState(normalizeFirebaseError('Please enter both email and password.'));
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
      logAuthError('Admin Login', err);
      const normalized = normalizeFirebaseError(err, 'Login failed. Please check your credentials.');
      setErrorState(normalized);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setErrorState(null);
    try {
      await resetPassword(resetEmail.trim());
      setInfoMessage(`Password reset link sent to ${resetEmail.trim()}. Check your inbox.`);
      setShowForgotPassword(false);
    } catch (err: unknown) {
      logAuthError('Admin Password Reset', err);
      const normalized = normalizeFirebaseError(err, 'Failed to send reset email.');
      setErrorState(normalized);
    } finally {
      setResetLoading(false);
    }
  };

  const headerClinicName = selectedClinic?.name || settings?.clinicName || 'MediQueue Clinic';
  const headerClinicLogo = selectedClinic?.logo || settings?.clinicLogo;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 font-sans antialiased text-[#0F172A]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden relative z-10">
        
        {/* Header Clinic Branding */}
        <div className="px-8 pt-7 pb-5 border-b border-slate-100 text-center flex flex-col items-center bg-slate-50/50">
          {headerClinicLogo ? (
            <img 
              src={headerClinicLogo} 
              alt={headerClinicName} 
              className="w-14 h-14 rounded-2xl object-cover mb-3 border border-slate-200 shadow-xs"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-[#087F73] mb-3 shadow-xs">
              <Building2 className="w-7 h-7" />
            </div>
          )}

          <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">
            {headerClinicName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Clinic Administrator & Staff Portal
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 space-y-4">
          
          {/* Alerts */}
          {errorState && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 animate-in fade-in flex items-start gap-2">
              <span className="shrink-0 text-red-600 font-bold">✕</span>
              <span>{safeRender(errorState.message)}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 animate-in fade-in flex items-start gap-2">
              <span className="shrink-0 text-emerald-600 font-bold">✓</span>
              <span>{infoMessage}</span>
            </div>
          )}

          {/* CLINIC ADMIN FORM: Email & Password */}
          <form onSubmit={handleClinicAdminLogin} className="space-y-4">
            
            {/* Clinic Branch Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#087F73]" />
                <span>Assigned Clinic Branch</span>
              </label>

              <div className="relative">
                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 focus:border-[#087F73] focus:ring-2 focus:ring-[#087F73]/20 rounded-xl text-xs font-semibold text-[#0F172A] appearance-none cursor-pointer"
                >
                  {allClinics.map(clinic => (
                    <option key={clinic.id} value={clinic.id} className="bg-white text-slate-900">
                      {clinic.name} ({clinic.tokenPrefix || clinic.id})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {selectedClinic && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 pl-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{selectedClinic.address || 'Medical Facility'}</span>
                </div>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Admin Email Address</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorState(null);
                  }}
                  required
                  placeholder="admin@clinic.com"
                  className="w-full pl-3.5 pr-3.5 py-2 bg-slate-50 border border-slate-300 focus:border-[#087F73] focus:ring-2 focus:ring-[#087F73]/20 rounded-xl text-xs font-medium text-[#0F172A] placeholder-slate-400 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Password</span>
                </label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-[11px] text-[#087F73] hover:text-teal-800 font-semibold p-0 h-auto"
                >
                  Forgot password?
                </Button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorState(null);
                  }}
                  required
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-300 focus:border-[#087F73] focus:ring-2 focus:ring-[#087F73]/20 rounded-xl text-xs font-medium text-[#0F172A] placeholder-slate-400 transition-all"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 text-slate-400 hover:text-slate-600 hover:bg-transparent"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="Primary"
              size="md"
              fullWidth
              disabled={loading}
              isLoading={loading}
              leftIcon={<Building2 className="w-4 h-4" />}
              className="mt-2"
            >
              Sign In to {selectedClinic?.name || 'Clinic'}
            </Button>
          </form>

          {/* Navigation Links */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            {onNavigateToSuperAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onNavigateToSuperAdmin}
                className="text-slate-600 hover:text-[#087F73] py-1"
                leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-[#087F73]" />}
              >
                Super Admin Login
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNavigateToPatientPortal}
              className="text-slate-600 hover:text-[#087F73] py-1"
              leftIcon={<ArrowLeft className="w-3 h-3 text-slate-400" />}
            >
              Patient Portal
            </Button>
          </div>

          {/* Legal and Security Links */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1 text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#087F73]" />
              <span>RBAC Enforced</span>
            </span>
            {onOpenLegalDoc && (
              <div className="flex items-center gap-2 text-[10px]">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => onOpenLegalDoc('security')}
                  className="hover:text-[#087F73] p-0 h-auto text-[10px] text-slate-500"
                >
                  Security
                </Button>
                <span>•</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => onOpenLegalDoc('privacy')}
                  className="hover:text-[#087F73] p-0 h-auto text-[10px] text-slate-500"
                >
                  Privacy
                </Button>
                <span>•</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => onOpenLegalDoc('terms')}
                  className="hover:text-[#087F73] p-0 h-auto text-[10px] text-slate-500"
                >
                  Terms
                </Button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-[#087F73] flex items-center justify-center">
                <Key className="w-4 h-4 text-[#087F73]" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#0F172A]">Reset Clinic Password</h3>
                <p className="text-[11px] text-slate-500">Receive reset instructions by email</p>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="admin@clinic.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-[#0F172A] focus:border-[#087F73] focus:ring-2 focus:ring-[#087F73]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="Secondary"
                  size="sm"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="Primary"
                  size="sm"
                  disabled={resetLoading}
                  isLoading={resetLoading}
                >
                  Send Reset Link
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
