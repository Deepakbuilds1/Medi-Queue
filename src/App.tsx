import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TokenQueuePage } from './components/admin/TokenQueuePage';
import { PatientListPage } from './components/admin/PatientListPage';
import { DoctorManagementPage } from './components/admin/DoctorManagementPage';
import { ReportsPage } from './components/admin/ReportsPage';
import { SettingsPage } from './components/admin/SettingsPage';
import { PatientRegistrationModal } from './components/admin/PatientRegistrationModal';
import { TokenReceiptModal } from './components/common/TokenReceiptModal';
import { PatientPortal } from './components/patient/PatientPortal';
import { PublicDisplay } from './components/display/PublicDisplay';
import { WifiOff, RefreshCw } from 'lucide-react';
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
  const { user, loading: authLoading } = useAuth();

  // Navigation State: default view is '/admin/dashboard'
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/admin/dashboard');

  // Real-time Firestore State
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tokens, setTokens] = useState<QueueToken[]>([]);

  // Connection Error Banner State
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Modals State
  const [isPatientRegOpen, setIsPatientRegOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<QueueToken | null>(null);

  // Subscribe to Firestore Realtime Data safely
  useEffect(() => {
    // Public subscriptions for basic clinic configuration
    const unsubSettings = subscribeSettings(
      (s) => setSettings(s),
      (err) => setConnectionError(err)
    );
    const unsubDoctors = subscribeDoctors(
      (d) => setDoctors(d),
      (err) => setConnectionError(err)
    );

    let unsubPatients: (() => void) | null = null;
    let unsubTokens: (() => void) | null = null;

    // Do NOT start admin Firestore listeners before Firebase Auth has confirmed the user
    if (user && !authLoading) {
      unsubPatients = subscribePatients(
        (p) => setPatients(p),
        (err) => setConnectionError(err)
      );
      unsubTokens = subscribeTodayTokens(
        (t) => setTokens(t),
        (err) => setConnectionError(err)
      );
    } else {
      setPatients([]);
      setTokens([]);
    }

    return () => {
      unsubSettings();
      unsubDoctors();
      if (unsubPatients) unsubPatients();
      if (unsubTokens) unsubTokens();
    };
  }, [user, authLoading]);

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
          settings={settings}
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
          settings={settings}
          onNavigateBack={() => navigate('/patient')}
        />
      </>
    );
  }

  // 3. ADMIN LOGIN ROUTE (or unauthenticated fallback for /admin/*)
  if (!user || currentPath === '/admin/login') {
    return (
      <AdminLogin
        settings={settings}
        onLoginSuccess={() => navigate('/admin/dashboard')}
        onNavigateToPatientPortal={() => navigate('/patient')}
      />
    );
  }

  // Normalize route for admin layout
  let adminRoute: AdminRoute = '/admin/dashboard';
  if (currentPath.startsWith('/admin/patients')) adminRoute = '/admin/patients';
  else if (currentPath.startsWith('/admin/tokens')) adminRoute = '/admin/tokens';
  else if (currentPath.startsWith('/admin/doctors')) adminRoute = '/admin/doctors';
  else if (currentPath.startsWith('/admin/reports')) adminRoute = '/admin/reports';
  else if (currentPath.startsWith('/admin/settings')) adminRoute = '/admin/settings';

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
        settings={settings}
        onOpenPatientRegistration={() => setIsPatientRegOpen(true)}
        onNavigateToPatientPortal={() => navigate('/patient')}
        onNavigateToPublicDisplay={() => navigate('/display')}
      >
        {/* Admin Route View Switcher */}
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
          clinicName={settings?.clinicName}
          clinicLogo={settings?.clinicLogo}
          onClose={() => setGeneratedToken(null)}
        />

      </AdminLayout>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}

export default App;
