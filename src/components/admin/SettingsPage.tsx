import React, { useState } from 'react';
import { Settings as SettingsIcon, Building2, Phone, Mail, MapPin, Hash, Image, Save, CheckCircle2, Key, Info, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { ClinicSettings } from '../../types';
import { updateSettings } from '../../services/clinicService';
import { EnvKeysModal } from '../common/EnvKeysModal';

interface SettingsPageProps {
  settings: ClinicSettings | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings }) => {
  const [clinicName, setClinicName] = useState(settings?.clinicName || 'CITY CARE CLINIC');
  const [clinicLogo, setClinicLogo] = useState(settings?.clinicLogo || 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=150&auto=format&fit=crop&q=80');
  const [clinicAddress, setClinicAddress] = useState(settings?.clinicAddress || '123 Healthcare Boulevard, Medical District');
  const [phone, setPhone] = useState(settings?.phone || '+1 (800) 555-0199');
  const [email, setEmail] = useState(settings?.email || 'gdeepak4689@gmail.com');
  const [tokenPrefix, setTokenPrefix] = useState(settings?.tokenPrefix || 'A');
  const [startingTokenNumber, setStartingTokenNumber] = useState(settings?.startingTokenNumber || 1);
  const [enableSound, setEnableSound] = useState(settings?.tokenDisplaySettings?.enableSound ?? true);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);

  // Read Environment Variable status safely
  const hasGeminiKey = typeof process !== 'undefined' && process.env && !!process.env.GEMINI_API_KEY;
  const appUrl = (typeof process !== 'undefined' && process.env && process.env.APP_URL) || window.location.origin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateSettings({
        clinicName,
        clinicLogo,
        clinicAddress,
        phone,
        email,
        tokenPrefix: tokenPrefix.toUpperCase(),
        startingTokenNumber: Number(startingTokenNumber),
        tokenDisplaySettings: {
          enableSound,
          autoRefreshInterval: 5,
          announcementVoice: true
        }
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Clinic Configuration Settings</h2>
            <p className="text-xs text-slate-500">Update Profile Details, Logo & Token Generation Rules</p>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Settings saved successfully! Changes reflect instantly.
        </div>
      )}

      {/* Environment Variables Reference Panel */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Environment Variables & Secrets Status
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEnvModalOpen(true)}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Manual Enter Env Keys
            </button>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-semibold">.env.example</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">GEMINI_API_KEY</span>
              <span className="font-mono text-slate-300">Server API Secret</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${hasGeminiKey ? 'bg-emerald-900/80 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
              <ShieldCheck className="w-3 h-3" />
              {hasGeminiKey ? 'CONFIGURED' : 'MANAGED BY PLATFORM'}
            </span>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">APP_URL</span>
              <span className="font-mono text-slate-300 truncate max-w-[160px] inline-block">{appUrl}</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-950 text-blue-300">
              AUTO-INJECTED
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
          <div className="flex items-start gap-2 text-slate-400">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p>
              Environment variables and API keys can be managed via AI Studio Settings or manually configured using the <strong className="text-slate-200">Manual Enter Env Keys</strong> dialog.
            </p>
          </div>
        </div>
      </div>

      {/* Manual Env Keys Modal */}
      <EnvKeysModal
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
      />

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs p-6 space-y-5">
        
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
          General Clinic Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Clinic Name *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Clinic Logo URL
            </label>
            <div className="relative">
              <Image className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="url"
                value={clinicLogo}
                onChange={(e) => setClinicLogo(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Clinic Address
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={clinicAddress}
              onChange={(e) => setClinicAddress(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
            />
          </div>
        </div>

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2 pt-3">
          Token & Display Rules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Default Token Prefix
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                maxLength={2}
                value={tokenPrefix}
                onChange={(e) => setTokenPrefix(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Daily Starting Token Number
            </label>
            <input
              type="number"
              min={1}
              value={startingTokenNumber}
              onChange={(e) => setStartingTokenNumber(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="enableSound"
            checked={enableSound}
            onChange={(e) => setEnableSound(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
          />
          <label htmlFor="enableSound" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
            Play Audio Chime Sound on Calling Next Patient Token
          </label>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </div>

      </form>

    </div>
  );
};
