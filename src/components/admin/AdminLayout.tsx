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
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { AdminRoute, ClinicSettings } from '../../types';

interface AdminLayoutProps {
  currentRoute: AdminRoute;
  onRouteChange: (route: AdminRoute) => void;
  settings: ClinicSettings | null;
  onOpenPatientRegistration: () => void;
  onNavigateToPatientPortal: () => void;
  onNavigateToPublicDisplay: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentRoute,
  onRouteChange,
  settings,
  onOpenPatientRegistration,
  onNavigateToPatientPortal,
  onNavigateToPublicDisplay,
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
    { label: 'Patients', route: '/admin/patients' as AdminRoute, icon: Users },
    { label: 'Token Queue', route: '/admin/tokens' as AdminRoute, icon: Ticket },
    { label: 'Doctors', route: '/admin/doctors' as AdminRoute, icon: Stethoscope },
    { label: 'Reports', route: '/admin/reports' as AdminRoute, icon: BarChart3 },
    { label: 'Settings', route: '/admin/settings' as AdminRoute, icon: SettingsIcon },
  ];

  const currentClinic = clinics.find(c => c.id === activeClinicId);
  const clinicName = currentClinic?.name || settings?.clinicName || 'CITY CARE CLINIC';
  const clinicLogo = currentClinic?.logo || settings?.clinicLogo;

  const formattedDate = dateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const formattedTime = dateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="w-full h-screen bg-slate-100 dark:bg-slate-900 flex font-sans overflow-hidden select-none">
      
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar Component */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 h-full flex flex-col transition-transform duration-200 ease-in-out shrink-0 border-r border-slate-800
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        {/* Clinic Brand & Multi-Tenant Switcher */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {clinicLogo ? (
                <img src={clinicLogo} alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-slate-700" />
              ) : (
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-base shadow-sm">
                  M
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-white font-bold text-base tracking-tight leading-none">MediQueue</span>
                <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mt-0.5">Multi-Clinic OS</span>
              </div>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)} 
              className="md:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Clinic Switcher Button */}
          <div className="relative">
            <button
              onClick={() => (isSuperAdmin || clinics.length > 1) && setClinicDropdownOpen(!clinicDropdownOpen)}
              className={`w-full p-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/80 rounded-xl text-left flex items-center justify-between transition-colors ${
                (isSuperAdmin || clinics.length > 1) ? 'cursor-pointer hover:border-indigo-500' : 'cursor-default'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                    {isSuperAdmin ? 'Super Admin Clinic' : 'Active Clinic'}
                  </span>
                  <span className="text-xs font-bold text-white truncate block">
                    {clinicName}
                  </span>
                </div>
              </div>
              {(isSuperAdmin || clinics.length > 1) && <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </button>

            {/* Dropdown for Super Admin & Multi-Clinic Admin to switch clinic */}
            {(isSuperAdmin || clinics.length > 1) && clinicDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in">
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 border-b border-slate-700 flex items-center justify-between">
                  <span>{isSuperAdmin ? 'Switch Any Clinic' : 'Switch Assigned Clinic'}</span>
                  <Sparkles className="w-3 h-3" />
                </div>
                {clinics.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      switchClinic(c.id);
                      setClinicDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-700/80 transition-colors ${
                      c.id === activeClinicId ? 'bg-indigo-600/30 text-white font-bold border-l-2 border-indigo-400' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">/{c.tokenPrefix}</span>
                  </button>
                ))}
                {isSuperAdmin && (
                  <div className="border-t border-slate-700 mt-1 pt-1">
                    <button
                      onClick={() => {
                        onRouteChange('/admin/super-admin');
                        setClinicDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
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
        <div className="p-3 pb-1">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenPatientRegistration();
            }}
            className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Register Patient
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="mt-1 px-3 flex-1 space-y-1 overflow-y-auto">
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
                  w-full p-2.5 rounded-xl flex items-center gap-3 text-xs font-semibold transition-colors cursor-pointer text-left
                  ${isActive 
                    ? isSuper 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-800 text-white shadow-xs border-l-2 border-blue-400' 
                    : isSuper 
                      ? 'text-indigo-300 hover:bg-indigo-950/50 hover:text-white' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? (isSuper ? 'text-white' : 'text-blue-400') : (isSuper ? 'text-indigo-400' : 'text-slate-400')}`} />
                <span>{item.label}</span>
                {isSuper && (
                  <span className="ml-auto px-1.5 py-0.5 bg-indigo-500/30 text-indigo-300 rounded text-[9px] font-bold">
                    ROOT
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-800 space-y-1">
            <button
              onClick={onNavigateToPatientPortal}
              className="w-full p-2.5 rounded-xl flex items-center gap-3 text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-blue-300 transition-colors cursor-pointer text-left"
            >
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Patient Portal</span>
            </button>
            
            <button
              onClick={onNavigateToPublicDisplay}
              className="w-full p-2.5 rounded-xl flex items-center gap-3 text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-emerald-300 transition-colors cursor-pointer text-left"
            >
              <Monitor className="w-4 h-4 text-emerald-400" />
              <span>TV Public Display</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer Admin Profile & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-xs shrink-0 ${
                isSuperAdmin ? 'bg-indigo-600' : 'bg-slate-700'
              }`}>
                {isSuperAdmin ? 'S' : 'A'}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs text-white font-medium truncate flex items-center gap-1">
                  {userProfile?.name || (user?.email ? user.email.split('@')[0] : 'Admin User')}
                </span>
                <span className="text-[10px] text-indigo-400 font-semibold truncate uppercase">
                  {isSuperAdmin ? 'Super Administrator' : (userRole || 'Clinic Admin')}
                </span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        
        {/* Top Header */}
        <header className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              {(isSuperAdmin || clinics.length > 1) ? (
                <div className="relative">
                  <button
                    onClick={() => setClinicDropdownOpen(!clinicDropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/90 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-extrabold uppercase hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer shadow-xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{isSuperAdmin ? 'SUPER ADMIN' : 'CURRENT CLINIC'}: {clinicName}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                  </button>

                  {clinicDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1 w-64 max-h-60 overflow-y-auto animate-in fade-in">
                      <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <span>{isSuperAdmin ? 'Switch Any Clinic' : 'Switch Assigned Clinic'}</span>
                        <Sparkles className="w-3 h-3" />
                      </div>
                      {clinics.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            switchClinic(c.id);
                            setClinicDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                            c.id === activeClinicId ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold border-l-2 border-indigo-500' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {c.id === activeClinicId && <span className="text-emerald-500 font-bold">✓</span>}
                            <span className="truncate">{c.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">/{c.tokenPrefix}</span>
                        </button>
                      ))}
                      {isSuperAdmin && (
                        <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                          <button
                            onClick={() => {
                              onRouteChange('/admin/super-admin');
                              setClinicDropdownOpen(false);
                            }}
                            className="w-full px-3 py-1.5 text-left text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Clinic Management Console</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-md">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-extrabold uppercase">{clinicName}</span>
                </div>
              )}
              <span className="text-xs text-slate-400 hidden sm:inline font-mono">
                / {currentClinic?.tokenPrefix || activeClinicId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="hidden md:flex items-center gap-4 text-slate-600 dark:text-slate-300 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-md font-mono text-slate-800 dark:text-slate-200">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>{formattedTime}</span>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="text-xs font-bold text-red-600 dark:text-red-400 px-3 py-1.5 border border-red-200 dark:border-red-900/60 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100 dark:bg-slate-900">
          {children}
        </div>

      </main>

    </div>
  );
};
