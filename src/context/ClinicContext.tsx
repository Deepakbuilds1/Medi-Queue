import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Clinic } from '../types';
import { 
  subscribeClinics, 
  subscribeClinic, 
  createClinic, 
  updateClinic, 
  toggleClinicStatus, 
  logAuditEvent,
  DEFAULT_CLINIC_ID, 
  INITIAL_CLINICS 
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
  
  // Raw clinic list from Firestore / fallbacks
  const [allClinics, setAllClinics] = useState<Clinic[]>(INITIAL_CLINICS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active clinic ID state with localStorage persistence
  const [activeClinicId, setActiveClinicIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('mediqueue_active_clinic_id');
      if (saved && INITIAL_CLINICS.some(c => c.id === saved)) {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return DEFAULT_CLINIC_ID;
  });

  // Detailed current clinic object
  const [activeClinic, setActiveClinic] = useState<Clinic | null>(() => {
    return INITIAL_CLINICS.find(c => c.id === DEFAULT_CLINIC_ID) || INITIAL_CLINICS[0];
  });

  // 1. Subscribe to all clinics from Firestore
  useEffect(() => {
    let isMounted = true;
    const unsub = subscribeClinics(
      (list) => {
        if (!isMounted) return;
        if (list && list.length > 0) {
          setAllClinics(list);
        } else {
          setAllClinics(INITIAL_CLINICS);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (!isMounted) return;
        const msg = formatFirestoreError(err, 'Could not retrieve clinic list');
        console.warn('Clinic subscription notice:', msg);
        setAllClinics(INITIAL_CLINICS);
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // 2. Synchronize clinic access based on user role & login changes
  useEffect(() => {
    if (!user) {
      // When unauthenticated, ensure valid default
      if (!allClinics.some(c => c.id === activeClinicId)) {
        setActiveClinicIdState(DEFAULT_CLINIC_ID);
      }
      setError(null);
      return;
    }

    if (isSuperAdmin) {
      // Super Admin retains their chosen clinic or default
      if (!activeClinicId || !allClinics.some(c => c.id === activeClinicId)) {
        setActiveClinicIdState(DEFAULT_CLINIC_ID);
      }
      setError(null);
    } else if (userProfile) {
      // Patient user: lock active clinic to their registered clinicId
      if (userProfile.role === 'PATIENT' || userProfile.role === 'patient') {
        const patientClinicId = userProfile.clinicId || DEFAULT_CLINIC_ID;
        if (activeClinicId !== patientClinicId) {
          setActiveClinicIdState(patientClinicId);
          try {
            localStorage.setItem('mediqueue_active_clinic_id', patientClinicId);
          } catch {}
        }
        setError(null);
        return;
      }

      const allowedClinicIds = userProfile.clinicIds || userProfile.accessibleClinicIds || (userProfile.clinicId ? [userProfile.clinicId] : []);
      
      if (userProfile.role === 'CLINIC_ADMIN' || userProfile.role === 'admin' || userProfile.role === 'DOCTOR' || userProfile.role === 'RECEPTIONIST') {
        if (allowedClinicIds.length === 0) {
          setError('No clinic has been assigned to this account. Please contact the Super Admin.');
          return;
        }
        
        setError(null);
        // If current activeClinicId is not among user's allowed clinics, set to first assigned
        if (!allowedClinicIds.includes(activeClinicId)) {
          const firstAllowed = allowedClinicIds[0];
          setActiveClinicIdState(firstAllowed);
          try {
            localStorage.setItem('mediqueue_active_clinic_id', firstAllowed);
          } catch {}
        }
      }
    }
  }, [user, userProfile, isSuperAdmin, allClinics, activeClinicId]);

  // 3. Filter visible clinics according to Role-Based Access Control (RBAC)
  const accessibleClinics = useMemo(() => {
    if (isSuperAdmin) {
      // Super Admin sees ALL clinics (Active and Inactive)
      return allClinics;
    }

    if (userProfile && (userProfile.role === 'CLINIC_ADMIN' || userProfile.role === 'admin' || userProfile.role === 'DOCTOR' || userProfile.role === 'RECEPTIONIST')) {
      // Clinic Staff sees their assigned clinics (both from clinicIds and accessibleClinicIds)
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
    const activeOnly = allClinics.filter(c => c.status === 'ACTIVE');
    return activeOnly.length > 0 ? activeOnly : allClinics;
  }, [allClinics, isSuperAdmin, userProfile]);

  // 4. Subscribe to the active clinic document details
  useEffect(() => {
    let isMounted = true;
    if (!activeClinicId || typeof activeClinicId !== 'string' || !activeClinicId.trim()) {
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
          // Document does not exist in Firestore; use standard fallback (normal state)
          const fallback = allClinics.find(c => c.id === activeClinicId) || INITIAL_CLINICS[0];
          setActiveClinic(fallback);
        }
      },
      (err) => {
        if (!isMounted) return;
        const msg = formatFirestoreError(err, `Could not retrieve details for clinic ${activeClinicId}`);
        console.warn('Active clinic fetch notice:', msg);
        const fallback = allClinics.find(c => c.id === activeClinicId) || INITIAL_CLINICS[0];
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
    if (!clinicId) return;

    // Validate if the clinic exists
    const targetClinic = allClinics.find(c => c.id === clinicId);
    if (!targetClinic) {
      console.warn(`Clinic ${clinicId} not found.`);
      return;
    }

    // RBAC validation: Non-super admins and patients cannot switch to unauthorized clinics
    if (user && !isSuperAdmin && userProfile) {
      if (userProfile.role === 'PATIENT' || userProfile.role === 'patient') {
        if (clinicId !== userProfile.clinicId) {
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
