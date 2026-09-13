import React from 'react';
import { ShieldAlert, LogOut, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { Button } from '../shared/Button';

interface ForbiddenPageProps {
  requiredRole?: string;
  onNavigateHome: () => void;
  onSwitchClinic?: () => void;
}

export const ForbiddenPage: React.FC<ForbiddenPageProps> = ({
  requiredRole = 'CLINIC_ADMIN or SUPER_ADMIN',
  onNavigateHome,
  onSwitchClinic,
}) => {
  const { user, userRole, isSuperAdmin, logout } = useAuth();
  const { activeClinic } = useClinic();

  return (
    <div 
      role="main"
      className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 text-slate-800 dark:text-slate-200 font-sans"
    >
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/40 p-8 text-center space-y-6">
        
        {/* Visual 403 Badge */}
        <div className="relative mx-auto w-20 h-20 bg-red-50 dark:bg-red-950/60 rounded-3xl flex items-center justify-center border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 shadow-sm">
          <ShieldAlert className="w-10 h-10" />
          <span className="absolute -bottom-2 px-2 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-black tracking-widest uppercase">
            403
          </span>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Access Restricted
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your authenticated role (<strong className="text-slate-800 dark:text-slate-200 font-bold uppercase">{userRole || 'PATIENT'}</strong>) does not have authorization to access this clinic management resource.
          </p>
        </div>

        {/* Security Diagnostics */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Current User:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
              {user?.email || 'Anonymous'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Active Clinic:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {activeClinic?.name || 'Default Clinic'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Required Role:</span>
            <span className="font-mono text-red-600 dark:text-red-400 font-bold">
              {requiredRole}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Button
            type="button"
            variant="Primary"
            size="md"
            fullWidth
            onClick={onNavigateHome}
            leftIcon={<Home className="w-4 h-4" />}
          >
            Return to Patient Portal
          </Button>

          {user && (
            <Button
              type="button"
              variant="Destructive"
              size="md"
              fullWidth
              onClick={() => logout()}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Switch Account / Sign Out
            </Button>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          MediQueue Multi-Tenant Security & RBAC Enforcement
        </div>

      </div>
    </div>
  );
};
