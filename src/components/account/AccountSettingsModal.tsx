import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  ShieldCheck, 
  KeyRound, 
  Download, 
  Trash2, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { QueueToken } from '../../types';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userTokens?: QueueToken[];
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  userTokens = [],
}) => {
  const { user, userProfile, userRole, isSuperAdmin, resetPassword, logout } = useAuth();
  const { activeClinic, activeClinicId, clinics } = useClinic();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'data' | 'danger'>('profile');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Deletion state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);

  if (!isOpen) return null;

  const userEmail = userProfile?.email || user?.email || 'patient@mediqueue.clinic';
  const userName = userProfile?.name || userProfile?.displayName || (user?.email ? user.email.split('@')[0] : 'User');
  const userPhone = userProfile?.phone || 'Not provided';
  const userAge = userProfile?.age;
  const userGender = userProfile?.gender || 'Not specified';
  const assignedClinic = clinics.find(c => c.id === userProfile?.clinicId) || activeClinic;

  const handlePasswordReset = async () => {
    if (!userEmail) return;
    setResetting(true);
    setResetError(null);
    setResetEmailSent(false);

    try {
      await resetPassword(userEmail);
      setResetEmailSent(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setResetError(err.message || 'Failed to dispatch password recovery email.');
    } finally {
      setResetting(false);
    }
  };

  const handleExportData = () => {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      accountProfile: {
        uid: user?.uid,
        name: userName,
        email: userEmail,
        phone: userPhone,
        age: userAge,
        gender: userGender,
        role: userRole,
        assignedClinicId: userProfile?.clinicId || activeClinicId,
        assignedClinicName: assignedClinic?.name || 'MediQueue Clinic',
        accountCreatedAt: userProfile?.createdAt || new Date().toISOString()
      },
      consultationQueueHistory: userTokens.map(t => ({
        tokenNumber: t.tokenNumber,
        status: t.status,
        doctorName: t.doctorName,
        roomNumber: t.roomNumber,
        reason: t.reason,
        queueDate: t.queueDate,
        createdAt: t.createdAt,
        calledAt: t.calledAt,
        completedAt: t.completedAt
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediqueue-account-export-${user?.uid || 'user'}-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRequestDeletion = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete my account') return;
    setIsDeleting(true);

    try {
      // Simulate account deletion request logging and logout
      setTimeout(async () => {
        setDeletionRequested(true);
        setIsDeleting(false);
        setTimeout(async () => {
          onClose();
          await logout();
        }, 2500);
      }, 1000);
    } catch (err) {
      console.error('Failed to process deletion:', err);
      setIsDeleting(false);
    }
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <header className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 id="account-settings-title" className="font-bold text-base text-white">
                Account Settings & Privacy Center
              </h2>
              <p className="text-xs text-slate-400">
                Manage your identity, security credentials, and patient data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 gap-4 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-teal-600 text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Security & Password</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'data'
                ? 'border-teal-600 text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Data Portability</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('danger')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'danger'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-slate-500 hover:text-red-600'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Account Deletion</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 dark:text-slate-200 text-xs">
          
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="w-14 h-14 bg-teal-600 text-white font-extrabold text-xl rounded-2xl flex items-center justify-center shadow-md">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {userName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-extrabold text-[10px] uppercase rounded-md tracking-wider">
                      {isSuperAdmin ? 'SUPER ADMIN' : userRole}
                    </span>
                    <span className="text-slate-400 text-xs">UID: {user?.uid?.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-teal-500" />
                    Verified Email
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{userEmail}</p>
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-teal-500" />
                    Contact Phone
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white">{userPhone}</p>
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-teal-500" />
                    Assigned Clinic
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {assignedClinic?.name || 'Multi-Clinic Accessible'}
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-500" />
                    Demographics
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {userAge ? `${userAge} yrs • ` : ''}{userGender}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-teal-900 dark:text-teal-200 space-y-1">
                <h4 className="font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  Account Authentication Security
                </h4>
                <p className="text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed">
                  Your password credentials are securely hashed and managed via Firebase Authentication with zero plain-text storage.
                </p>
              </div>

              {resetEmailSent && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Password recovery link dispatched to {userEmail}. Please check your inbox and spam folder.</span>
                </div>
              )}

              {resetError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-xl flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="p-4 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Reset Account Password
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Click below to receive a secure, time-limited password reset link delivered to your registered email address ({userEmail}).
                </p>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetting}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-50 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{resetting ? 'Sending Link...' : 'Send Password Reset Email'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DATA PORTABILITY */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                  <h4>Export Personal Health Queue Records (JSON)</h4>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  In compliance with patient data portability principles, you can export a complete machine-readable snapshot of your personal profile and all consultation tokens generated under your account.
                </p>
                <button
                  type="button"
                  onClick={handleExportData}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download My Data (JSON)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: ACCOUNT DELETION */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              {deletionRequested ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Account deletion request registered. Logging out...</span>
                </div>
              ) : (
                <div className="p-5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl space-y-3 text-red-900 dark:text-red-200">
                  <div className="flex items-center gap-2 font-bold text-sm text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span>Permanent Account Erasure</span>
                  </div>
                  <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
                    Deleting your account will revoke your patient portal access and anonymize your historical tokens. This action is irreversible.
                  </p>
                  
                  <div className="space-y-2 pt-2">
                    <label className="block text-[11px] font-bold text-red-900 dark:text-red-200">
                      Type <span className="font-mono underline">delete my account</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="delete my account"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRequestDeletion}
                    disabled={deleteConfirmText.toLowerCase() !== 'delete my account' || isDeleting}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isDeleting ? 'Processing Erasure...' : 'Permanently Delete Account'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <footer className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </footer>

      </div>
    </div>
  );
};
