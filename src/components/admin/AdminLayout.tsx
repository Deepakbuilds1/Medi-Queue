import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Ticket, 
  Stethoscope, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut, 
  PlusCircle, 
  Monitor, 
  Building2,
  Clock,
  Calendar,
  Menu,
  X,
  ShieldCheck,
  ChevronDown,
  HelpCircle,
  FileText,
  Activity,
  Check,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { AdminRoute, ClinicSettings } from '../../types';
import { LegalDocType } from '../legal/LegalPagesModal';

interface AdminLayoutProps {
  currentRoute: AdminRoute;
  onRouteChange: (route: AdminRoute) => void;
  settings: ClinicSettings | null;
  onOpenPatientRegistration: () => void;
  onNavigateToPatientPortal: () => void;
  onNavigateToPublicDisplay: () => void;
  onOpenLegalDoc?: (doc: LegalDocType) => void;
  onOpenHelpCenter?: () => void;
  onOpenCookiePreferences?: () => void;
  onOpenAccountSettings?: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentRoute,
  onRouteChange,
  settings,
  onOpenPatientRegistration,
  onNavigateToPatientPortal,
  onNavigateToPublicDisplay,
  onOpenLegalDoc,
  onOpenHelpCenter,
  onOpenAccountSettings,
  children
}) => {
  const { logout, user, userProfile, isSuperAdmin, userRole } = useAuth();
  const { clinics, activeClinicId, switchClinic } = useClinic();
  const [dateTime, setDateTime] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clinicDropdownOpen, setClinicDropdownOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    ...(isSuperAdmin ? [{ label: 'Super Admin', route: '/admin/super-admin' as AdminRoute, icon: ShieldCheck, isSuper: true }] : []),
    { label: 'Dashboard', route: '/admin/dashboard' as AdminRoute, icon: LayoutDashboard },
    { label: 'Live Queue', route: '/admin/tokens' as AdminRoute, icon: Ticket },
    { label: 'Patients', route: '/admin/patients' as AdminRoute, icon: Users },
    { label: 'Doctors', route: '/admin/doctors' as AdminRoute, icon: Stethoscope },
    { label: 'Reports', route: '/admin/reports' as AdminRoute, icon: BarChart3 },
    { label: 'Settings', route: '/admin/settings' as AdminRoute, icon: SettingsIcon },
  ];

  const currentClinic = clinics.find(c => c.id === activeClinicId);
  const clinicName = currentClinic?.name || settings?.clinicName || (activeClinicId ? `Clinic: ${activeClinicId}` : 'MediQueue Clinic');
  const clinicLogo = currentClinic?.logo || settings?.clinicLogo;

  const formattedDate = dateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = dateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Get current page display title
  const getPageTitle = () => {
    switch (currentRoute) {
      case '/admin/dashboard': return 'Dashboard Overview';
      case '/admin/tokens': return 'Live Queue Management';
      case '/admin/patients': return 'Patient Directory';
      case '/admin/doctors': return 'Medical Staff';
      case '/admin/reports': return 'Operational Analytics';
      case '/admin/settings': return 'Clinic Settings';
      case '/admin/super-admin': return 'Super Admin Control Center';
      default: return 'Clinic Management';
    }
  };

  return (
    <div className="w-full h-screen bg-[#F8FAFC] flex text-[#0F172A] overflow-hidden">
      
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar Component */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-white text-slate-700 h-full flex flex-col transition-transform duration-200 ease-in-out shrink-0 border-r border-[#E2E8F0] shadow-xs
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        {/* Brand & Clinic Switcher */}
        <div className="p-4 border-b border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {clinicLogo ? (
                <img src={clinicLogo} alt="Clinic Logo" className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 bg-teal-700 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs">
                  <Activity className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[#0F172A] font-bold text-base tracking-tight leading-none">MediQueue</span>
                <span className="text-[11px] text-teal-700 font-medium tracking-normal mt-0.5">Healthcare Operations</span>
              </div>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)} 
              className="md:hidden text-slate-400 hover:text-slate-700 p-1 rounded-md"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Clinic Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => (isSuperAdmin || clinics.length > 1) && setClinicDropdownOpen(!clinicDropdownOpen)}
              className={`w-full px-2.5 py-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-left flex items-center justify-between transition-colors ${
                (isSuperAdmin || clinics.length > 1) ? 'cursor-pointer hover:bg-slate-100/80 hover:border-slate-300' : 'cursor-default'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block leading-tight">
                    {isSuperAdmin ? 'Managed Facility' : 'Active Clinic'}
                  </span>
                  <span className="text-xs font-semibold text-[#0F172A] truncate block">
                    {clinicName}
                  </span>
                </div>
              </div>
              {(isSuperAdmin || clinics.length > 1) && <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </button>

            {/* Dropdown menu */}
            {(isSuperAdmin || clinics.length > 1) && clinicDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-50 overflow-hidden py-1 max-h-56 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 flex items-center justify-between">
                  <span>{isSuperAdmin ? 'Switch Facility' : 'Assigned Clinics'}</span>
                  <span className="text-[10px] text-teal-700 font-medium">Active</span>
                </div>
                {clinics.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      switchClinic(c.id);
                      setClinicDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      c.id === activeClinicId ? 'bg-teal-50/70 text-teal-900 font-semibold border-l-2 border-teal-700' : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    {c.id === activeClinicId && <Check className="w-3.5 h-3.5 text-teal-700 shrink-0" />}
                  </button>
                ))}
                {isSuperAdmin && (
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => {
                        onRouteChange('/admin/super-admin');
                        setClinicDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-[11px] font-semibold text-teal-700 hover:bg-teal-50 flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Manage All Clinics</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenPatientRegistration();
            }}
            className="w-full py-2 px-3 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register Patient</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="mt-2 px-3 flex-1 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.route;
            const isSuper = (item as any).isSuper;
            return (
              <button
                key={item.route}
                onClick={() => {
                  onRouteChange(item.route);
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-medium transition-colors cursor-pointer text-left
                  ${isActive 
                    ? isSuper 
                      ? 'bg-slate-900 text-white font-semibold' 
                      : 'bg-teal-50 text-teal-900 font-semibold border-l-2 border-teal-700' 
                    : isSuper 
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' 
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-[#0F172A]'}
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? (isSuper ? 'text-white' : 'text-teal-700') : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
                {isSuper && (
                  <span className="ml-auto px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold">
                    ROOT
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-200 space-y-0.5">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Displays & Portals
            </span>
            <button
              onClick={onNavigateToPatientPortal}
              className="w-full px-3 py-1.5 rounded-lg flex items-center gap-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-left"
            >
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Patient Portal</span>
            </button>
            
            <button
              onClick={onNavigateToPublicDisplay}
              className="w-full px-3 py-1.5 rounded-lg flex items-center gap-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-left"
            >
              <Monitor className="w-4 h-4 text-slate-400 shrink-0" />
              <span>TV Public Display</span>
            </button>

            {onOpenHelpCenter && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenHelpCenter();
                }}
                className="w-full px-3 py-1.5 rounded-lg flex items-center gap-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-left"
              >
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Help & Guides</span>
              </button>
            )}

            {onOpenLegalDoc && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLegalDoc('security');
                }}
                className="w-full px-3 py-1.5 rounded-lg flex items-center gap-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-left"
              >
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Compliance & Terms</span>
              </button>
            )}
          </div>
        </nav>

        {/* Sidebar User Profile & Logout */}
        <div className="p-3 border-t border-[#E2E8F0] bg-slate-50/70">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAccountSettings && onOpenAccountSettings();
              }}
              className="flex items-center gap-2.5 overflow-hidden text-left hover:opacity-85 transition-opacity cursor-pointer flex-1 mr-2"
              title="Account Settings"
            >
              <div className={`w-7 h-7 rounded-full text-white font-semibold flex items-center justify-center text-xs shrink-0 ${
                isSuperAdmin ? 'bg-slate-900' : 'bg-teal-700'
              }`}>
                {isSuperAdmin ? 'SA' : (userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'A')}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-medium text-[#0F172A] truncate">
                  {userProfile?.name || (user?.email ? user.email.split('@')[0] : 'Admin')}
                </span>
                <span className="text-[10px] text-slate-500 font-medium truncate">
                  {isSuperAdmin ? 'Super Admin' : (userRole === 'CLINIC_ADMIN' ? 'Clinic Admin' : 'Staff')}
                </span>
              </div>
            </button>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
        
        {/* Compact Header */}
        <header className="h-14 bg-white border-b border-[#E2E8F0] px-4 md:px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-[#0F172A] truncate">
                {getPageTitle()}
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-xs text-slate-500 font-medium truncate hidden sm:inline">
                {clinicName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            {/* Live Clock & Date */}
            <div className="hidden lg:flex items-center gap-3 text-slate-500 text-xs font-medium border-r border-slate-200 pr-4">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                <Clock className="w-3 h-3 text-teal-700" />
                <span>{formattedTime}</span>
              </div>
            </div>

            {/* Register Patient Button in Header */}
            <button
              onClick={onOpenPatientRegistration}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-medium shadow-xs cursor-pointer transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Patient</span>
            </button>

            {/* Logout button */}
            <button
              onClick={() => logout()}
              className="text-xs font-medium text-slate-600 hover:text-red-600 px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F8FAFC] pb-16 md:pb-6">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (Screens < md) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-[#E2E8F0] flex items-center justify-around px-2 z-30 shadow-xs">
          <button
            onClick={() => onRouteChange('/admin/dashboard')}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-md ${
              currentRoute === '/admin/dashboard' ? 'text-teal-700 font-semibold' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight">Dashboard</span>
          </button>

          <button
            onClick={() => onRouteChange('/admin/tokens')}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-md ${
              currentRoute === '/admin/tokens' ? 'text-teal-700 font-semibold' : 'text-slate-500'
            }`}
          >
            <Ticket className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight">Queue</span>
          </button>

          <button
            onClick={onOpenPatientRegistration}
            className="flex flex-col items-center justify-center w-12 h-12 -mt-3 bg-teal-700 text-white rounded-full shadow-md active:bg-teal-800"
            title="Register Patient"
          >
            <PlusCircle className="w-6 h-6" />
          </button>

          <button
            onClick={() => onRouteChange('/admin/patients')}
            className={`flex flex-col items-center justify-center w-14 h-12 rounded-md ${
              currentRoute === '/admin/patients' ? 'text-teal-700 font-semibold' : 'text-slate-500'
            }`}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight">Patients</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center w-14 h-12 rounded-md text-slate-500"
          >
            <Menu className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] leading-tight">More</span>
          </button>
        </nav>

      </div>

    </div>
  );
};
