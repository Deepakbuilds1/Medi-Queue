import React, { useState, useEffect } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
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
import { LegalPagesModal, LegalDocType } from './components/legal/LegalPagesModal';
import { CookieConsentBanner } from './components/legal/CookieConsentBanner';
import { CookiePreferencesModal } from './components/legal/CookiePreferencesModal';
import { HelpCenterModal } from './components/help/HelpCenterModal';
import { AccountSettingsModal } from './components/account/AccountSettingsModal';
import { OfflineIndicator } from './components/states/OfflineIndicator';
import { NotFoundPage } from './components/states/NotFoundPage';
import { ForbiddenPage } from './components/states/ForbiddenPage';
import { MaintenancePage } from './components/states/MaintenancePage';
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

  // Modals & Overlay States
  const [isPatientRegOpen, setIsPatientRegOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<QueueToken | null>(null);
  const [legalModalDoc, setLegalModalDoc] = useState<LegalDocType | null>(null);
  const [isCookiePreferencesOpen, setIsCookiePreferencesOpen] = useState(false);
  const [isHelpCenterOpen, setIsHelpCenterOpen] = useState(false);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);

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
    window.scrollTo(0, 0);
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

  // Dedicated direct URL route handlers
  if (currentPath === '/maintenance') {
    return <MaintenancePage onRetry={() => navigate('/patient')} />;
  }

  if (currentPath === '/forbidden' || currentPath === '/403') {
    return (
      <ForbiddenPage
        requiredRole="Staff Administrator"
        onNavigateHome={() => navigate('/patient')}
        onSwitchClinic={() => navigate('/admin/login')}
      />
    );
  }

  // 1. PUBLIC PATIENT PORTAL ROUTE
  if (currentPath === '/patient' || currentPath === '/') {
    return (
      <>
        <OfflineIndicator />
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
        <CookieConsentBanner
          onOpenPreferences={() => setIsCookiePreferencesOpen(true)}
          onOpenPrivacyPolicy={() => setLegalModalDoc('cookies')}
        />
        <CookiePreferencesModal
          isOpen={isCookiePreferencesOpen}
          onClose={() => setIsCookiePreferencesOpen(false)}
        />
        <LegalPagesModal
          isOpen={!!legalModalDoc}
          initialDoc={legalModalDoc || 'privacy'}
          onOpenCookiePreferences={() => {
            setLegalModalDoc(null);
            setIsCookiePreferencesOpen(true);
          }}
          onClose={() => setLegalModalDoc(null)}
        />
        <HelpCenterModal
          isOpen={isHelpCenterOpen}
          onClose={() => setIsHelpCenterOpen(false)}
        />
      </>
    );
  }

  // 2. PUBLIC TV DISPLAY ROUTE
  if (currentPath === '/display') {
    return (
      <>
        <OfflineIndicator />
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
      <>
        <OfflineIndicator />
        <SuperAdminLogin
          onLoginSuccess={() => navigate('/admin/super-admin')}
          onNavigateToClinicAdmin={() => navigate('/admin/login')}
          onNavigateToPatientPortal={() => navigate('/patient')}
        />
        <CookieConsentBanner
          onOpenPreferences={() => setIsCookiePreferencesOpen(true)}
          onOpenPrivacyPolicy={() => setLegalModalDoc('cookies')}
        />
        <CookiePreferencesModal
          isOpen={isCookiePreferencesOpen}
          onClose={() => setIsCookiePreferencesOpen(false)}
        />
        <LegalPagesModal
          isOpen={!!legalModalDoc}
          initialDoc={legalModalDoc || 'security'}
          onClose={() => setLegalModalDoc(null)}
        />
      </>
    );
  }

  // 4. CRITICAL SECURITY GUARD: PATIENT ACCOUNTS ATTEMPTING TO ACCESS ADMIN VIEWS
  if (isPatientUser && currentPath.startsWith('/admin')) {
    return (
      <>
        <OfflineIndicator />
        <ForbiddenPage
          requiredRole="Clinic Administrator or Super Admin"
          onNavigateHome={() => navigate('/patient')}
          onSwitchClinic={async () => {
            await logout();
            navigate('/admin/login');
          }}
        />
      </>
    );
  }

  // 5. CLINIC ADMIN LOGIN ROUTE (when unauthenticated or explicitly on /admin/login)
  if ((!user && !isSuperAdminUser) || currentPath === '/admin/login') {
    return (
      <>
        <OfflineIndicator />
        <AdminLogin
          settings={resolvedClinicSettings}
          onLoginSuccess={() => navigate('/admin/dashboard')}
          onNavigateToPatientPortal={() => navigate('/patient')}
          onNavigateToSuperAdmin={() => navigate('/super-admin/login')}
          onOpenLegalDoc={(doc) => setLegalModalDoc(doc)}
          onOpenHelpCenter={() => setIsHelpCenterOpen(true)}
        />
        <CookieConsentBanner
          onOpenPreferences={() => setIsCookiePreferencesOpen(true)}
          onOpenPrivacyPolicy={() => setLegalModalDoc('cookies')}
        />
        <CookiePreferencesModal
          isOpen={isCookiePreferencesOpen}
          onClose={() => setIsCookiePreferencesOpen(false)}
        />
        <LegalPagesModal
          isOpen={!!legalModalDoc}
          initialDoc={legalModalDoc || 'privacy'}
          onClose={() => setLegalModalDoc(null)}
        />
        <HelpCenterModal
          isOpen={isHelpCenterOpen}
          onClose={() => setIsHelpCenterOpen(false)}
        />
      </>
    );
  }

  // 6. UNAUTHORIZED USER (Logged in with no administrative privileges)
  if (!isSuperAdminUser && !isClinicStaffUser) {
    return (
      <>
        <OfflineIndicator />
        <ForbiddenPage
          requiredRole="Clinic Staff Administrator"
          onNavigateHome={() => navigate('/patient')}
          onSwitchClinic={async () => {
            await logout();
            navigate('/admin/login');
          }}
        />
      </>
    );
  }

  // 7. NORMALIZE ROUTE FOR ADMIN LAYOUT OR HANDLE 404
  const validAdminPrefixes = [
    '/admin/dashboard',
    '/admin/tokens',
    '/admin/patients',
    '/admin/doctors',
    '/admin/reports',
    '/admin/settings',
    '/admin/super-admin'
  ];

  const isMatchedAdminRoute = validAdminPrefixes.some(prefix => currentPath.startsWith(prefix));

  if (!isMatchedAdminRoute && !currentPath.startsWith('/admin')) {
    return (
      <NotFoundPage
        onNavigateHome={() => navigate(isSuperAdmin ? '/admin/super-admin' : '/admin/dashboard')}
        onNavigateAdmin={() => navigate('/admin/dashboard')}
        onNavigateDisplay={() => navigate('/display')}
      />
    );
  }

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
        <OfflineIndicator />

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
          onOpenLegalDoc={(doc) => setLegalModalDoc(doc)}
          onOpenHelpCenter={() => setIsHelpCenterOpen(true)}
          onOpenCookiePreferences={() => setIsCookiePreferencesOpen(true)}
          onOpenAccountSettings={() => setIsAccountSettingsOpen(true)}
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

          {/* Global Modals for Admin */}
          <LegalPagesModal
            isOpen={!!legalModalDoc}
            initialDoc={legalModalDoc || 'privacy'}
            onClose={() => setLegalModalDoc(null)}
          />

          <HelpCenterModal
            isOpen={isHelpCenterOpen}
            onClose={() => setIsHelpCenterOpen(false)}
          />

          <CookiePreferencesModal
            isOpen={isCookiePreferencesOpen}
            onClose={() => setIsCookiePreferencesOpen(false)}
          />

          <AccountSettingsModal
            isOpen={isAccountSettingsOpen}
            onClose={() => setIsAccountSettingsOpen(false)}
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
      <SpeedInsights />
    </ErrorBoundary>
  );
}

export default App;
