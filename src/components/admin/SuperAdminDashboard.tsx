import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  PlusCircle, 
  ShieldCheck, 
  Power, 
  Edit3, 
  CheckCircle2, 
  ArrowRight, 
  Stethoscope, 
  Ticket, 
  Mail, 
  Phone, 
  MapPin, 
  Sparkles, 
  Search, 
  Users, 
  Filter, 
  Activity, 
  ChevronRight, 
  ExternalLink,
  UserCheck,
  UserX,
  KeyRound,
  History,
  Lock,
  Clock,
  Shield,
  Layers
} from 'lucide-react';
import { Clinic, Doctor, QueueToken, Patient, UserProfile, AuditLog } from '../../types';
import { useClinic } from '../../context/ClinicContext';
import { useAuth } from '../../context/AuthContext';
import { 
  subscribeClinicAdmins, 
  createClinicAdminAccount, 
  updateClinicAdminProfile, 
  toggleClinicAdminStatus, 
  sendClinicAdminPasswordReset,
  subscribeAuditLogs 
} from '../../services/clinicService';

interface SuperAdminDashboardProps {
  onSwitchClinicAndNavigate: (clinicId: string) => void;
  currentTokens?: QueueToken[];
  currentDoctors?: Doctor[];
  currentPatients?: Patient[];
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onSwitchClinicAndNavigate,
  currentTokens = [],
  currentDoctors = [],
  currentPatients = []
}) => {
  const { clinics, allClinics, activeClinicId, switchClinic, createNewClinic, editClinic, toggleStatus } = useClinic();
  const { user, userRole, isSuperAdmin, loading: authLoading, authReady } = useAuth();

  // Navigation Tab
  const [activeTab, setActiveTab] = useState<'clinics' | 'admins' | 'audit'>('clinics');

  // Clinic list state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedClinicToEdit, setSelectedClinicToEdit] = useState<Clinic | null>(null);

  // Clinic Form state
  const [createForm, setCreateForm] = useState({
    id: '',
    name: '',
    slug: '',
    logo: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=150&auto=format&fit=crop&q=80',
    address: '',
    phone: '',
    email: '',
    tokenPrefix: 'C',
    startingTokenNumber: 1,
    adminEmail: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });

  const [editForm, setEditForm] = useState<Partial<Clinic>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Clinic Admins Management State
  const [clinicAdmins, setClinicAdmins] = useState<UserProfile[]>([]);
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);
  const [isEditAdminClinicsModalOpen, setIsEditAdminClinicsModalOpen] = useState(false);
  const [selectedAdminToEdit, setSelectedAdminToEdit] = useState<UserProfile | null>(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  const [newAdminForm, setNewAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    clinicIds: [] as string[]
  });

  const [editAdminClinics, setEditAdminClinics] = useState<string[]>([]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Real-time subscriptions for Admins & Audit Logs (strictly guarded by verified auth session)
  useEffect(() => {
    if (authLoading || !authReady || !user || !isSuperAdmin || userRole !== 'SUPER_ADMIN') {
      return;
    }

    const unsubAdmins = subscribeClinicAdmins(
      (admins) => setClinicAdmins(admins)
    );

    const unsubAudit = subscribeAuditLogs(
      (logs) => setAuditLogs(logs)
    );

    return () => {
      unsubAdmins();
      unsubAudit();
    };
  }, [user, userRole, isSuperAdmin, authLoading, authReady]);

  // Active clinic object
  const activeClinic = allClinics.find(c => c.id === activeClinicId) || clinics.find(c => c.id === activeClinicId);

  // Filtered clinics
  const filteredClinics = useMemo(() => {
    return allClinics.filter(c => {
      const matchesStatus = 
        statusFilter === 'ALL' ? true : c.status === statusFilter;
      
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.id.toLowerCase().includes(query) ||
        (c.address && c.address.toLowerCase().includes(query)) ||
        (c.slug && c.slug.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    }).sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allClinics, statusFilter, searchQuery]);

  // Filtered admins
  const filteredAdmins = useMemo(() => {
    const query = adminSearchQuery.toLowerCase().trim();
    if (!query) return clinicAdmins;
    return clinicAdmins.filter(a => 
      a.email.toLowerCase().includes(query) ||
      (a.name && a.name.toLowerCase().includes(query)) ||
      (a.displayName && a.displayName.toLowerCase().includes(query))
    );
  }, [clinicAdmins, adminSearchQuery]);

  const activeClinicsCount = allClinics.filter(c => c.status === 'ACTIVE').length;
  const totalClinicsCount = allClinics.length;

  const handleCreateNameChange = (name: string) => {
    const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const autoId = `clinic_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const autoPrefix = name.charAt(0).toUpperCase() || 'C';
    setCreateForm(prev => ({
      ...prev,
      name,
      slug: autoSlug,
      id: prev.id ? prev.id : autoId,
      tokenPrefix: prev.tokenPrefix || autoPrefix
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name) return;
    setSubmitting(true);
    try {
      const newClinic = await createNewClinic({
        id: createForm.id || `clinic_${Date.now()}`,
        name: createForm.name,
        slug: createForm.slug || createForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        logo: createForm.logo,
        address: createForm.address || 'Medical District',
        phone: createForm.phone || '+1 (800) 555-0100',
        email: createForm.email || 'admin@clinic.com',
        tokenPrefix: createForm.tokenPrefix.toUpperCase() || 'A',
        startingTokenNumber: Number(createForm.startingTokenNumber) || 1,
        status: createForm.status,
        adminEmail: createForm.adminEmail || createForm.email,
        tokenDisplaySettings: {
          enableSound: true,
          autoRefreshInterval: 5,
          announcementVoice: true
        }
      });
      setNotification(`Successfully registered and activated new clinic: ${newClinic.name}`);
      setIsCreateModalOpen(false);
      setCreateForm({
        id: '',
        name: '',
        slug: '',
        logo: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=150&auto=format&fit=crop&q=80',
        address: '',
        phone: '',
        email: '',
        tokenPrefix: 'C',
        startingTokenNumber: 1,
        adminEmail: '',
        status: 'ACTIVE'
      });
    } catch (err: any) {
      console.error(err);
      setNotification('Failed to create clinic. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (clinic: Clinic) => {
    setSelectedClinicToEdit(clinic);
    setEditForm({ ...clinic });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinicToEdit) return;
    setSubmitting(true);
    try {
      await editClinic(selectedClinicToEdit.id, editForm);
      setNotification(`Clinic settings updated for ${editForm.name || selectedClinicToEdit.name}`);
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setNotification('Failed to update clinic.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (clinic: Clinic) => {
    try {
      await toggleStatus(clinic.id, clinic.status);
      setNotification(`Clinic status changed to ${clinic.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Create Clinic Admin Handler
  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminForm.email || !newAdminForm.password) return;
    setSubmitting(true);
    try {
      await createClinicAdminAccount({
        name: newAdminForm.name || newAdminForm.email.split('@')[0],
        email: newAdminForm.email,
        password: newAdminForm.password,
        phone: newAdminForm.phone,
        clinicIds: newAdminForm.clinicIds.length > 0 ? newAdminForm.clinicIds : (allClinics[0]?.id ? [allClinics[0].id] : [])
      });
      setNotification(`Created new Clinic Admin: ${newAdminForm.email}`);
      setIsCreateAdminModalOpen(false);
      setNewAdminForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        clinicIds: []
      });
    } catch (err: any) {
      console.error('Create admin error:', err);
      setNotification(err.message || 'Failed to create Clinic Admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Admin Assigned Clinics Handler
  const handleOpenEditAdminClinics = (admin: UserProfile) => {
    setSelectedAdminToEdit(admin);
    const assigned = admin.clinicIds || admin.accessibleClinicIds || (admin.clinicId ? [admin.clinicId] : []);
    setEditAdminClinics(assigned);
    setIsEditAdminClinicsModalOpen(true);
  };

  const handleSaveAdminClinics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminToEdit) return;
    setSubmitting(true);
    try {
      await updateClinicAdminProfile(selectedAdminToEdit.uid, {
        clinicIds: editAdminClinics,
        accessibleClinicIds: editAdminClinics,
        clinicId: editAdminClinics[0] || undefined
      });
      setNotification(`Updated clinic access for ${selectedAdminToEdit.email}`);
      setIsEditAdminClinicsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setNotification('Failed to update assigned clinics.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAdminStatus = async (admin: UserProfile) => {
    try {
      await toggleClinicAdminStatus(admin.uid, admin.status);
      setNotification(`Admin status updated for ${admin.email}`);
    } catch (err: any) {
      console.error(err);
      setNotification('Failed to update admin status.');
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      await sendClinicAdminPasswordReset(email);
      setNotification(`Password reset instructions emailed to ${email}`);
    } catch (err: any) {
      console.error(err);
      setNotification('Failed to send password reset email.');
    }
  };

  const waitingTokensCount = currentTokens.filter(t => t.status === 'WAITING').length;
  const inConsultTokensCount = currentTokens.filter(t => t.status === 'IN CONSULTATION' || t.status === 'CALLED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              Super Admin Console
            </span>
            <span className="text-xs text-slate-400 font-mono">Multi-Tenant Management Engine</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Super Admin Control Center</h1>
          <p className="text-xs text-slate-300">
            Manage all clinics, provision Clinic Admin accounts, assign multi-clinic permissions, and audit security events.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreateAdminModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-indigo-300 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Users className="w-4 h-4 text-indigo-400" />
            + New Clinic Admin
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            + Provision Clinic
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* Navigation Tab Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2">
        <button
          onClick={() => setActiveTab('clinics')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'clinics'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Clinics Management ({totalClinicsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('admins')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'admins'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clinic Admins & Access ({clinicAdmins.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <History className="w-4 h-4" />
          <span>System Audit Logs ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: CLINICS MANAGEMENT */}
      {activeTab === 'clinics' && (
        <div className="space-y-6">
          {/* CURRENT ACTIVE CLINIC PANEL */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-indigo-500/40 dark:border-indigo-500/30 p-5 md:p-6 shadow-lg shadow-indigo-500/5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-100 dark:border-slate-700">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Currently Selected Administrative Context
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                  <span>{activeClinic?.name || (activeClinicId ? `Clinic: ${activeClinicId}` : 'Select a Clinic')}</span>
                  <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-md ${
                    activeClinic?.status === 'ACTIVE'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {activeClinic?.status || 'ACTIVE'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Clinic ID: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{activeClinicId}</span> • Scope: <span className="text-slate-700 dark:text-slate-300">/clinics/{activeClinicId}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={activeClinicId}
                    onChange={(e) => switchClinic(e.target.value)}
                    className="w-full sm:w-64 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-xs font-bold py-2.5 px-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                  >
                    {allClinics.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => onSwitchClinicAndNavigate(activeClinicId)}
                  className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
                >
                  <span>Open Queue Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Current Clinic Detail Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Active Doctors</span>
                  <Stethoscope className="w-4 h-4 text-indigo-500" />
                </div>
                <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {currentDoctors.length}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Patients Registered</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {currentPatients.length}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Waiting Tokens</span>
                  <Ticket className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-xl md:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {waitingTokensCount}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">In Consultation</span>
                  <Activity className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {inConsultTokensCount}
                </p>
              </div>
            </div>
          </div>

          {/* SEARCH AND FILTER BAR */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by clinic name, ID, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-500">Status:</span>
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Clinics Directory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClinics.map((clinic) => {
              const isActiveClinic = clinic.id === activeClinicId;
              const isEnabled = clinic.status === 'ACTIVE';

              return (
                <div 
                  key={clinic.id} 
                  className={`bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                    isActiveClinic 
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
                  }`}
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={clinic.logo} 
                          alt={clinic.name} 
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                              {clinic.name}
                            </h3>
                            {isActiveClinic && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active Context" />
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">ID: {clinic.id}</span>
                        </div>
                      </div>

                      <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md ${
                        isEnabled
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {clinic.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{clinic.address}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{clinic.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{clinic.adminEmail || clinic.email}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl text-[11px] border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400 block font-semibold text-[10px] uppercase">Token Prefix</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs">{clinic.tokenPrefix}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold text-[10px] uppercase">Start Number</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs">#{clinic.startingTokenNumber}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(clinic)}
                        title="Edit Clinic Settings"
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(clinic)}
                        title={isEnabled ? 'Deactivate Clinic' : 'Activate Clinic'}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isEnabled
                            ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                            : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => switchClinic(clinic.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isActiveClinic
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-200 dark:border-indigo-800'
                        }`}
                      >
                        <span>{isActiveClinic ? 'Active Context' : 'Switch Context'}</span>
                      </button>

                      <button
                        onClick={() => onSwitchClinicAndNavigate(clinic.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isActiveClinic
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <span>Manage Queue</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CLINIC ADMINS MANAGEMENT */}
      {activeTab === 'admins' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search admins by name or email..."
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => setIsCreateAdminModalOpen(true)}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Users className="w-4 h-4" />
              + Create Clinic Admin
            </button>
          </div>

          {/* Admins Table */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Administrator</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Assigned Clinics</th>
                    <th className="py-3.5 px-4">Account Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredAdmins.map((admin) => {
                    const isSuper = admin.role === 'SUPER_ADMIN' || admin.email === 'gdeepak4689@gmail.com';
                    const assignedList = admin.clinicIds || admin.accessibleClinicIds || (admin.clinicId ? [admin.clinicId] : []);
                    const isActiveStatus = admin.status !== 'inactive' && admin.status !== 'INACTIVE';

                    return (
                      <tr key={admin.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${
                              isSuper ? 'bg-indigo-600' : 'bg-slate-700'
                            }`}>
                              {admin.name?.charAt(0) || admin.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {admin.name || admin.displayName || admin.email.split('@')[0]}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {admin.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isSuper
                              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                              : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          }`}>
                            {isSuper ? 'SUPER ADMIN' : 'CLINIC ADMIN'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {isSuper ? (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Global Access (All {allClinics.length} Clinics)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {assignedList.length > 0 ? (
                                assignedList.map(cId => {
                                  const cDoc = allClinics.find(c => c.id === cId);
                                  return (
                                    <span 
                                      key={cId}
                                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-medium border border-slate-200 dark:border-slate-600"
                                    >
                                      {cDoc?.name || cId}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[11px] text-red-500 font-bold">
                                  No clinics assigned
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isActiveStatus
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                          }`}>
                            {isActiveStatus ? 'Active' : 'Disabled'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isSuper && (
                              <>
                                <button
                                  onClick={() => handleOpenEditAdminClinics(admin)}
                                  title="Assign Clinics"
                                  className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Layers className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleSendPasswordReset(admin.email)}
                                  title="Send Password Reset Email"
                                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleToggleAdminStatus(admin)}
                                  title={isActiveStatus ? 'Disable Account' : 'Enable Account'}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isActiveStatus
                                      ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                                      : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                  }`}
                                >
                                  {isActiveStatus ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  Security & Access Event Logs
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Real-time audit log of administrative switches, credential events, and tenant modifications.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Clinic Context</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-mono">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50">
                        <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-sans font-bold text-indigo-600 dark:text-indigo-400">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-slate-600 dark:text-slate-300 font-sans">
                          {log.actorEmail} ({log.actorRole})
                        </td>
                        <td className="py-2.5 px-4 text-[11px]">
                          {log.clinicName || log.clinicId || 'Global'}
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-slate-500 font-sans truncate max-w-xs">
                          {JSON.stringify(log.details || {})}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CLINIC ADMIN */}
      {isCreateAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Create Clinic Admin Account</h3>
                  <p className="text-[11px] text-slate-500">Super Admin provisions email + temporary password</p>
                </div>
              </div>
              <button onClick={() => setIsCreateAdminModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreateAdminSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Admin Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. John Watson"
                  value={newAdminForm.name}
                  onChange={(e) => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="john@clinic.com"
                    value={newAdminForm.email}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={newAdminForm.password}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  Assign Authorized Clinic(s) *
                </label>
                <p className="text-[11px] text-slate-500">Select one or multiple clinics this administrator can switch between:</p>
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 space-y-2 bg-slate-50 dark:bg-slate-900/60">
                  {allClinics.map(c => {
                    const isChecked = newAdminForm.clinicIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAdminForm(prev => ({ ...prev, clinicIds: [...prev.clinicIds, c.id] }));
                            } else {
                              setNewAdminForm(prev => ({ ...prev, clinicIds: prev.clinicIds.filter(id => id !== c.id) }));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className={isChecked ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                          {c.name} ({c.tokenPrefix})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateAdminModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || newAdminForm.clinicIds.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating Admin...' : 'Create Admin Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ASSIGNED CLINICS */}
      {isEditAdminClinicsModalOpen && selectedAdminToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-base">Assign Clinic Access</h3>
                <p className="text-[11px] text-slate-500">{selectedAdminToEdit.email}</p>
              </div>
              <button onClick={() => setIsEditAdminClinicsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleSaveAdminClinics} className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">Select Authorized Clinics:</label>
                <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 space-y-2 bg-slate-50 dark:bg-slate-900/60">
                  {allClinics.map(c => {
                    const isChecked = editAdminClinics.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditAdminClinics(prev => [...prev, c.id]);
                            } else {
                              setEditAdminClinics(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className={isChecked ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                          {c.name} ({c.id})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditAdminClinicsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || editAdminClinics.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CLINIC MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg">Provision New Clinic Tenant</h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Clinic Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Health Center"
                    value={createForm.name}
                    onChange={(e) => handleCreateNameChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Unique Clinic ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. clinic_apex"
                    value={createForm.id}
                    onChange={(e) => setCreateForm({ ...createForm, id: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Token Prefix</label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="e.g. A, AP"
                    value={createForm.tokenPrefix}
                    onChange={(e) => setCreateForm({ ...createForm, tokenPrefix: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Phone</label>
                  <input
                    type="text"
                    placeholder="+1 (800) 555-0100"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Address / City</label>
                <input
                  type="text"
                  placeholder="e.g. 742 Evergreen Terrace, Springfield"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Admin Email</label>
                  <input
                    type="email"
                    placeholder="admin@clinic.com"
                    value={createForm.adminEmail}
                    onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Provisioning...' : 'Confirm & Provision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CLINIC MODAL */}
      {isEditModalOpen && selectedClinicToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg">Edit Clinic: {selectedClinicToEdit.name}</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Clinic Name</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Address / City</label>
                <input
                  type="text"
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Admin Email</label>
                  <input
                    type="email"
                    value={editForm.adminEmail || editForm.email || ''}
                    onChange={(e) => setEditForm({ ...editForm, adminEmail: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Token Prefix</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={editForm.tokenPrefix || ''}
                    onChange={(e) => setEditForm({ ...editForm, tokenPrefix: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    value={editForm.status || 'ACTIVE'}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
