import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Building2, 
  ArrowLeft, 
  AlertCircle,
  Delete,
  Fingerprint,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { runAuthDiagnostics } from '../../services/authDiagnosticService';
import { safeRender, getErrorMessage } from '../../utils/errorUtils';

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
  const { verifySuperAdminPin } = useAuth();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedSeconds, setLockedSeconds] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Run startup diagnostics on mount
  useEffect(() => {
    runAuthDiagnostics().catch(() => {});
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockedSeconds === null || lockedSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockedSeconds((prev) => {
        if (prev === null || prev <= 1) {
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedSeconds]);

  // Clean up any pending network requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockedSeconds && lockedSeconds > 0) return;

    setError(null);
    const submittedPin = pin.trim();

    if (!submittedPin) {
      setError('Please enter the Super Admin Security PIN.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second request timeout

    setLoading(true);

    try {
      let response = await fetch('/api/super-admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ pin: submittedPin }),
        signal: controller.signal,
      });

      // Fallback to /api/super-admin/login if /auth returned 404
      if (response.status === 404) {
        response = await fetch('/api/super-admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ pin: submittedPin }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      // Handle non-JSON or HTML responses (e.g., if misconfigured or proxy error)
      const contentType = response.headers.get('content-type') || '';
      let data: any = {};

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const textResp = await response.text();
        if (textResp.startsWith('<!DOCTYPE html') || textResp.startsWith('<html')) {
          if (response.status === 503) {
            throw new Error('AUTH_SERVICE_UNAVAILABLE');
          }
          if (response.status === 500) {
            throw new Error('AUTH_SERVER_ERROR');
          }
          throw new Error('AUTH_ENDPOINT_UNAVAILABLE');
        }
        try {
          data = JSON.parse(textResp);
        } catch {
          throw new Error('AUTH_INVALID_RESPONSE');
        }
      }

      if (!response.ok || !data.success) {
        if (response.status === 401) {
          if (typeof data.remainingAttempts === 'number') {
            setRemainingAttempts(data.remainingAttempts);
            setError(`Invalid Super Admin PIN. ${data.remainingAttempts} attempt(s) remaining before lockout.`);
          } else {
            setError(data.message || data.error || 'Invalid Super Admin credentials.');
          }
        } else if (response.status === 403) {
          setError(data.message || data.error || 'You are not authorized to access the Super Admin portal.');
        } else if (response.status === 404) {
          setError('Super Admin authentication endpoint is unavailable. Please verify deployment configuration.');
        } else if (response.status === 429 || data.locked) {
          const remainingSec = data.remainingSeconds || 900;
          setLockedSeconds(remainingSec);
          setError(data.message || data.error || `Too many failed attempts. Temporary lockout active for ${remainingSec} seconds.`);
        } else if (response.status === 503 || data.code === 'AUTH_SERVICE_NOT_CONFIGURED') {
          setError(data.message || data.error || 'Super Admin authentication service is temporarily unavailable.');
        } else if (response.status === 502) {
          setError('Authentication gateway error (502 Bad Gateway). Please retry in a few moments.');
        } else if (response.status === 500 || data.code === 'SERVER_CONFIGURATION_ERROR') {
          setError(data.message || data.error || 'Super Admin authentication service encountered a server error.');
        } else if (response.status === 400) {
          setError(data.message || data.error || 'Super Admin PIN format is invalid.');
        } else {
          setError(data.message || data.error || 'Authentication failed. Please verify your PIN and try again.');
        }
        setPin('');
        return;
      }

      // Server verified successfully - apply session in AuthContext
      await verifySuperAdminPin(data.sessionToken, data.user);
      onLoginSuccess();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Authentication request timed out after 15 seconds. Please try again.');
      } else if (err?.message === 'AUTH_SERVICE_UNAVAILABLE') {
        setError('Super Admin authentication service is temporarily unavailable.');
      } else if (err?.message === 'AUTH_SERVER_ERROR') {
        setError('Super Admin authentication service encountered a server error.');
      } else if (err?.message === 'AUTH_ENDPOINT_UNAVAILABLE') {
        setError('Authentication server endpoint is currently unavailable. Please refresh or verify server status.');
      } else if (err?.message === 'AUTH_INVALID_RESPONSE') {
        setError('Authentication server returned an unexpected response format.');
      } else {
        setError('Unable to connect to the authentication service. Please check your connection.');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (digit: string) => {
    if (lockedSeconds && lockedSeconds > 0) return;
    if (pin.length < 12) {
      setPin((prev) => prev + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    if (lockedSeconds && lockedSeconds > 0) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    if (lockedSeconds && lockedSeconds > 0) return;
    setPin('');
    setError(null);
    setRemainingAttempts(null);
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

          <h2 className="text-xl font-black text-white tracking-tight">Root Verification</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Enter your master Super Admin PIN to authenticate administrative access.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 space-y-5">
          
          {/* Error / Lockout Alert */}
          {error && (
            <div role="alert" className="p-3 bg-red-950/60 border border-red-800/80 rounded-2xl flex items-start gap-2.5 text-xs text-red-200 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">{safeRender(error)}</span>
                {lockedSeconds !== null && lockedSeconds > 0 && (
                  <div className="mt-1 font-mono text-[11px] text-red-300 font-bold">
                    Retry in: {lockedSeconds}s
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* PIN Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Super Admin PIN</span>
                <span className="text-[10px] text-slate-500 font-normal">Server-Verified Security</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>

                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => {
                    if (!lockedSeconds || lockedSeconds <= 0) {
                      setPin(e.target.value);
                      setError(null);
                    }
                  }}
                  disabled={loading || (!!lockedSeconds && lockedSeconds > 0)}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full pl-10 pr-12 py-3 bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-center text-lg font-mono tracking-widest text-white placeholder-slate-600 transition-all disabled:opacity-50"
                />

                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Touch/Click Numpad */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  disabled={loading || (!!lockedSeconds && lockedSeconds > 0)}
                  className="py-2.5 bg-slate-800/80 hover:bg-slate-700/80 active:bg-indigo-600 active:text-white text-slate-200 font-bold text-base rounded-xl border border-slate-700/60 transition-colors cursor-pointer disabled:opacity-40 select-none shadow-xs"
                >
                  {digit}
                </button>
              ))}
              
              <button
                type="button"
                onClick={handleClear}
                disabled={loading || (!!lockedSeconds && lockedSeconds > 0)}
                className="py-2.5 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs rounded-xl border border-slate-700/40 transition-colors cursor-pointer disabled:opacity-40"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={loading || (!!lockedSeconds && lockedSeconds > 0)}
                className="py-2.5 bg-slate-800/80 hover:bg-slate-700/80 active:bg-indigo-600 active:text-white text-slate-200 font-bold text-base rounded-xl border border-slate-700/60 transition-colors cursor-pointer disabled:opacity-40 select-none shadow-xs"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                disabled={loading || (!!lockedSeconds && lockedSeconds > 0)}
                className="py-2.5 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs rounded-xl border border-slate-700/40 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || (!!lockedSeconds && lockedSeconds > 0) || !pin.trim()}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Unlocking Super Admin...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Unlock Super Admin Dashboard</span>
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
              <span>Clinic Admin Login (Email)</span>
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
