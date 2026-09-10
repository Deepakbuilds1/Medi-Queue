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
    <div className="space-y-4 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0F172A]">
              Facility Configuration {activeClinic?.name ? `• ${activeClinic.name}` : ''}
            </h1>
            <p className="text-xs text-slate-500">Clinic metadata, logo branding, and queue generation rules</p>
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
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Settings saved successfully. Changes are live across all displays.
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 space-y-4">
        
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
          General Clinic Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Facility Name *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Administrative Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Physical Address
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={clinicAddress}
                onChange={(e) => setClinicAddress(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>
        </div>

        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 pt-2">
          Token & Display Rules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Default Token Prefix
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                maxLength={2}
                value={tokenPrefix}
                onChange={(e) => setTokenPrefix(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold uppercase text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Daily Starting Token Sequence
            </label>
            <input
              type="number"
              min={1}
              value={startingTokenNumber}
              onChange={(e) => setStartingTokenNumber(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-700"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 pt-2">
          <input
            type="checkbox"
            id="enableSound"
            checked={enableSound}
            onChange={(e) => setEnableSound(e.target.checked)}
            className="w-4 h-4 accent-teal-700 rounded cursor-pointer"
          />
          <label htmlFor="enableSound" className="text-xs font-medium text-slate-700 cursor-pointer">
            Play chime sound effect when calling next patient
          </label>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Changes...' : 'Save Configuration'}</span>
          </button>
        </div>

      </form>

    </div>
  );
};
