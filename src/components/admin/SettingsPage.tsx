import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Building2, Phone, Mail, MapPin, Hash, Save, CheckCircle2 } from 'lucide-react';
import { ClinicSettings } from '../../types';
import { updateSettings } from '../../services/clinicService';
import { useClinic } from '../../context/ClinicContext';
import { ClinicBrandingSection } from './ClinicBrandingSection';

interface SettingsPageProps {
  settings: ClinicSettings | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings }) => {
  const { activeClinicId, activeClinic, editClinic } = useClinic();

  const [clinicName, setClinicName] = useState(activeClinic?.name || settings?.clinicName || '');
  const [clinicAddress, setClinicAddress] = useState(activeClinic?.address || settings?.clinicAddress || '');
  const [phone, setPhone] = useState(activeClinic?.phone || settings?.phone || '');
  const [email, setEmail] = useState(activeClinic?.email || settings?.email || '');
  const [tokenPrefix, setTokenPrefix] = useState(activeClinic?.tokenPrefix || settings?.tokenPrefix || 'A');
  const [startingTokenNumber, setStartingTokenNumber] = useState(activeClinic?.startingTokenNumber || settings?.startingTokenNumber || 1);
  const [enableSound, setEnableSound] = useState(activeClinic?.tokenDisplaySettings?.enableSound ?? true);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (activeClinic) {
      setClinicName(activeClinic.name);
      setClinicAddress(activeClinic.address || '');
      setPhone(activeClinic.phone || '');
      setEmail(activeClinic.email || '');
      setTokenPrefix(activeClinic.tokenPrefix || 'A');
      setStartingTokenNumber(activeClinic.startingTokenNumber || 1);
      setEnableSound(activeClinic.tokenDisplaySettings?.enableSound ?? true);
    }
  }, [activeClinic]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await updateSettings(activeClinicId, {
        clinicName,
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
      await editClinic(activeClinicId, {
        name: clinicName,
        address: clinicAddress,
        phone,
        email,
        tokenPrefix: tokenPrefix.toUpperCase(),
        startingTokenNumber: Number(startingTokenNumber)
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
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Clinic Configuration {activeClinic?.name ? `(${activeClinic.name})` : ''}
            </h2>
            <p className="text-xs text-slate-500">Update Profile Details, Logo Branding & Token Generation Rules • Scoped to /clinics/{activeClinicId}</p>
          </div>
        </div>
      </div>

      {/* Clinic Branding & Logo Section */}
      <ClinicBrandingSection
        clinicId={activeClinicId}
        clinicName={activeClinic?.name || clinicName || 'MediQueue Clinic'}
        currentLogo={activeClinic?.logo || activeClinic?.logoUrl || settings?.clinicLogo || ''}
      />

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Settings saved successfully! Changes reflect instantly.
        </div>
      )}

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
            {saving ? 'Saving Changes...' : 'Save General Settings'}
          </button>
        </div>

      </form>

    </div>
  );
};
