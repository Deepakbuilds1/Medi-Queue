import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClinicProvider, useClinic } from './context/ClinicContext';
import { AdminLayout } from './components/admin/AdminLayout';
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
import { WifiOff, RefreshCw } from 'lucide-react';
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
  const { user, userProfile, loading: authLoading, authReady, isSuperAdmin, isClinicAdmin, userRole } = useAuth();
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
      const isStaff = isSuperAdmin || isClinicAdmin || userRole === 'DOCTOR' || userRole === 'RECEPTIONIST';
      
      // Patient directory listener is exclusively for authorized staff
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
  }, [user, authLoading, authReady, userProfile, isSuperAdmin, isClinicAdmin, userRole, activeClinicId]);

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

  if (authLoading) {
    return (
      <div className="w-screen h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading MediQueue OS...</p>
        </div>
      </div>
    );
  }

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
          settings={settings || activeClinic ? {
            clinicName: activeClinic?.name || 'CITY CARE CLINIC',
            clinicLogo: activeClinic?.logo || '',
            clinicAddress: activeClinic?.address || '',
            phone: activeClinic?.phone || '',
            email: activeClinic?.email || '',
            tokenPrefix: activeClinic?.tokenPrefix || 'A',
            startingTokenNumber: activeClinic?.startingTokenNumber || 1,
            tokenDisplaySettings: activeClinic?.tokenDisplaySettings || {
              enableSound: true,
              autoRefreshInterval: 5,
              announcementVoice: true
            }
          } : null}
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
          settings={settings || activeClinic ? {
            clinicName: activeClinic?.name || 'CITY CARE CLINIC',
            clinicLogo: activeClinic?.logo || '',
            clinicAddress: activeClinic?.address || '',
            phone: activeClinic?.phone || '',
            email: activeClinic?.email || '',
            tokenPrefix: activeClinic?.tokenPrefix || 'A',
            startingTokenNumber: activeClinic?.startingTokenNumber || 1,
            tokenDisplaySettings: activeClinic?.tokenDisplaySettings || {
              enableSound: true,
              autoRefreshInterval: 5,
              announcementVoice: true
            }
          } : null}
          onNavigateBack={() => navigate('/patient')}
        />
      </>
    );
  }

  // 3. SUPER ADMIN PIN-ONLY LOGIN ROUTE (/super-admin/login)
  if (currentPath === '/super-admin/login' || (currentPath.startsWith('/super-admin') && !isSuperAdmin)) {
    return (
      <SuperAdminLogin
        onLoginSuccess={() => navigate('/admin/super-admin')}
        onNavigateToClinicAdmin={() => navigate('/admin/login')}
        onNavigateToPatientPortal={() => navigate('/patient')}
      />
    );
  }

  // 4. CLINIC ADMIN LOGIN ROUTE (or unauthenticated fallback for /admin/*)
  if ((!user && !isSuperAdmin) || currentPath === '/admin/login') {
    return (
      <AdminLogin
        settings={settings || activeClinic ? {
          clinicName: activeClinic?.name || 'CITY CARE CLINIC',
          clinicLogo: activeClinic?.logo || '',
          clinicAddress: activeClinic?.address || '',
          phone: activeClinic?.phone || '',
          email: activeClinic?.email || '',
          tokenPrefix: activeClinic?.tokenPrefix || 'A',
          startingTokenNumber: activeClinic?.startingTokenNumber || 1,
          tokenDisplaySettings: activeClinic?.tokenDisplaySettings || {
            enableSound: true,
            autoRefreshInterval: 5,
            announcementVoice: true
          }
        } : null}
        onLoginSuccess={() => navigate('/admin/dashboard')}
        onNavigateToPatientPortal={() => navigate('/patient')}
        onNavigateToSuperAdmin={() => navigate('/super-admin/login')}
      />
    );
  }

  // 5. NORMALIZE ROUTE FOR ADMIN LAYOUT
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
        settings={settings || activeClinic ? {
          clinicName: activeClinic?.name || 'CITY CARE CLINIC',
          clinicLogo: activeClinic?.logo || '',
          clinicAddress: activeClinic?.address || '',
          phone: activeClinic?.phone || '',
          email: activeClinic?.email || '',
          tokenPrefix: activeClinic?.tokenPrefix || 'A',
          startingTokenNumber: activeClinic?.startingTokenNumber || 1,
          tokenDisplaySettings: activeClinic?.tokenDisplaySettings || {
            enableSound: true,
            autoRefreshInterval: 5,
            announcementVoice: true
          }
        } : null}
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
