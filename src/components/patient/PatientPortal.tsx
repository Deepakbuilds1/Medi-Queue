import React, { useState, useEffect } from 'react';
import { Search, Bell, Monitor, Ticket, PlusCircle, User, LogOut, Settings as SettingsIcon, HelpCircle, ShieldCheck, FileText, AlertTriangle, Cookie, Accessibility } from 'lucide-react';
import { ClinicSettings, QueueToken } from '../../types';
import { lookupTokenByNumber, subscribePublicQueue, subscribeUserTokens } from '../../services/clinicService';
import { playTokenCallSound } from '../../lib/sound';
import { useAuth } from '../../context/AuthContext';
import { useClinic } from '../../context/ClinicContext';
import { PatientAuthModal } from './PatientAuthModal';
import { BookTokenSection } from './BookTokenSection';
import { LegalDocType } from '../legal/LegalPagesModal';

interface PatientPortalProps {
  settings: ClinicSettings | null;
  onNavigateToAdminLogin: () => void;
  onNavigateToPublicDisplay: () => void;
  onOpenLegalDoc?: (doc: LegalDocType) => void;
  onOpenHelpCenter?: () => void;
  onOpenCookiePreferences?: () => void;
  onOpenAccountSettings?: () => void;
  onOpenForgotPassword?: () => void;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  settings,
  onNavigateToAdminLogin,
  onNavigateToPublicDisplay,
  onOpenLegalDoc,
  onOpenHelpCenter,
  onOpenCookiePreferences,
  onOpenAccountSettings,
  onOpenForgotPassword,
}) => {
  const { user, userProfile, logout } = useAuth();
  const { activeClinicId, activeClinic, clinics, switchClinic } = useClinic();

  const [activeTab, setActiveTab] = useState<'book' | 'my-tokens' | 'lookup'>('book');
  const [tokenInput, setTokenInput] = useState('');
  const [searchedToken, setSearchedToken] = useState<string | null>(null);
  const [tokenDetails, setTokenDetails] = useState<{
    tokenNumber: string;
    doctorName: string;
    roomNumber: string;
    status: string;
    patientsAhead: number;
    currentServingToken: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  // User's booked tokens from Firebase
  const [userTokens, setUserTokens] = useState<QueueToken[]>([]);

  // Live Public Queue Data
  const [publicQueue, setPublicQueue] = useState<{
    nowServing: QueueToken[];
    upNext: QueueToken[];
  }>({ nowServing: [], upNext: [] });

  useEffect(() => {
    // Subscribe to live public queue for current active clinic
    const unsubscribe = subscribePublicQueue(activeClinicId, (data) => {
      setPublicQueue(data);
    });
    return () => unsubscribe();
  }, [activeClinicId]);

  // Subscribe to logged in patient's tokens in Firebase
  useEffect(() => {
    if (!user) {
      setUserTokens([]);
      return;
    }

    const unsub = subscribeUserTokens(user.uid, (tokens) => {
      tokens.forEach((t) => {
        if (t.status === 'CALLED') {
          playTokenCallSound();
        }
      });
      setUserTokens(tokens);
    });

    return () => unsub();
  }, [user]);

  // Auto re-fetch token details if user searched for a token
  useEffect(() => {
    if (!searchedToken) return;

    const fetchDetails = async () => {
      const res = await lookupTokenByNumber(activeClinicId, searchedToken);
      if (res) {
        if (tokenDetails && tokenDetails.status !== 'CALLED' && res.status === 'CALLED') {
          playTokenCallSound();
        }
        setTokenDetails(res);
      }
    };

    fetchDetails();
    const interval = setInterval(fetchDetails, 4000);
    return () => clearInterval(interval);
  }, [searchedToken, activeClinicId, tokenDetails]);

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = tokenInput.trim();
    if (!clean) {
      setError('Please enter your token number (e.g. A-025).');
      return;
    }

    setLoading(true);
    try {
      const res = await lookupTokenByNumber(activeClinicId, clean);
      if (!res) {
        setError('Token not found in this clinic. Please check your token number.');
        setTokenDetails(null);
        setSearchedToken(null);
      } else {
        setTokenDetails(res);
        setSearchedToken(clean.toUpperCase());
        if (res.status === 'CALLED') {
          playTokenCallSound();
        }
      }
    } catch (err) {
      setError('Unable to fetch token status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clinicName = activeClinic?.name || settings?.clinicName || (activeClinicId ? `Clinic: ${activeClinicId}` : 'MediQueue Clinic');
  const clinicLogo = activeClinic?.logo || settings?.clinicLogo;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CALLED':
        return 'text-blue-700 bg-blue-100 border-blue-300 font-extrabold';
      case 'IN CONSULTATION':
        return 'text-purple-700 bg-purple-100 border-purple-300 font-extrabold';
      case 'WAITING':
        return 'text-amber-700 bg-amber-100 border-amber-300 font-bold';
      case 'COMPLETED':
        return 'text-emerald-700 bg-emerald-100 border-emerald-300 font-bold';
      case 'CANCELLED':
        return 'text-red-700 bg-red-100 border-red-300 font-bold';
      default:
        return 'text-slate-600 bg-slate-100 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased selection:bg-teal-500 selection:text-white flex flex-col justify-between">
      
      {/* Top Patient Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clinicLogo ? (
              <img src={clinicLogo} alt={clinicName} className="w-9 h-9 rounded-xl object-cover border border-slate-200" />
            ) : (
              <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center text-white font-bold">
                🏥
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-sm text-slate-900 tracking-tight">{clinicName}</h1>
              <p className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Patient Portal & Queue</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Clinic Dropdown for guests or registered clinic badge for patient */}
            {user && (userProfile?.role === 'PATIENT' || userProfile?.role === 'patient') ? (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-teal-900 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                <span>{activeClinic?.name || 'Registered Clinic'}</span>
              </div>
            ) : clinics.length > 1 ? (
              <select
                value={activeClinicId}
                onChange={(e) => switchClinic(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-1 rounded-lg cursor-pointer focus:outline-none"
              >
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : null}

            <button
              onClick={onNavigateToPublicDisplay}
              className="text-xs font-semibold text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Monitor className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">TV Display</span>
            </button>
            <button
              onClick={onNavigateToAdminLogin}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1.5 transition-colors cursor-pointer"
            >
              Admin Login
            </button>
          </div>
        </div>
      </header>

      {/* Patient User Account Banner */}
      <div className="bg-slate-900 text-white border-b border-slate-800 py-2.5 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs">
          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center font-bold text-white text-xs">
                {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'P'}
              </div>
              <div>
                <span className="font-bold text-slate-100">{userProfile?.name || 'Patient User'}</span>
                <span className="text-[11px] text-slate-400 block font-mono">{user.email}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <User className="w-4 h-4 text-amber-400" />
              <span>Connect your account to book and track your queue tokens</span>
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              {onOpenAccountSettings && (
                <button
                  type="button"
                  onClick={onOpenAccountSettings}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-400 hover:text-teal-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Account Settings"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              )}
              {onOpenHelpCenter && (
                <button
                  type="button"
                  onClick={onOpenHelpCenter}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Help Center"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Help</span>
                </button>
              )}
              <button
                onClick={logout}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {onOpenHelpCenter && (
                <button
                  type="button"
                  onClick={onOpenHelpCenter}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Help</span>
                </button>
              )}
              <button
                onClick={() => { setAuthModalMode('signin'); setIsAuthModalOpen(true); }}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthModalMode('signup'); setIsAuthModalOpen(true); }}
                className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-4">
        <div className="max-w-2xl mx-auto flex gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('book')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'book' 
                ? 'border-teal-600 text-teal-700 font-extrabold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-teal-600" />
            Book Token
          </button>

          <button
            onClick={() => setActiveTab('my-tokens')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'my-tokens' 
                ? 'border-teal-600 text-teal-700 font-extrabold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Ticket className="w-4 h-4 text-teal-600" />
            My Tokens ({userTokens.length})
          </button>

          <button
            onClick={() => setActiveTab('lookup')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'lookup' 
                ? 'border-teal-600 text-teal-700 font-extrabold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Search className="w-4 h-4 text-teal-600" />
            Token Status Lookup
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">

        {/* TAB 1: BOOK TOKEN */}
        {activeTab === 'book' && (
          <BookTokenSection
            onTokenGenerated={(_token) => {
              setActiveTab('my-tokens');
            }}
          />
        )}

        {/* TAB 2: MY BOOKED TOKENS */}
        {activeTab === 'my-tokens' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  My Booked Queue Tokens
                </h3>
                <p className="text-[11px] text-slate-500">Real-time status updates for your clinic visits</p>
              </div>
              <span className="text-[10px] bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-bold">
                Firestore Live
              </span>
            </div>

            {!user ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <Ticket className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="font-extrabold text-sm text-slate-800">Sign In to view your Tokens</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Please sign in or create an account to view and manage your clinic appointment queue tokens.
                </p>
                <button
                  onClick={() => { setAuthModalMode('signin'); setIsAuthModalOpen(true); }}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Sign In / Sign Up
                </button>
              </div>
            ) : userTokens.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <Ticket className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="font-extrabold text-sm text-slate-800">No Tokens Booked Yet</h4>
                <p className="text-xs text-slate-500">Book your first consultation token using the Book Token tab.</p>
                <button
                  onClick={() => setActiveTab('book')}
                  className="px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Book Consultation Token
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {userTokens.map((t) => (
                  <div key={t.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-2xl text-slate-900">{t.tokenNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase border ${getStatusColor(t.status)}`}>
                          {t.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{t.queueDate}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Doctor</span>
                        <span className="font-bold text-slate-800">{t.doctorName}</span>
                        <span className="text-[10px] text-teal-700 block font-semibold">{t.roomNumber}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Patient</span>
                        <span className="font-bold text-slate-800">{t.patientName}</span>
                        <span className="text-[10px] text-slate-500 block">{t.reason || 'Consultation'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PUBLIC TOKEN LOOKUP */}
        {activeTab === 'lookup' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 text-center space-y-4">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-teal-700">PATIENT TOKEN LOOKUP</span>
              <h2 className="text-xl font-black text-slate-900 mt-1">Check Your Token Status</h2>
              <p className="text-xs text-slate-500 mt-0.5">Enter the token number for {clinicName}</p>
            </div>

            <form onSubmit={handleCheckStatus} className="max-w-md mx-auto space-y-3">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  required
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="Enter Token Number (e.g. A-025)"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-teal-500 rounded-xl text-base font-mono font-bold text-slate-900 uppercase placeholder-slate-400 focus:outline-none transition-all text-center tracking-wider"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Checking Queue...' : 'CHECK STATUS'}
              </button>
            </form>

            {error && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium flex items-center justify-center gap-2">
                <span>{error}</span>
              </div>
            )}

            {tokenDetails && (
              <div className="bg-white rounded-2xl border-2 border-teal-500/80 shadow-xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 text-left mt-4">
                {tokenDetails.status === 'CALLED' && (
                  <div className="p-4 bg-blue-600 text-white rounded-xl shadow-lg animate-bounce text-center space-y-1">
                    <div className="flex items-center justify-center gap-2 font-black text-lg">
                      <Bell className="w-6 h-6 animate-spin" />
                      <span>YOUR TOKEN HAS BEEN CALLED</span>
                    </div>
                    <p className="text-xs font-semibold text-blue-100">
                      Please proceed directly to <strong className="underline text-white font-bold">{tokenDetails.roomNumber}</strong> ({tokenDetails.doctorName})
                    </p>
                  </div>
                )}

                <div className="text-center pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">YOUR TOKEN NUMBER</span>
                  <h3 className="text-5xl md:text-6xl font-black text-slate-900 font-mono tracking-tight my-1">
                    {tokenDetails.tokenNumber}
                  </h3>
                  
                  <div className="mt-2 inline-block">
                    <span className={`px-4 py-1 rounded-full text-xs font-extrabold uppercase border ${getStatusColor(tokenDetails.status)}`}>
                      STATUS: {tokenDetails.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Assigned Doctor</span>
                    <span className="font-bold text-slate-900 text-sm">{tokenDetails.doctorName}</span>
                    <span className="text-teal-700 font-semibold block text-[11px]">{tokenDetails.roomNumber}</span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 uppercase text-[10px] font-bold block">Currently Serving Token</span>
                    <span className="font-bold font-mono text-slate-900 text-sm">{tokenDetails.currentServingToken}</span>
                    <span className="text-slate-500 block text-[11px]">Active Consultation</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PUBLIC LIVE QUEUE DISPLAY */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-4">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Live Queue ({clinicName})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400">Public Token Board</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Now Serving */}
            <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-200/80">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block mb-2">
                NOW SERVING
              </span>
              {publicQueue.nowServing.length === 0 ? (
                <p className="text-xs text-slate-500 italic font-medium py-2">No patient currently being served.</p>
              ) : (
                <div className="space-y-2">
                  {publicQueue.nowServing.map(t => (
                    <div key={t.id} className="p-3 bg-white rounded-xl border border-emerald-200/80 flex justify-between items-center shadow-2xs">
                      <div>
                        <span className="font-mono font-black text-2xl text-emerald-700 block tracking-tight">{t.tokenNumber}</span>
                        {t.doctorName && <span className="text-[11px] font-semibold text-slate-600 block">{t.doctorName}</span>}
                      </div>
                      <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">{t.roomNumber}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Up Next */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                UP NEXT (WAITING)
              </span>
              {publicQueue.upNext.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No waiting patients.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {publicQueue.upNext.slice(0, 6).map(t => (
                    <span 
                      key={t.id}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 shadow-2xs"
                    >
                      {t.tokenNumber}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

      </main>

      {/* Patient Auth Modal */}
      <PatientAuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onOpenForgotPassword={onOpenForgotPassword}
        onOpenLegalDoc={onOpenLegalDoc}
      />

      {/* Production Footer with Verified Legal, Emergency & Support Links */}
      <footer className="bg-slate-900 text-slate-400 py-8 px-4 text-xs border-t border-slate-800 space-y-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
          
          {/* Col 1: Brand & Clinic Info */}
          <div className="space-y-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-teal-600 rounded-lg flex items-center justify-center font-bold text-white text-xs">
                M
              </div>
              <span className="font-extrabold text-white text-sm">MediQueue</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Multi-Clinic Queue Management & Token OS for {clinicName}.
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Tenant ID: {activeClinicId}
            </p>
          </div>

          {/* Col 2: Legal & Disclosures */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
              Legal & Compliance
            </h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalDoc && onOpenLegalDoc('privacy')}
                  className="hover:text-teal-400 transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalDoc && onOpenLegalDoc('terms')}
                  className="hover:text-teal-400 transition-colors cursor-pointer"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalDoc && onOpenLegalDoc('disclaimer')}
                  className="text-amber-400 hover:text-amber-300 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Medical Disclaimer</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalDoc && onOpenLegalDoc('cancellation')}
                  className="hover:text-teal-400 transition-colors cursor-pointer"
                >
                  Cancellation Policy
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Architecture & Security */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
              Security & Privacy
            </h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalDoc && onOpenLegalDoc('security')}
                  className="hover:text-teal-400 transition-colors cursor-pointer"
                >
                  Security Architecture
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalDoc && onOpenLegalDoc('cookies')}
                  className="hover:text-teal-400 transition-colors cursor-pointer"
                >
                  Cookie & Storage Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenCookiePreferences}
                  className="hover:text-teal-400 transition-colors cursor-pointer text-teal-400"
                >
                  Cookie Preferences
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegalDoc && onOpenLegalDoc('accessibility')}
                  className="hover:text-teal-400 transition-colors cursor-pointer"
                >
                  Accessibility Statement
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Support & Navigation */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
              Assistance & Help
            </h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button
                  type="button"
                  onClick={onOpenHelpCenter}
                  className="hover:text-teal-400 transition-colors cursor-pointer text-teal-400 font-semibold"
                >
                  Help Center & FAQs
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateToPublicDisplay}
                  className="hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  TV Waiting Display
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateToAdminLogin}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Clinic Admin Portal
                </button>
              </li>
              {user && (
                <li>
                  <button
                    type="button"
                    onClick={onOpenAccountSettings}
                    className="hover:text-teal-400 transition-colors cursor-pointer"
                  >
                    Account & Data Export
                  </button>
                </li>
              )}
            </ul>
          </div>

        </div>

        {/* Bottom copyright & emergency warning */}
        <div className="max-w-4xl mx-auto pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-3">
          <p>© {new Date().getFullYear()} {clinicName}. All rights reserved.</p>
          <div className="flex items-center gap-1.5 text-amber-500/90 text-[10px]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Emergency medical cases: Dial 911 / 112 immediately.</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
