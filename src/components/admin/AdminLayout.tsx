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
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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
  const { logout, user } = useAuth();
  const [dateTime, setDateTime] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { label: 'Dashboard', route: '/admin/dashboard' as AdminRoute, icon: LayoutDashboard },
    { label: 'Patients', route: '/admin/patients' as AdminRoute, icon: Users },
    { label: 'Token Queue', route: '/admin/tokens' as AdminRoute, icon: Ticket },
    { label: 'Doctors', route: '/admin/doctors' as AdminRoute, icon: Stethoscope },
    { label: 'Reports', route: '/admin/reports' as AdminRoute, icon: BarChart3 },
    { label: 'Settings', route: '/admin/settings' as AdminRoute, icon: SettingsIcon },
  ];

  const clinicName = settings?.clinicName || 'CITY CARE CLINIC';

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

      {/* Sidebar Component - High Density Slate Aesthetic */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-60 bg-slate-900 text-slate-300 h-full flex flex-col transition-transform duration-200 ease-in-out shrink-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        {/* Clinic Logo & Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings?.clinicLogo ? (
              <img src={settings.clinicLogo} alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-slate-700" />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-base shadow-sm">
                M
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-white font-bold text-base tracking-tight leading-none">MediQueue</span>
              <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mt-0.5">Clinic OS</span>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)} 
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Action Button */}
        <div className="p-4 pb-2">
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenPatientRegistration();
            }}
            className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Register Patient
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="mt-2 px-3 flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.route;
            return (
              <button
                key={item.route}
                onClick={() => {
                  onRouteChange(item.route);
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-semibold transition-colors cursor-pointer text-left
                  ${isActive 
                    ? 'bg-slate-800 text-white shadow-xs border-l-2 border-blue-400' 
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-1">
            <button
              onClick={onNavigateToPatientPortal}
              className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-blue-300 transition-colors cursor-pointer text-left"
            >
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Patient Portal</span>
            </button>
            
            <button
              onClick={onNavigateToPublicDisplay}
              className="w-full p-2.5 rounded-lg flex items-center gap-3 text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-emerald-300 transition-colors cursor-pointer text-left"
            >
              <Monitor className="w-4 h-4 text-emerald-400" />
              <span>TV Public Display</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer Admin Profile & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs shrink-0">
                A
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs text-white font-medium truncate">
                  {user?.email ? user.email.split('@')[0] : 'Admin User'}
                </span>
                <span className="text-[10px] text-slate-400 truncate">{clinicName}</span>
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
            <h1 className="font-bold text-slate-800 dark:text-white text-sm md:text-base tracking-tight">
              {clinicName}
            </h1>
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
