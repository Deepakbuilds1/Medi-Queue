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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans antialiased text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(255,255,255,0))] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative z-10">
        
        {/* Header Badge */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-800/80 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-600/20">
            <ShieldCheck className="w-9 h-9" />
          </div>
          
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider mb-2 flex items-center gap-1">
            <Fingerprint className="w-3 h-3" />
            Super Administrator Portal
          </span>

          <h2 className="text-xl font-black text-white tracking-tight">Super Admin Sign In</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Enter your authenticated credentials to access central system governance.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 space-y-5">
          
          {/* Error Alert */}
          {error && (
            <div role="alert" className="p-3 bg-red-950/60 border border-red-800/80 rounded-2xl flex items-start gap-2.5 text-xs text-red-200 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">{safeRender(error)}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Super Admin Email</span>
                <span className="text-[10px] text-slate-500 font-normal">Firebase Authentication</span>
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
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-slate-100 placeholder-slate-500 text-sm transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Password</span>
                <span className="text-[10px] text-slate-500 font-normal">Secure Authentication</span>
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
                  className="w-full pl-10 pr-12 py-3 bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-slate-100 placeholder-slate-500 text-sm transition-all disabled:opacity-50"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In as Super Admin</span>
                </>
              )}
            </button>
          </form>

          {/* Navigation Links to Clinic Admin and Patient Portal */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={onNavigateToClinicAdmin}
              className="text-slate-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1.5 cursor-pointer py-1"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Clinic Admin Login</span>
            </button>

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

      {/* Security Footer Notice */}
      <div className="mt-6 text-center text-slate-600 text-xs flex items-center gap-1.5">
        <Lock className="w-3 h-3" />
        <span>End-to-End Encrypted Session & Strict Server Verification</span>
      </div>
    </div>
  );
};
