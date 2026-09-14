import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail,
  Eye, 
  EyeOff, 
  Building2, 
  ArrowLeft, 
  AlertCircle,
  Fingerprint,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { runAuthDiagnostics } from '../../services/authDiagnosticService';
import { safeRender } from '../../utils/errorUtils';
import { Button } from '../shared/Button';

interface SuperAdminLoginProps {
  onLoginSuccess: () => void;
  onNavigateToClinicAdmin: () => void;
  onNavigateToPatientPortal: () => void;
}

export const SuperAdminLogin: React.FC<SuperAdminLoginProps> = ({
  onLoginSuccess,
  onNavigateToClinicAdmin,
  onNavigateToPatientPortal,
}) => {
  const { loginSuperAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Run startup diagnostics on mount
  useEffect(() => {
    runAuthDiagnostics().catch(() => {});
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setError(null);
    const cleanEmail = email.trim();
    const cleanPassword = password;

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!cleanPassword) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      // Authenticate through Firebase Authentication with strict Super Admin access control
      await loginSuperAdmin(cleanEmail, cleanPassword);
      onLoginSuccess();
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please check your credentials and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 font-sans antialiased text-[#0F172A]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden relative z-10">
        
        {/* Header Badge */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100 text-center flex flex-col items-center bg-slate-50/50">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-[#087F73] mb-3.5 shadow-xs">
            <ShieldCheck className="w-8 h-8" />
          </div>
          
          <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[#087F73] text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
            <Fingerprint className="w-3 h-3" />
            Super Administrator Portal
          </span>

          <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">Super Admin Sign In</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Central governance, facility provisioning, and cross-clinic security controls.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 space-y-5">
          
          {/* Error Alert */}
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">{safeRender(error)}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Super Admin Email</span>
                <span className="text-[10px] text-slate-400 font-normal">Firebase Authentication</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 focus:border-[#087F73] focus:ring-2 focus:ring-[#087F73]/20 rounded-xl text-sm text-[#0F172A] placeholder-slate-400 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Password</span>
                <span className="text-[10px] text-slate-400 font-normal">Secure Authentication</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  disabled={loading}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-300 focus:border-[#087F73] focus:ring-2 focus:ring-[#087F73]/20 rounded-xl text-sm text-[#0F172A] placeholder-slate-400 transition-all disabled:opacity-50"
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

            {/* Login Button */}
            <Button
              type="submit"
              variant="Primary"
              size="lg"
              fullWidth
              disabled={loading || !email.trim() || !password}
              isLoading={loading}
              leftIcon={<ShieldCheck className="w-4 h-4" />}
              className="mt-2"
            >
              Sign In as Super Admin
            </Button>
          </form>

          {/* Navigation Links to Clinic Admin and Patient Portal */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNavigateToClinicAdmin}
              className="text-slate-600 hover:text-[#087F73] py-1"
              leftIcon={<Building2 className="w-3.5 h-3.5 text-slate-400" />}
            >
              Clinic Admin Login
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNavigateToPatientPortal}
              className="text-slate-600 hover:text-[#087F73] py-1"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5 text-slate-400" />}
            >
              Patient Portal
            </Button>
          </div>

        </div>

      </div>

      {/* Security Footer Notice */}
      <div className="mt-6 text-center text-slate-500 text-xs flex items-center gap-1.5">
        <Lock className="w-3 h-3 text-[#087F73]" />
        <span>End-to-End Encrypted Session & Strict Server Role Verification</span>
      </div>
    </div>
  );
};
