import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Building2, ShieldAlert, Key, CheckCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ClinicSettings } from '../../types';

interface AdminLoginProps {
  settings: ClinicSettings | null;
  onLoginSuccess: () => void;
  onNavigateToPatientPortal: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ 
  settings, 
  onLoginSuccess,
  onNavigateToPatientPortal 
}) => {
  const { login, registerAdmin, resetPassword } = useAuth();
  
  const [email, setEmail] = useState('gdeepak4689@gmail.com');
  const [password, setPassword] = useState('Deepakraj12@@');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      onLoginSuccess();
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      console.warn('Login attempt error:', firebaseError);

      // If user not found during demo login attempt, automatically register default admin
      if (
        (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/invalid-credential') &&
        email === 'gdeepak4689@gmail.com'
      ) {
        try {
          setInfoMessage('Initializing default admin account for first-time setup...');
          await registerAdmin(email, password);
          setInfoMessage(null);
          onLoginSuccess();
          return;
        } catch (regErr: unknown) {
          const regErrObj = regErr as { message?: string };
          setError(regErrObj.message || 'Failed to initialize default admin account.');
        }
      } else if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (firebaseError.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError(firebaseError.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoAdmin = async () => {
    setEmail('gdeepak4689@gmail.com');
    setPassword('Deepakraj12@@');
    setError(null);
    setLoading(true);

    try {
      await login('gdeepak4689@gmail.com', 'Deepakraj12@@');
      onLoginSuccess();
    } catch {
      try {
        await registerAdmin('gdeepak4689@gmail.com', 'Deepakraj12@@');
        onLoginSuccess();
      } catch (err: unknown) {
        const errObj = err as { message?: string };
        setError(errObj.message || 'Quick login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetLoading(true);
    setError(null);
    try {
      await resetPassword(resetEmail);
      setInfoMessage(`Password reset link sent to ${resetEmail}. Check your inbox.`);
      setShowForgotPassword(false);
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj.message || 'Failed to send reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const clinicName = settings?.clinicName || 'CITY CARE CLINIC';
  const clinicLogo = settings?.clinicLogo;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 font-sans antialiased text-slate-100 selection:bg-blue-500 selection:text-white">
      
      {/* Background Subtle Accent */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-950 pointer-events-none" />

      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden relative z-10">
        
        {/* Header Branding */}
        <div className="p-8 pb-6 border-b border-slate-700/60 text-center flex flex-col items-center">
          {clinicLogo ? (
            <img 
              src={clinicLogo} 
              alt={clinicName} 
              className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-600 shadow-md mb-3"
            />
          ) : (
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 mb-3">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight text-white">{clinicName}</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mt-1">Admin Portal Access</p>
        </div>

        {/* Login Form */}
        <div className="p-8">

          {error && (
            <div className="mb-5 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl flex items-start gap-3 text-red-200 text-xs leading-relaxed animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {infoMessage && (
            <div className="mb-5 p-3.5 bg-blue-950/60 border border-blue-500/40 rounded-xl flex items-start gap-3 text-blue-200 text-xs leading-relaxed animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>{infoMessage}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@clinic.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Sign In to Admin Dashboard
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div className="mt-6 pt-5 border-t border-slate-700/60 text-center space-y-3">
            <button
              type="button"
              onClick={handleQuickDemoAdmin}
              disabled={loading}
              className="w-full py-2 px-3 bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-600 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              1-Click Demo Admin Login
            </button>

            <div>
              <button
                type="button"
                onClick={onNavigateToPatientPortal}
                className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-4"
              >
                Go to Public Patient Portal →
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border border-slate-700 text-white space-y-4">
            <h3 className="text-base font-bold">Reset Admin Password</h3>
            <p className="text-xs text-slate-300">
              Enter your registered administrator email address. We will send you a password reset link.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="admin@clinic.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="px-3 py-1.5 bg-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-1.5 bg-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-500"
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
