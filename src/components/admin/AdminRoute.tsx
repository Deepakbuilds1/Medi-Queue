import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { verifyUserAuthorization } from '../../services/clinicService';
import { AuthorizationResult, UserRole } from '../../types';
import { ShieldAlert, ArrowRight, LogOut, Lock, ShieldCheck, RefreshCw } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  onNavigateToPatientPortal?: () => void;
  onNavigateToLogin?: () => void;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({
  children,
  requiredRoles = ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN', 'DOCTOR', 'RECEPTIONIST'],
  onNavigateToPatientPortal,
  onNavigateToLogin
}) => {
  const { user, userProfile, authReady, loading: authLoading, logout, isSuperAdmin } = useAuth();
  const { activeClinicId, activeClinic } = useClinic();

  const [authStatus, setAuthStatus] = useState<{
    verifying: boolean;
    result: AuthorizationResult | null;
  }>({
    verifying: true,
    result: null
  });

  useEffect(() => {
    let isCancelled = false;

    const executeServerVerification = async () => {
      if (authLoading || !authReady) return;

      setAuthStatus(prev => ({ ...prev, verifying: true }));

      try {
        const result = await verifyUserAuthorization({
          clinicId: activeClinicId || undefined,
          requiredRole: requiredRoles,
          forceRefreshClaims: true
        });

        if (!isCancelled) {
          setAuthStatus({
            verifying: false,
            result
          });
        }
      } catch (err) {
        if (!isCancelled) {
          setAuthStatus({
            verifying: false,
            result: {
              isAuthorized: false,
              userId: user?.uid || null,
              email: user?.email || null,
              role: 'PATIENT',
              claims: {},
              isSuperAdmin: false,
              isClinicAdmin: false,
              isStaff: false,
              isPatient: true,
              authorizedClinicIds: [],
              hasClinicAccess: false,
              userProfile: null,
              reason: err instanceof Error ? err.message : 'Failed to verify authorization permissions.'
            }
          });
        }
      }
    };

    executeServerVerification();

    return () => {
      isCancelled = true;
    };
  }, [user, userProfile, activeClinicId, authReady, authLoading, isSuperAdmin]);

  // 1. Loading State
  if (authLoading || !authReady || authStatus.verifying) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-teal-950/80 border border-teal-800/80 flex items-center justify-center shadow-lg shadow-teal-950/50">
              <ShieldCheck className="w-6 h-6 text-teal-400 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-900 rounded-full flex items-center justify-center border border-slate-700">
              <RefreshCw className="w-3 h-3 text-slate-300 animate-spin" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white tracking-tight">Verifying Server Authorization</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Validating custom claims and Firestore security permissions...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const authResult = authStatus.result;

  // 2. Patient Account Denied View
  if (authResult?.isPatient || authResult?.role === 'PATIENT' || authResult?.role === 'patient') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-white selection:bg-rose-500 selection:text-white">
        <div className="w-full max-w-md bg-slate-900/95 border border-red-900/60 rounded-3xl p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-800/80 text-red-400 mx-auto flex items-center justify-center shadow-lg shadow-red-950/50">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-white tracking-tight">Access Denied: Patient Account</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              This account (<span className="text-slate-200 font-medium">{authResult?.email || user?.email}</span>) is verified as a <span className="text-red-300 font-semibold">Patient</span> and is strictly prohibited from accessing administrative portal data.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              id="admin-route-goto-patient-portal-btn"
              type="button"
              onClick={() => onNavigateToPatientPortal ? onNavigateToPatientPortal() : (window.location.href = '/patient')}
              className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Go to Patient Portal</span>
            </button>

            <button
              id="admin-route-switch-account-btn"
              type="button"
              onClick={async () => {
                await logout();
                if (onNavigateToLogin) onNavigateToLogin();
                else window.location.href = '/admin/login';
              }}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white font-semibold text-xs rounded-xl border border-slate-700/80 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out & Switch Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Unauthorized / Insufficient Privileges View
  if (!authResult || !authResult.isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-950/80 border border-amber-800/80 text-amber-400 mx-auto flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-white">Unauthorized Access</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {authResult?.reason || 'Your account does not possess the required server-verified authorization permissions for this medical facility.'}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              id="unauthorized-goto-patient-portal-btn"
              type="button"
              onClick={() => onNavigateToPatientPortal ? onNavigateToPatientPortal() : (window.location.href = '/patient')}
              className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Go to Patient Portal
            </button>
            <button
              id="unauthorized-switch-account-btn"
              type="button"
              onClick={async () => {
                await logout();
                if (onNavigateToLogin) onNavigateToLogin();
                else window.location.href = '/admin/login';
              }}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition-all cursor-pointer"
            >
              Sign In with Authorized Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authorized Access
  return <>{children}</>;
};
