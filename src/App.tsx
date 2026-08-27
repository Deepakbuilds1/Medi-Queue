import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClinicProvider, useClinic } from './context/ClinicContext';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminRoute as AdminRouteGuard } from './components/admin/AdminRoute';
import { AdminLogin } from './components/admin/AdminLogin';
import { SuperAdminLogin } from './components/admin/SuperAdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TokenQueuePage } from './components/admin/TokenQueuePage';
import { PatientListPage } from './components/admin/PatientListPage';
import { DoctorManagementPage } from './components/admin/DoctorManagementPage';
import { ReportsPage } from './components/admin/ReportsPage';
import { SettingsPage } from './components/admin/SettingsPage';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { PatientRegistrationModal } from './components/admin/PatientRegistrationModal';
import { TokenReceiptModal } from './components/common/TokenReceiptModal';
import { PatientPortal } from './components/patient/PatientPortal';
import { PublicDisplay } from './components/display/PublicDisplay';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { WifiOff, RefreshCw, ShieldAlert, LogOut, ArrowRight, Building2 } from 'lucide-react';
import { auth } from './lib/firebase';
import { 
  ClinicSettings, 
  Doctor, 
  Patient, 
  QueueToken, 
  AdminRoute 
} from './types';
import { 
  subscribeSettings, 
  subscribeDoctors, 
  subscribePatients, 
  subscribeTodayTokens 
} from './services/clinicService';

const MainAppContent: React.FC = () => {
  const { user, userProfile, loading: authLoading, authReady, isSuperAdmin, isClinicAdmin, isClinicStaff, userRole, logout } = useAuth();
  const { activeClinicId, activeClinic, switchClinic } = useClinic();

  // Navigation State: default view is '/admin/dashboard'
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/admin/dashboard');

  // Real-time Firestore State (strictly tenant scoped)
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tokens, setTokens] = useState<QueueToken[]>([]);

  // Connection Error Banner State
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Modals State
  const [isPatientRegOpen, setIsPatientRegOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<QueueToken | null>(null);

  // User classification
  const isSuperAdminUser = isSuperAdmin;
  const isClinicStaffUser = !isSuperAdminUser && !!user && !!userProfile && (
    userProfile.role === 'CLINIC_ADMIN' || 
    userProfile.role === 'admin' || 
    userProfile.role === 'DOCTOR' || 
    userProfile.role === 'RECEPTIONIST'
  );
  const isPatientUser = !!user && !!userProfile && (
    userProfile.role === 'PATIENT' || 
    userProfile.role === 'patient'
  );

  // Subscribe to Firestore Realtime Data strictly scoped to activeClinicId
  useEffect(() => {
    // Guard against uninitialized auth state and uninitialized clinicId
    if (authLoading || !authReady || !activeClinicId || typeof activeClinicId !== 'string' || !activeClinicId.trim()) {
      return;
    }

    // Reset previous clinic tenant data to prevent data leakage during transition
    setDoctors([]);
    setPatients([]);
    setTokens([]);
    setConnectionError(null);

    // Public subscriptions for basic clinic configuration (scoped to validated activeClinicId)
    const unsubSettings = subscribeSettings(
      activeClinicId,
      (s) => setSettings(s),
      (err) => setConnectionError(err)
    );
    const unsubDoctors = subscribeDoctors(
      activeClinicId,
      (d) => setDoctors(d),
      (err) => setConnectionError(err)
    );

    let unsubPatients: (() => void) | null = null;
    let unsubTokens: (() => void) | null = null;

    // Only start protected clinic data subscriptions once user session is stabilized and authenticated
    if ((user || isSuperAdmin) && !authLoading && authReady && auth.currentUser) {
      const isStaff = isSuperAdmin || isClinicAdmin || isClinicStaff || userRole === 'DOCTOR' || userRole === 'RECEPTIONIST';
      
      // Patient directory listener is exclusively for authorized staff (PATIENTS ARE NEVER SUBSCRIBED)
      if (isStaff) {
        unsubPatients = subscribePatients(
          activeClinicId,
          (p) => setPatients(p),
          (err) => setConnectionError(err)
        );
      }

      // Today's token queue listener
      unsubTokens = subscribeTodayTokens(
        activeClinicId,
        (t) => setTokens(t),
        (err) => setConnectionError(err)
      );
    }

    return () => {
      unsubSettings();
      unsubDoctors();
      if (unsubPatients) unsubPatients();
      if (unsubTokens) unsubTokens();
    };
  }, [user, authLoading, authReady, userProfile, isSuperAdmin, isClinicAdmin, isClinicStaff, userRole, activeClinicId]);

  // Listen for browser popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  if (authLoading || !authReady) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Authenticating MediQueue...</p>
        </div>
      </div>
    );
  }

  const resolvedClinicSettings: ClinicSettings | null = settings || activeClinic ? {
    clinicName: activeClinic?.name || settings?.clinicName || (activeClinicId ? `Clinic: ${activeClinicId}` : 'MediQueue Clinic'),
    clinicLogo: activeClinic?.logo || settings?.clinicLogo || '',
    clinicAddress: activeClinic?.address || settings?.clinicAddress || '',
    phone: activeClinic?.phone || settings?.phone || '',
    email: activeClinic?.email || settings?.email || '',
    tokenPrefix: activeClinic?.tokenPrefix || settings?.tokenPrefix || 'A',
    startingTokenNumber: activeClinic?.startingTokenNumber || settings?.startingTokenNumber || 1,
    tokenDisplaySettings: activeClinic?.tokenDisplaySettings || settings?.tokenDisplaySettings || {
      enableSound: true,
      autoRefreshInterval: 5,
      announcementVoice: true
    }
  } : null;

  // 1. PUBLIC PATIENT PORTAL ROUTE
  if (currentPath === '/patient') {
    return (
      <>
        {connectionError && (
          <div className="bg-amber-600 text-white text-xs py-2 px-4 flex items-center justify-center gap-2 font-bold sticky top-0 z-50 animate-pulse">
            <WifiOff className="w-4 h-4" />
            <span>{connectionError}</span>
            <RefreshCw className="w-3.5 h-3.5 animate-spin ml-2" />
          </div>
        )}
        <PatientPortal
          settings={resolvedClinicSettings}
          onNavigateToAdminLogin={() => navigate('/admin/login')}
          onNavigateToPublicDisplay={() => navigate('/display')}
        />
      </>
    );
  }

  // 2. PUBLIC TV DISPLAY ROUTE
  if (currentPath === '/display') {
    return (
      <>
        {connectionError && (
          <div className="bg-amber-600 text-white text-xs py-2 px-4 flex items-center justify-center gap-2 font-bold sticky top-0 z-50 animate-pulse">
            <WifiOff className="w-4 h-4" />
            <span>{connectionError}</span>
            <RefreshCw className="w-3.5 h-3.5 animate-spin ml-2" />
          </div>
        )}
        <PublicDisplay
          settings={resolvedClinicSettings}
          onNavigateBack={() => navigate('/patient')}
        />
      </>
    );
  }

  // 3. SUPER ADMIN PIN-ONLY LOGIN ROUTE (/super-admin/login)
  if (currentPath === '/super-admin/login' || (currentPath.startsWith('/super-admin') && !isSuperAdminUser)) {
    return (
      <SuperAdminLogin
        onLoginSuccess={() => navigate('/admin/super-admin')}
        onNavigateToClinicAdmin={() => navigate('/admin/login')}
        onNavigateToPatientPortal={() => navigate('/patient')}
      />
    );
  }

  // 4. CRITICAL SECURITY GUARD: PATIENT ACCOUNTS ATTEMPTING TO ACCESS ADMIN VIEWS
  if (isPatientUser && (currentPath.startsWith('/admin') || currentPath === '/')) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-white selection:bg-rose-500 selection:text-white">
        <div className="w-full max-w-md bg-slate-900/95 border border-red-900/60 rounded-3xl p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-800/80 text-red-400 mx-auto flex items-center justify-center shadow-lg shadow-red-950/50">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-white tracking-tight">Access Denied: Patient Account</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              This account (<span className="text-slate-200 font-medium">{user?.email}</span>) is registered as a <span className="text-red-300 font-semibold">Patient</span> and is strictly prohibited from accessing the Clinic Admin Portal.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/patient')}
              className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Go to Patient Portal</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/admin/login');
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

  // 5. CLINIC ADMIN LOGIN ROUTE (when unauthenticated or explicitly on /admin/login)
  if ((!user && !isSuperAdminUser) || currentPath === '/admin/login') {
    return (
      <AdminLogin
        settings={resolvedClinicSettings}
        onLoginSuccess={() => navigate('/admin/dashboard')}
        onNavigateToPatientPortal={() => navigate('/patient')}
        onNavigateToSuperAdmin={() => navigate('/super-admin/login')}
      />
    );
  }

  // 6. UNAUTHORIZED USER (Logged in with no administrative privileges)
  if (!isSuperAdminUser && !isClinicStaffUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-950/80 border border-amber-800/80 text-amber-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-white">Unauthorized Access</h2>
            <p className="text-xs text-slate-400">
              Your account does not possess administrator permissions for this medical facility.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate('/patient')}
              className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Go to Patient Portal
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/admin/login');
              }}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition-all cursor-pointer"
            >
              Sign In with Admin Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 7. NORMALIZE ROUTE FOR ADMIN LAYOUT
  let adminRoute: AdminRoute = '/admin/dashboard';
  if ((currentPath.startsWith('/admin/super-admin') || currentPath.startsWith('/super-admin')) && isSuperAdmin) {
    adminRoute = '/admin/super-admin';
  } else if (currentPath.startsWith('/admin/patients')) {
    adminRoute = '/admin/patients';
  } else if (currentPath.startsWith('/admin/tokens')) {
    adminRoute = '/admin/tokens';
  } else if (currentPath.startsWith('/admin/doctors')) {
    adminRoute = '/admin/doctors';
  } else if (currentPath.startsWith('/admin/reports')) {
    adminRoute = '/admin/reports';
  } else if (currentPath.startsWith('/admin/settings')) {
    adminRoute = '/admin/settings';
  } else if (currentPath.startsWith('/admin/super-admin') && !isSuperAdmin) {
    // Prevent non-super admins from opening Super Admin route
    adminRoute = '/admin/dashboard';
  }

  return (
    <AdminRouteGuard
      onNavigateToPatientPortal={() => navigate('/patient')}
      onNavigateToLogin={() => navigate('/admin/login')}
    >
      <div className="relative">
        {connectionError && (
          <div className="bg-amber-600 text-white text-xs py-2 px-4 flex items-center justify-center gap-2 font-bold sticky top-0 z-50 animate-pulse">
            <WifiOff className="w-4 h-4" />
            <span>{connectionError}</span>
            <RefreshCw className="w-3.5 h-3.5 animate-spin ml-2" />
          </div>
        )}

        <AdminLayout
          currentRoute={adminRoute}
          onRouteChange={(route) => navigate(route)}
          settings={resolvedClinicSettings}
          onOpenPatientRegistration={() => setIsPatientRegOpen(true)}
          onNavigateToPatientPortal={() => navigate('/patient')}
          onNavigateToPublicDisplay={() => navigate('/display')}
        >
          {/* Super Admin Dashboard Route (Strictly Protected) */}
          {adminRoute === '/admin/super-admin' && isSuperAdmin && (
            <SuperAdminDashboard
              currentTokens={tokens}
              currentDoctors={doctors}
              currentPatients={patients}
              onSwitchClinicAndNavigate={(targetClinicId) => {
                switchClinic(targetClinicId);
                navigate('/admin/dashboard');
              }}
            />
          )}

          {/* Regular Admin Dashboard Route */}
          {adminRoute === '/admin/dashboard' && (
            <AdminDashboard
              tokens={tokens}
              doctors={doctors}
              onOpenPatientRegistration={() => setIsPatientRegOpen(true)}
              onNavigateToQueuePage={() => navigate('/admin/tokens')}
              onNavigateToPatientPortal={() => navigate('/patient')}
            />
          )}

          {adminRoute === '/admin/tokens' && (
            <TokenQueuePage
              tokens={tokens}
              doctors={doctors}
            />
          )}

          {adminRoute === '/admin/patients' && (
            <PatientListPage
              patients={patients}
              tokens={tokens}
            />
          )}

          {adminRoute === '/admin/doctors' && (
            <DoctorManagementPage
              doctors={doctors}
            />
          )}

          {adminRoute === '/admin/reports' && (
            <ReportsPage
              doctors={doctors}
              todayTokens={tokens}
            />
          )}

          {adminRoute === '/admin/settings' && (
            <SettingsPage
              settings={settings}
            />
          )}

          {/* Patient Registration Modal */}
          <PatientRegistrationModal
            isOpen={isPatientRegOpen}
            doctors={doctors}
            onClose={() => setIsPatientRegOpen(false)}
            onTokenGenerated={(token) => setGeneratedToken(token)}
          />

          {/* Printable Receipt Modal */}
          <TokenReceiptModal
            isOpen={!!generatedToken}
            token={generatedToken}
            clinicName={activeClinic?.name || settings?.clinicName}
            clinicLogo={activeClinic?.logo || settings?.clinicLogo}
            onClose={() => setGeneratedToken(null)}
          />

        </AdminLayout>
      </div>
    </AdminRouteGuard>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ClinicProvider>
          <MainAppContent />
        </ClinicProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
