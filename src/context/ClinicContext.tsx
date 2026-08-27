import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Clinic } from '../types';
import { 
  subscribeClinics, 
  subscribeClinic, 
  createClinic, 
  updateClinic, 
  toggleClinicStatus, 
  logAuditEvent 
} from '../services/clinicService';
import { useAuth } from './AuthContext';
import { formatFirestoreError } from '../utils/errorUtils';

export interface ClinicContextType {
  // Clinic collections
  clinics: Clinic[];
  availableClinics: Clinic[]; // Alias
  allClinics: Clinic[];
  
  // Active/Current Clinic State
  currentClinic: Clinic | null;
  activeClinic: Clinic | null; // Alias
  currentClinicId: string;
  activeClinicId: string; // Alias
  
  // Status states
  loading: boolean;
  error: string | null;
  
  // Clinic switching & management functions
  switchClinic: (clinicId: string) => void;
  setActiveClinicId: (clinicId: string) => void; // Alias
  refreshClinics: () => void;
  createNewClinic: (data: Omit<Clinic, 'createdAt' | 'updatedAt'>) => Promise<Clinic>;
  editClinic: (id: string, data: Partial<Clinic>) => Promise<void>;
  toggleStatus: (id: string, currentStatus: 'ACTIVE' | 'INACTIVE') => Promise<void>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export const ClinicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isSuperAdmin, user } = useAuth();
  
  // Raw clinic list from Firestore (starts empty)
  const [allClinics, setAllClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active clinic ID state with localStorage persistence (no hardcoded default clinic)
  const [activeClinicId, setActiveClinicIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('mediqueue_active_clinic_id');
      if (saved && typeof saved === 'string' && saved.trim()) {
        return saved.trim();
      }
    } catch {
      // Ignore storage read errors
    }
    return '';
  });

  // Detailed current clinic object (null when no clinic selected or found)
  const [activeClinic, setActiveClinic] = useState<Clinic | null>(null);

  // 1. Subscribe to all clinics from Firestore
  useEffect(() => {
    let isMounted = true;
    const unsub = subscribeClinics(
      (list) => {
        if (!isMounted) return;
        const validList = Array.isArray(list) ? list : [];
        setAllClinics(validList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (!isMounted) return;
        const msg = formatFirestoreError(err, 'Could not retrieve clinic list');
        console.warn('Clinic subscription notice:', msg);
        setAllClinics([]);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // 2. Synchronize clinic access based on loaded clinics, user role, & persistence
  useEffect(() => {
    if (loading) return;

    // Check if saved clinicId in localStorage exists in loaded Firestore clinics
    let currentSavedId = '';
    try {
      currentSavedId = localStorage.getItem('mediqueue_active_clinic_id') || '';
    } catch {}

    if (currentSavedId && !allClinics.some(c => c.id === currentSavedId)) {
      // Stale clinic ID detected; remove from localStorage
      try {
        localStorage.removeItem('mediqueue_active_clinic_id');
      } catch {}
    }

    if (!user) {
      // Unauthenticated / Public visitor:
      // If the current activeClinicId does not exist in loaded clinics, reset to empty
      if (activeClinicId && !allClinics.some(c => c.id === activeClinicId)) {
        setActiveClinicIdState('');
        setActiveClinic(null);
        try {
          localStorage.removeItem('mediqueue_active_clinic_id');
        } catch {}
      }
      setError(null);
      return;
    }

    if (isSuperAdmin) {
      // Super Admin: retains chosen clinic if it exists, or selects first available if active is invalid
      if (activeClinicId && !allClinics.some(c => c.id === activeClinicId)) {
        const fallbackId = allClinics.length > 0 ? allClinics[0].id : '';
        setActiveClinicIdState(fallbackId);
        try {
          if (fallbackId) {
            localStorage.setItem('mediqueue_active_clinic_id', fallbackId);
          } else {
            localStorage.removeItem('mediqueue_active_clinic_id');
          }
        } catch {}
      }
      setError(null);
    } else if (userProfile) {
      // Patient user: lock active clinic to their registered clinicId
      if (userProfile.role === 'PATIENT' || userProfile.role === 'patient') {
        const patientClinicId = userProfile.clinicId || '';
        if (patientClinicId && allClinics.some(c => c.id === patientClinicId)) {
          if (activeClinicId !== patientClinicId) {
            setActiveClinicIdState(patientClinicId);
            try {
              localStorage.setItem('mediqueue_active_clinic_id', patientClinicId);
            } catch {}
          }
          setError(null);
        } else if (patientClinicId && allClinics.length > 0 && !allClinics.some(c => c.id === patientClinicId)) {
          // Registered clinic is no longer in Firestore
          setActiveClinicIdState('');
          setActiveClinic(null);
          try {
            localStorage.removeItem('mediqueue_active_clinic_id');
          } catch {}
          setError('Your registered clinic is no longer available. Please contact the clinic administrator.');
        } else if (!patientClinicId) {
          // No clinic assigned yet
          if (activeClinicId && !allClinics.some(c => c.id === activeClinicId)) {
            setActiveClinicIdState('');
            setActiveClinic(null);
          }
          setError(null);
        }
        return;
      }

      // Clinic Staff (CLINIC_ADMIN, DOCTOR, RECEPTIONIST)
      const allowedClinicIds = userProfile.clinicIds || userProfile.accessibleClinicIds || (userProfile.clinicId ? [userProfile.clinicId] : []);
      const validAllowedClinics = allowedClinicIds.filter(id => allClinics.some(c => c.id === id));
      
      if (userProfile.role === 'CLINIC_ADMIN' || userProfile.role === 'admin' || userProfile.role === 'DOCTOR' || userProfile.role === 'RECEPTIONIST') {
        if (validAllowedClinics.length === 0) {
          setActiveClinicIdState('');
          setActiveClinic(null);
          try {
            localStorage.removeItem('mediqueue_active_clinic_id');
          } catch {}
          setError('No valid clinic has been assigned to this account. Please contact the Super Admin.');
          return;
        }
        
        setError(null);
        // If current activeClinicId is not among user's valid allowed clinics, set to first assigned
        if (!validAllowedClinics.includes(activeClinicId)) {
          const firstAllowed = validAllowedClinics[0];
          setActiveClinicIdState(firstAllowed);
          try {
            localStorage.setItem('mediqueue_active_clinic_id', firstAllowed);
          } catch {}
        }
      }
    }
  }, [user, userProfile, isSuperAdmin, allClinics, activeClinicId, loading]);

  // 3. Filter visible clinics according to Role-Based Access Control (RBAC)
  const accessibleClinics = useMemo(() => {
    if (isSuperAdmin) {
      // Super Admin sees ALL clinics (Active and Inactive)
      return allClinics;
    }

    if (userProfile && (userProfile.role === 'CLINIC_ADMIN' || userProfile.role === 'admin' || userProfile.role === 'DOCTOR' || userProfile.role === 'RECEPTIONIST')) {
      // Clinic Staff sees their assigned clinics
      const allowedList = userProfile.clinicIds || userProfile.accessibleClinicIds || (userProfile.clinicId ? [userProfile.clinicId] : []);
      const allowedSet = new Set<string>(allowedList);
      return allClinics.filter(c => allowedSet.has(c.id));
    }

    if (userProfile && (userProfile.role === 'PATIENT' || userProfile.role === 'patient')) {
      // Registered patient is locked to their registered clinic
      const pClinicId = userProfile.clinicId;
      if (pClinicId) {
        const found = allClinics.filter(c => c.id === pClinicId);
        if (found.length > 0) return found;
      }
    }

    // Guest views only ACTIVE clinics
    return allClinics.filter(c => c.status === 'ACTIVE');
  }, [allClinics, isSuperAdmin, userProfile]);

  // 4. Subscribe to the active clinic document details
  useEffect(() => {
    let isMounted = true;
    if (!activeClinicId || typeof activeClinicId !== 'string' || !activeClinicId.trim()) {
      setActiveClinic(null);
      return;
    }

    // Set immediate synchronous preview from allClinics list to avoid flicker
    const found = allClinics.find(c => c.id === activeClinicId);
    if (found) {
      setActiveClinic(found);
    }

    const unsub = subscribeClinic(
      activeClinicId,
      (clinicDoc) => {
        if (!isMounted) return;
        if (clinicDoc) {
          setActiveClinic(clinicDoc);
        } else {
          // Document does not exist in Firestore; clean up stale active state without loops
          const fallback = allClinics.find(c => c.id === activeClinicId);
          if (fallback) {
            setActiveClinic(fallback);
          } else {
            setActiveClinic(null);
            setActiveClinicIdState('');
            try {
              localStorage.removeItem('mediqueue_active_clinic_id');
            } catch {}
          }
        }
      },
      (err) => {
        if (!isMounted) return;
        const msg = formatFirestoreError(err, `Could not retrieve details for clinic ${activeClinicId}`);
        console.warn('Active clinic fetch notice:', msg);
        const fallback = allClinics.find(c => c.id === activeClinicId) || null;
        setActiveClinic(fallback);
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [activeClinicId, allClinics]);

  // 5. Centralized switchClinic implementation
  const switchClinic = useCallback((clinicId: string) => {
    if (!clinicId || !clinicId.trim()) {
      try {
        localStorage.removeItem('mediqueue_active_clinic_id');
      } catch {}
      setActiveClinicIdState('');
      setActiveClinic(null);
      return;
    }

    // Validate if the clinic exists in loaded Firestore clinics
    const targetClinic = allClinics.find(c => c.id === clinicId);
    if (!targetClinic) {
      // Do not set or keep non-existent clinic
      return;
    }

    // RBAC validation: Non-super admins and patients cannot switch to unauthorized clinics
    if (user && !isSuperAdmin && userProfile) {
      if (userProfile.role === 'PATIENT' || userProfile.role === 'patient') {
        if (userProfile.clinicId && clinicId !== userProfile.clinicId) {
          console.warn(`Access denied: Patient accounts are locked to registered clinic ${userProfile.clinicId}`);
          return;
        }
      } else {
        const allowedList = userProfile.clinicIds || userProfile.accessibleClinicIds || (userProfile.clinicId ? [userProfile.clinicId] : []);
        const isAllowed = allowedList.includes(clinicId);
        
        if (!isAllowed) {
          console.warn(`Access denied: User does not have permission to switch to clinic ${clinicId}`);
          return;
        }
      }
    }

    try {
      localStorage.setItem('mediqueue_active_clinic_id', clinicId);
    } catch {
      // ignore storage errors
    }

    setActiveClinicIdState(clinicId);
    setActiveClinic(targetClinic);

    // Audit log switch event
    if (user) {
      logAuditEvent({
        action: 'CLINIC_SWITCH',
        clinicId,
        clinicName: targetClinic.name,
        details: { switchedTo: clinicId }
      });
    }
  }, [allClinics, isSuperAdmin, user, userProfile]);

  const setActiveClinicId = switchClinic;

  const refreshClinics = useCallback(() => {
    setLoading(true);
    // Subscription will update state automatically
    setTimeout(() => setLoading(false), 500);
  }, []);

  // 6. Super Admin / Admin Clinic Operations
  const createNewClinic = async (data: Omit<Clinic, 'createdAt' | 'updatedAt'>) => {
    const created = await createClinic(data);
    await logAuditEvent({
      action: 'CLINIC_CREATED',
      clinicId: created.id,
      clinicName: created.name
    });
    switchClinic(created.id);
    return created;
  };

  const editClinic = async (id: string, data: Partial<Clinic>) => {
    const targetClinic = allClinics.find(c => c.id === id);
    const resolvedName = data.name || targetClinic?.name;
    await updateClinic(id, data);
    await logAuditEvent({
      action: 'CLINIC_UPDATED',
      clinicId: id,
      clinicName: resolvedName,
      details: { fields: Object.keys(data), clinicName: resolvedName }
    });
  };

  const toggleStatus = async (id: string, currentStatus: 'ACTIVE' | 'INACTIVE') => {
    const targetClinic = allClinics.find(c => c.id === id);
    const resolvedName = targetClinic?.name;
    await toggleClinicStatus(id, currentStatus);
    await logAuditEvent({
      action: 'CLINIC_STATUS_TOGGLE',
      clinicId: id,
      clinicName: resolvedName,
      details: { newStatus: currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', clinicName: resolvedName }
    });
  };

  const value: ClinicContextType = {
    clinics: accessibleClinics,
    availableClinics: accessibleClinics,
    allClinics,
    currentClinic: activeClinic,
    activeClinic,
    currentClinicId: activeClinicId,
    activeClinicId,
    loading,
    error,
    switchClinic,
    setActiveClinicId,
    refreshClinics,
    createNewClinic,
    editClinic,
    toggleStatus
  };

  return (
    <ClinicContext.Provider value={value}>
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = (): ClinicContextType => {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
};
