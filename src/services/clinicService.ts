import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  query, 
  where, 
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  Query,
  DocumentReference
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut as authSignOut, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth, getSecondaryAuth } from '../lib/firebase';
import { 
  Clinic, 
  ClinicSettings, 
  Doctor, 
  Patient, 
  QueueToken, 
  TokenStatus, 
  UserProfile, 
  AuditLog,
  UserRole,
  AuthorizationCheckParams,
  AuthorizationResult
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
}

const SETTINGS_DOC_ID = 'main_clinic_settings';

export const DEFAULT_SETTINGS: ClinicSettings = {
  clinicId: '',
  clinicName: 'MediQueue Clinic',
  clinicLogo: '',
  clinicAddress: '',
  phone: '',
  email: '',
  tokenPrefix: 'A',
  startingTokenNumber: 1,
  tokenDisplaySettings: {
    enableSound: true,
    autoRefreshInterval: 5,
    announcementVoice: true
  }
};

import { formatFirestoreError } from '../utils/errorUtils';

export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export type FirestoreErrorCallback = (errorMessage: string) => void;

export interface ListenerGuardOptions {
  path: string;
  filter?: string;
  clinicId?: string;
  authRequired?: boolean;
  requiresAdmin?: boolean;
  requiredRole?: UserRole | UserRole[];
  guard?: () => boolean | Promise<boolean>;
}

/**
 * Creates a managed real-time Firestore listener with strict authorization guards,
 * automatic retry for transient network errors, clean permission error termination,
 * and clean unsubscription.
 */
function createManagedListener<T>(
  createQuery: () => Query | DocumentReference,
  parseSnapshot: (snapshot: any) => T,
  onData: (data: T) => void,
  onError?: FirestoreErrorCallback,
  options?: ListenerGuardOptions
): () => void {
  let unsub: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let isCancelled = false;

  const superAdminSession = typeof window !== 'undefined'
    ? sessionStorage.getItem('mediqueue_super_admin_session')
    : null;

  // Immediate synchronous guard: Do NOT attach listener if authentication required but missing
  if ((options?.authRequired || options?.requiresAdmin || options?.requiredRole) && !auth.currentUser && !superAdminSession) {
    if (onError) onError('Access restricted: Authentication required.');
    return () => {};
  }
  if (options?.guard && typeof options.guard === 'function') {
    try {
      const res = options.guard();
      if (typeof res === 'boolean' && !res) return () => {};
    } catch {}
  }

  const startListening = async () => {
    if (isCancelled) return;

    const currentSuperSession = typeof window !== 'undefined'
      ? sessionStorage.getItem('mediqueue_super_admin_session')
      : null;

    // 1. Check Auth Requirement
    if ((options?.authRequired || options?.requiresAdmin || options?.requiredRole) && !auth.currentUser && !currentSuperSession) {
      if (onError) onError('Access restricted: Authentication required.');
      return;
    }

    // 2. Authoritative Security Check using verifyUserAuthorization
    if (options?.requiresAdmin || options?.requiredRole) {
      try {
        const defaultAdminRoles: UserRole[] = ['SUPER_ADMIN', 'CLINIC_ADMIN', 'admin'];
        const requiredRoles: UserRole[] = options.requiredRole
          ? (Array.isArray(options.requiredRole) ? options.requiredRole : [options.requiredRole])
          : defaultAdminRoles;

        const authCheck = await verifyUserAuthorization({
          clinicId: options.clinicId,
          requiredRole: requiredRoles
        });

        if (isCancelled) return;

        if (!authCheck.isAuthorized) {
          const deniedReason = authCheck.reason || 'Access restricted: Insufficient administrative privileges.';
          if (onError) {
            onError(deniedReason);
          }
          return;
        }
      } catch (authErr: any) {
        if (isCancelled) return;
        if (onError) {
          onError(`Security check failed: ${authErr?.message || 'Unauthorized'}`);
        }
        return;
      }
    }

    // 3. Custom guard check
    if (options?.guard) {
      try {
        const guardPassed = await options.guard();
        if (isCancelled || !guardPassed) return;
      } catch {
        return;
      }
    }

    if (isCancelled) return;

    try {
      const ref = createQuery();
      unsub = onSnapshot(
        ref as any,
        (snapshot) => {
          if (isCancelled) return;
          const data = parseSnapshot(snapshot);
          onData(data);
        },
        (error: any) => {
          if (isCancelled) return;
          const errMsg = formatFirestoreError(error, 'Firestore real-time listener encountered an issue');
          const isPermissionDenied = 
            error?.code === 'permission-denied' || 
            errMsg.toLowerCase().includes('permission') || 
            errMsg.toLowerCase().includes('insufficient');

          if (isPermissionDenied) {
            // Cleanly terminate listener on permission denial without retry loop
            if (unsub) {
              try { unsub(); } catch (_) {}
              unsub = null;
            }
            if (onError) {
              onError(`Access restricted: ${errMsg}`);
            }
            return;
          }

          // Transient network error handling
          if (onError) {
            onError(`Live connection notice: ${errMsg}`);
          }

          if (unsub) {
            try { unsub(); } catch (_) {}
            unsub = null;
          }

          if (!retryTimer && !isCancelled) {
            retryTimer = setTimeout(() => {
              retryTimer = null;
              if (!isCancelled && (!options?.authRequired || !!auth.currentUser || !!sessionStorage.getItem('mediqueue_super_admin_session'))) {
                startListening();
              }
            }, 8000);
          }
        }
      );
    } catch (err: any) {
      if (isCancelled) return;
      const formattedErr = formatFirestoreError(err, 'Subscription initialization failed');
      if (onError) {
        onError(formattedErr);
      }
      if (!retryTimer && !isCancelled) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (!isCancelled && (!options?.authRequired || !!auth.currentUser || !!sessionStorage.getItem('mediqueue_super_admin_session'))) {
            startListening();
          }
        }, 8000);
      }
    }
  };

  startListening();

  return () => {
    isCancelled = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (unsub) {
      try { unsub(); } catch (_) {}
      unsub = null;
    }
  };
}

// -------------------------------------------------------------
// CLINIC REPOSITORY & MULTI-TENANT MANAGEMENT
// -------------------------------------------------------------

export function subscribeClinics(
  callback: (clinics: Clinic[]) => void,
  onError?: FirestoreErrorCallback
) {
  return createManagedListener(
    () => collection(db, 'clinics'),
    (snapshot) => {
      return snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id })) as Clinic[];
    },
    callback,
    onError,
    { path: 'clinics', filter: 'all' }
  );
}

export function subscribeClinic(
  clinicId: string,
  callback: (clinic: Clinic | null) => void,
  onError?: FirestoreErrorCallback
) {
  if (!clinicId || !clinicId.trim()) {
    callback(null);
    return () => {};
  }
  return createManagedListener(
    () => doc(db, 'clinics', clinicId.trim()),
    (snapshot) => {
      if (snapshot.exists()) {
        return { ...snapshot.data(), id: snapshot.id } as Clinic;
      }
      return null;
    },
    callback,
    onError,
    { path: `clinics/${clinicId}`, clinicId }
  );
}

export async function createClinic(clinicData: Omit<Clinic, 'createdAt' | 'updatedAt'>): Promise<Clinic> {
  const now = new Date().toISOString();
  const cleanId = clinicData.id.trim() || `clinic_${clinicData.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`;
  
  const fullClinic: Clinic = {
    ...clinicData,
    id: cleanId,
    slug: clinicData.slug || clinicData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    status: clinicData.status || 'ACTIVE',
    tokenPrefix: clinicData.tokenPrefix?.toUpperCase() || 'A',
    startingTokenNumber: Number(clinicData.startingTokenNumber) || 1,
    createdAt: now,
    updatedAt: now,
    tokenDisplaySettings: clinicData.tokenDisplaySettings || {
      enableSound: true,
      autoRefreshInterval: 5,
      announcementVoice: true
    }
  };

  try {
    await setDoc(doc(db, 'clinics', cleanId), fullClinic, { merge: true });
    
    // Seed default doctors for this new clinic if none exist
    const docRef = collection(db, 'clinics', cleanId, 'doctors');
    const existingDocs = await getDocs(docRef);
    if (existingDocs.empty) {
      await addDoc(docRef, {
        clinicId: cleanId,
        name: 'Dr. Lead Practitioner',
        specialization: 'General Medicine',
        roomNumber: 'Room 1',
        tokenPrefix: fullClinic.tokenPrefix,
        status: 'ACTIVE',
        createdAt: now
      });
    }

    return fullClinic;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clinics/${cleanId}`);
    throw err;
  }
}

export async function updateClinic(clinicId: string, data: Partial<Clinic>) {
  if (!clinicId) throw new Error('Clinic ID is required to update clinic.');
  const now = new Date().toISOString();
  try {
    await setDoc(doc(db, 'clinics', clinicId), { ...data, updatedAt: now }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `clinics/${clinicId}`);
    throw err;
  }
}

export async function toggleClinicStatus(clinicId: string, currentStatus: 'ACTIVE' | 'INACTIVE') {
  if (!clinicId) return;
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  await updateClinic(clinicId, { status: newStatus });
}

// -------------------------------------------------------------
// SEEDING / DEFAULT DATA INITIALIZATION
// -------------------------------------------------------------

export async function seedInitialDataIfEmpty() {
  return;
}

// -------------------------------------------------------------
// CLINIC-SCOPED SETTINGS
// -------------------------------------------------------------

export function subscribeSettings(
  clinicId: string,
  callback: (settings: ClinicSettings | null) => void,
  onError?: FirestoreErrorCallback
) {
  if (!clinicId || !clinicId.trim()) {
    callback(null);
    return () => {};
  }
  return createManagedListener(
    () => doc(db, 'clinics', clinicId.trim()),
    (snapshot) => {
      if (snapshot.exists()) {
        const c = snapshot.data() as Clinic;
        return {
          id: snapshot.id,
          clinicId: snapshot.id,
          clinicName: c.name || DEFAULT_SETTINGS.clinicName,
          clinicLogo: c.logo || DEFAULT_SETTINGS.clinicLogo,
          clinicAddress: c.address || DEFAULT_SETTINGS.clinicAddress,
          phone: c.phone || DEFAULT_SETTINGS.phone,
          email: c.email || DEFAULT_SETTINGS.email,
          tokenPrefix: c.tokenPrefix || DEFAULT_SETTINGS.tokenPrefix,
          startingTokenNumber: c.startingTokenNumber || DEFAULT_SETTINGS.startingTokenNumber,
          tokenDisplaySettings: c.tokenDisplaySettings || DEFAULT_SETTINGS.tokenDisplaySettings
        };
      }
      return null;
    },
    callback,
    onError,
    { path: `clinics/${clinicId}/settings`, clinicId }
  );
}

export async function updateSettings(
  clinicId: string,
  settings: Partial<ClinicSettings>
) {
  if (!clinicId) throw new Error('Clinic ID is required to update settings.');
  const authCheck = await verifyUserAuthorization({
    clinicId,
    requiredRole: ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized to update clinic settings.');
  }

  try {
    const updatePayload: Partial<Clinic> = {
      name: settings.clinicName,
      logo: settings.clinicLogo,
      address: settings.clinicAddress,
      phone: settings.phone,
      email: settings.email,
      tokenPrefix: settings.tokenPrefix,
      startingTokenNumber: settings.startingTokenNumber,
      tokenDisplaySettings: settings.tokenDisplaySettings
    };
    await setDoc(doc(db, 'clinics', clinicId), updatePayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clinics/${clinicId}/settings`);
    throw err;
  }
}

// -------------------------------------------------------------
// CLINIC-SCOPED DOCTORS
// -------------------------------------------------------------

export function subscribeDoctors(
  clinicId: string,
  callback: (doctors: Doctor[]) => void,
  onError?: FirestoreErrorCallback
) {
  if (!clinicId || !clinicId.trim()) {
    callback([]);
    return () => {};
  }
  return createManagedListener(
    () => collection(db, 'clinics', clinicId.trim(), 'doctors'),
    (snapshot) => {
      return snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id, clinicId })) as Doctor[];
    },
    callback,
    onError,
    { path: `clinics/${clinicId}/doctors`, clinicId }
  );
}

export async function addDoctor(clinicId: string, doctor: Omit<Doctor, 'id'>) {
  if (!clinicId) throw new Error('Clinic ID is required.');
  const authCheck = await verifyUserAuthorization({
    clinicId,
    requiredRole: ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized to add doctor.');
  }

  try {
    const res = await addDoc(collection(db, 'clinics', clinicId, 'doctors'), {
      ...doctor,
      clinicId,
      createdAt: new Date().toISOString()
    });
    return { id: res.id, clinicId, ...doctor };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clinics/${clinicId}/doctors`);
    throw err;
  }
}

export async function updateDoctor(clinicId: string, doctorId: string, data: Partial<Doctor>) {
  if (!clinicId || !doctorId) throw new Error('Clinic ID and Doctor ID are required.');
  const authCheck = await verifyUserAuthorization({
    clinicId,
    requiredRole: ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized to modify doctor profile.');
  }

  try {
    await updateDoc(doc(db, 'clinics', clinicId, 'doctors', doctorId), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `clinics/${clinicId}/doctors/${doctorId}`);
    throw err;
  }
}

export async function deleteDoctor(clinicId: string, doctorId: string) {
  if (!clinicId || !doctorId) throw new Error('Clinic ID and Doctor ID are required.');
  const authCheck = await verifyUserAuthorization({
    clinicId,
    requiredRole: ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized to remove doctor.');
  }

  try {
    await deleteDoc(doc(db, 'clinics', clinicId, 'doctors', doctorId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `clinics/${clinicId}/doctors/${doctorId}`);
    throw err;
  }
}

// -------------------------------------------------------------
// CLINIC-SCOPED PATIENTS DIRECTORY
// -------------------------------------------------------------

export function subscribePatients(
  clinicId: string,
  callback: (patients: Patient[]) => void,
  onError?: FirestoreErrorCallback
) {
  if (!clinicId || !clinicId.trim()) {
    callback([]);
    return () => {};
  }
  return createManagedListener(
    () => collection(db, 'clinics', clinicId.trim(), 'patients'),
    (snapshot) => {
      return snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id, clinicId })) as Patient[];
    },
    callback,
    onError,
    { 
      path: `clinics/${clinicId}/patients`, 
      clinicId, 
      authRequired: true,
      requiresAdmin: true,
      requiredRole: ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN', 'DOCTOR', 'RECEPTIONIST']
    }
  );
}

export async function getPatients(clinicId: string): Promise<Patient[]> {
  if (!clinicId || !clinicId.trim()) return [];
  const authCheck = await verifyUserAuthorization({
    clinicId,
    requiredRole: ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN', 'DOCTOR', 'RECEPTIONIST']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized to access patient directory.');
  }

  try {
    const snap = await getDocs(collection(db, 'clinics', clinicId.trim(), 'patients'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id, clinicId })) as Patient[];
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `clinics/${clinicId}/patients`);
    throw err;
  }
}

export async function addPatientRecord(clinicId: string, data: Omit<Patient, 'id' | 'patientId' | 'createdAt'>) {
  if (!clinicId) throw new Error('Clinic ID is required.');
  const authCheck = await verifyUserAuthorization({
    clinicId,
    requiredRole: ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN', 'DOCTOR', 'RECEPTIONIST']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized to register patient record.');
  }

  try {
    const snap = await getDocs(collection(db, 'clinics', clinicId, 'patients'));
    const nextNumber = snap.size + 1001;
    const patientId = `PAT-${nextNumber}`;
    const now = new Date().toISOString();

    const docRef = await addDoc(collection(db, 'clinics', clinicId, 'patients'), {
      ...data,
      clinicId,
      patientId,
      createdAt: now,
      lastVisit: getTodayDateString(),
      totalVisits: 1
    });

    return { id: docRef.id, clinicId, patientId, createdAt: now, lastVisit: getTodayDateString(), totalVisits: 1, ...data };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clinics/${clinicId}/patients`);
    throw err;
  }
}

export async function updatePatientRecord(clinicId: string, patientId: string, data: Partial<Patient>) {
  if (!clinicId || !patientId) throw new Error('Clinic ID and Patient ID are required.');
  const authCheck = await verifyUserAuthorization({
    clinicId,
    requiredRole: ['CLINIC_ADMIN', 'admin', 'SUPER_ADMIN', 'DOCTOR', 'RECEPTIONIST']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized to update patient record.');
  }

  try {
    await updateDoc(doc(db, 'clinics', clinicId, 'patients', patientId), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `clinics/${clinicId}/patients/${patientId}`);
    throw err;
  }
}

// -------------------------------------------------------------
// CLINIC-SCOPED TOKENS & QUEUE ENGINE
// -------------------------------------------------------------

export function subscribeTodayTokens(
  clinicId: string,
  callback: (tokens: QueueToken[]) => void,
  onError?: FirestoreErrorCallback
) {
  if (!clinicId || !clinicId.trim()) {
    callback([]);
    return () => {};
  }
  const todayStr = getTodayDateString();
  return createManagedListener(
    () => query(collection(db, 'clinics', clinicId.trim(), 'tokens'), where('queueDate', '==', todayStr)),
    (snapshot) => {
      const list = snapshot.docs.map((d: any) => ({
        ...d.data(),
        id: d.id,
        clinicId
      })) as QueueToken[];
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return list;
    },
    callback,
    onError,
    { path: `clinics/${clinicId}/tokens`, filter: `queueDate==${todayStr}`, clinicId }
  );
}

export async function getTokensByDateRange(
  clinicId: string,
  startDateStr: string, 
  endDateStr: string
): Promise<QueueToken[]> {
  if (!clinicId || !clinicId.trim()) {
    return [];
  }
  try {
    const q = query(collection(db, 'clinics', clinicId.trim(), 'tokens'));
    const snap = await getDocs(q);
    const all = snap.docs.map((d: any) => ({ ...d.data(), id: d.id, clinicId })) as QueueToken[];
    return all.filter(t => t.queueDate >= startDateStr && t.queueDate <= endDateStr);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `clinics/${clinicId}/tokens`);
    return [];
  }
}

// -------------------------------------------------------------
// USER PROFILE & RBAC REPOSITORY
// -------------------------------------------------------------

export async function saveUserProfile(profile: {
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  phone: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  role?: UserProfile['role'];
  clinicId?: string;
  clinicName?: string;
  clinicIds?: string[];
  accessibleClinicIds?: string[];
  activeClinicId?: string;
  status?: 'active' | 'inactive' | 'ACTIVE' | 'INACTIVE';
}) {
  const now = new Date().toISOString();
  
  // Designate default super admin
  let role = profile.role || 'PATIENT';
  if (profile.email === 'gdeepak4689@gmail.com') {
    role = 'SUPER_ADMIN';
  }

  const resolvedClinicIds = profile.clinicIds || profile.accessibleClinicIds || (profile.clinicId ? [profile.clinicId] : []);
  const resolvedClinicId = profile.clinicId || (resolvedClinicIds.length > 0 ? resolvedClinicIds[0] : '');

  const dataToSave: Record<string, any> = {
    uid: profile.uid,
    email: profile.email,
    name: profile.name || profile.displayName || profile.email.split('@')[0],
    displayName: profile.displayName || profile.name || profile.email.split('@')[0],
    phone: profile.phone || '',
    age: Number(profile.age) || 30,
    gender: profile.gender || 'Other',
    role,
    clinicId: resolvedClinicId,
    clinicName: profile.clinicName || '',
    clinicIds: resolvedClinicIds,
    accessibleClinicIds: resolvedClinicIds,
    activeClinicId: profile.activeClinicId || resolvedClinicId,
    status: profile.status || 'active',
    updatedAt: now,
  };

  try {
    const userRef = doc(db, 'users', profile.uid);
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      dataToSave.createdAt = now;
    }
    await setDoc(userRef, dataToSave, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${profile.uid}`);
    throw err;
  }

  return dataToSave as unknown as UserProfile;
}

export async function getUserProfile(uid: string) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data() as UserProfile;
      // Normalize clinicIds / accessibleClinicIds
      if (!data.clinicIds && data.accessibleClinicIds) {
        data.clinicIds = data.accessibleClinicIds;
      }
      if (!data.accessibleClinicIds && data.clinicIds) {
        data.accessibleClinicIds = data.clinicIds;
      }
      return data;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
  }
  return null;
}

/**
 * Authoritative Server-Verified Authorization Function.
 * Validates the caller's role from Firebase Auth Custom Claims, ID token claims,
 * and authoritative server-side Firestore user documents.
 * Replaces purely client-side role checks with verified authorization.
 */
export async function verifyUserAuthorization(
  params?: AuthorizationCheckParams
): Promise<AuthorizationResult> {
  const superAdminSession = typeof window !== 'undefined' 
    ? sessionStorage.getItem('mediqueue_super_admin_session') 
    : null;
  const currentUser = auth.currentUser;

  // Unauthenticated caller check
  if (!currentUser && !superAdminSession) {
    return {
      isAuthorized: false,
      userId: null,
      email: null,
      role: 'PATIENT',
      claims: {},
      isSuperAdmin: false,
      isClinicAdmin: false,
      isStaff: false,
      isPatient: true,
      authorizedClinicIds: [],
      hasClinicAccess: false,
      userProfile: null,
      reason: 'Authentication required. No active session found.'
    };
  }

  let claims: Record<string, any> = {};
  let userProfile: UserProfile | null = null;
  const uid = currentUser?.uid || 'super-admin-session';
  const email = currentUser?.email || (superAdminSession ? 'superadmin@mediqueue.internal' : null);

  // 1. Verify Custom Claims from Firebase Auth token
  if (currentUser) {
    try {
      const tokenResult = await currentUser.getIdTokenResult(params?.forceRefreshClaims ?? false);
      claims = tokenResult.claims || {};
    } catch (claimErr) {
      console.warn('Unable to refresh token claims, falling back to profile verification:', claimErr);
    }

    // 2. Fetch authoritative Firestore profile document
    try {
      userProfile = await getUserProfile(currentUser.uid);
    } catch (profileErr) {
      console.warn('Unable to fetch user profile doc:', profileErr);
    }
  }

  // 3. Resolve role from Custom Claims first, then Firestore profile, with designated Super Admin check
  let resolvedRole: UserRole = 'PATIENT';
  
  if (superAdminSession) {
    resolvedRole = 'SUPER_ADMIN';
  } else if (claims.role && typeof claims.role === 'string') {
    resolvedRole = claims.role as UserRole;
  } else if (claims.isSuperAdmin === true) {
    resolvedRole = 'SUPER_ADMIN';
  } else if (claims.admin === true || claims.isClinicAdmin === true) {
    resolvedRole = 'CLINIC_ADMIN';
  } else if (userProfile?.role) {
    resolvedRole = userProfile.role;
  } else if (currentUser?.email === 'gdeepak4689@gmail.com') {
    resolvedRole = 'SUPER_ADMIN';
  }

  // Normalize role string representation
  if (resolvedRole === 'admin') resolvedRole = 'CLINIC_ADMIN';
  if (resolvedRole === 'patient') resolvedRole = 'PATIENT';

  // 4. Verify account active status
  if (userProfile && (userProfile.status === 'inactive' || userProfile.status === 'INACTIVE')) {
    return {
      isAuthorized: false,
      userId: uid,
      email,
      role: resolvedRole,
      claims,
      isSuperAdmin: false,
      isClinicAdmin: false,
      isStaff: false,
      isPatient: false,
      authorizedClinicIds: [],
      hasClinicAccess: false,
      userProfile,
      reason: 'Account disabled. Please contact the clinic administrator.'
    };
  }

  // 5. Compute role booleans
  const isSuperAdmin = resolvedRole === 'SUPER_ADMIN' || !!superAdminSession || !!claims.isSuperAdmin;
  const isClinicAdmin = isSuperAdmin || resolvedRole === 'CLINIC_ADMIN' || !!claims.admin || !!claims.isClinicAdmin;
  const isStaff = isClinicAdmin || resolvedRole === 'DOCTOR' || resolvedRole === 'RECEPTIONIST';
  const isPatient = !isSuperAdmin && !isStaff && (resolvedRole === 'PATIENT');

  // 6. Resolve authorized clinic IDs from custom claims and user profile
  const authorizedClinicIds: string[] = [];
  if (claims.clinicIds && Array.isArray(claims.clinicIds)) {
    for (const c of claims.clinicIds) {
      if (typeof c === 'string' && !authorizedClinicIds.includes(c)) authorizedClinicIds.push(c);
    }
  } else if (claims.clinicId && typeof claims.clinicId === 'string') {
    authorizedClinicIds.push(claims.clinicId);
  }

  if (userProfile?.clinicIds && Array.isArray(userProfile.clinicIds)) {
    for (const id of userProfile.clinicIds) {
      if (!authorizedClinicIds.includes(id)) authorizedClinicIds.push(id);
    }
  }
  if (userProfile?.accessibleClinicIds && Array.isArray(userProfile.accessibleClinicIds)) {
    for (const id of userProfile.accessibleClinicIds) {
      if (!authorizedClinicIds.includes(id)) authorizedClinicIds.push(id);
    }
  }
  if (userProfile?.clinicId && !authorizedClinicIds.includes(userProfile.clinicId)) {
    authorizedClinicIds.push(userProfile.clinicId);
  }

  // 7. Check specific clinic access if requested
  const targetClinicId = params?.clinicId?.trim();
  const hasClinicAccess = isSuperAdmin || (
    !targetClinicId || (authorizedClinicIds.length > 0 && authorizedClinicIds.includes(targetClinicId))
  );

  // 8. Check required roles if specified
  let hasRoleMatch = true;
  if (params?.requiredRole) {
    const requiredRoles = Array.isArray(params.requiredRole) ? params.requiredRole : [params.requiredRole];
    const normalizedReq = requiredRoles.map(r => r === 'admin' ? 'CLINIC_ADMIN' : (r === 'patient' ? 'PATIENT' : r));
    hasRoleMatch = isSuperAdmin || normalizedReq.includes(resolvedRole);
  }

  // 9. Compute authorization outcome
  let isAuthorized = true;
  let reason: string | undefined;

  if (isPatient && params?.requiredRole) {
    isAuthorized = false;
    reason = 'Access denied: Patient accounts are strictly prohibited from administrative data.';
  } else if (!hasRoleMatch) {
    isAuthorized = false;
    reason = `Access denied: Insufficient privileges for this operation. Required: ${Array.isArray(params?.requiredRole) ? params?.requiredRole.join(', ') : params?.requiredRole}.`;
  } else if (targetClinicId && !hasClinicAccess) {
    isAuthorized = false;
    reason = `Access denied: Account is not authorized to access clinic (${targetClinicId}).`;
  }

  return {
    isAuthorized,
    userId: uid,
    email,
    role: resolvedRole,
    claims,
    isSuperAdmin,
    isClinicAdmin,
    isStaff,
    isPatient,
    authorizedClinicIds,
    hasClinicAccess,
    userProfile,
    reason
  };
}


/**
 * Safely removes any undefined properties from an object so Firestore addDoc/setDoc never throws 'Unsupported field value: undefined'.
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(data: T): Partial<T> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = sanitizeFirestoreData(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as Partial<T>;
}

// -------------------------------------------------------------
// AUDIT LOGGING SERVICE (WITH OFFLINE & PERMISSION RESILIENCE)
// -------------------------------------------------------------

const LOCAL_AUDIT_LOGS_KEY = 'mediqueue_audit_logs_cache';

function getLocalAuditLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAuditLog(log: AuditLog): void {
  try {
    const logs = getLocalAuditLogs();
    // Prepend new log and keep up to 100 recent entries
    const updated = [log, ...logs.filter(l => l.id !== log.id)].slice(0, 100);
    localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(updated));
  } catch {
    // Local storage failure fallback (quota/private mode)
  }
}

export async function logAuditEvent(params: {
  action: AuditLog['action'];
  clinicId?: string | null;
  clinicName?: string | null;
  actorUid?: string;
  actorEmail?: string;
  actorRole?: 'SUPER_ADMIN' | 'CLINIC_ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'patient';
  details?: Record<string, any>;
}): Promise<void> {
  const currentUser = auth.currentUser;
  const now = new Date().toISOString();
  const fallbackId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Determine actor details accurately
  const actorUid = params.actorUid || currentUser?.uid || 'session_user';
  const actorEmail = params.actorEmail || currentUser?.email || (params.actorRole === 'SUPER_ADMIN' ? 'superadmin@mediqueue.internal' : undefined);
  const isSuper = actorEmail === 'gdeepak4689@gmail.com' || actorEmail === 'superadmin@mediqueue.internal' || params.actorRole === 'SUPER_ADMIN';
  const actorRole = params.actorRole || (isSuper ? 'SUPER_ADMIN' : 'CLINIC_ADMIN');

  // Safely resolve clinicId & clinicName
  let resolvedClinicId: string | undefined = undefined;
  let resolvedClinicName: string | undefined = undefined;

  if (params.clinicId && typeof params.clinicId === 'string' && params.clinicId.trim()) {
    resolvedClinicId = params.clinicId.trim();
  }

  if (params.clinicName && typeof params.clinicName === 'string' && params.clinicName.trim()) {
    resolvedClinicName = params.clinicName.trim();
  }

  // Construct audit payload strictly avoiding undefined values
  const rawLogData: Record<string, any> = {
    action: params.action,
    timestamp: now
  };

  if (actorUid) rawLogData.actorUid = actorUid;
  if (actorEmail) rawLogData.actorEmail = actorEmail;
  if (actorRole) rawLogData.actorRole = actorRole;
  if (resolvedClinicId) rawLogData.clinicId = resolvedClinicId;
  if (resolvedClinicName) rawLogData.clinicName = resolvedClinicName;
  if (params.details && typeof params.details === 'object' && Object.keys(params.details).length > 0) {
    rawLogData.details = params.details;
  }

  const cleanData = sanitizeFirestoreData(rawLogData);

  // Always buffer in local storage for instant offline resilience
  const localRecord: AuditLog = {
    id: fallbackId,
    actorUid,
    actorEmail,
    actorRole: actorRole as any,
    action: params.action,
    clinicId: resolvedClinicId,
    clinicName: resolvedClinicName,
    timestamp: now,
    details: params.details || {}
  };
  saveLocalAuditLog(localRecord);

  // Do not attempt remote Firestore write if user is not authenticated in Firebase Auth
  if (!auth.currentUser) {
    return;
  }

  // Attempt Firestore remote sync
  try {
    const docRef = await addDoc(collection(db, 'auditLogs'), cleanData);
    if (docRef?.id) {
      localRecord.id = docRef.id;
      saveLocalAuditLog(localRecord);
    }
  } catch (err: any) {
    // Fail-safe: remote Firestore write skipped without breaking caller
  }
}

export function subscribeAuditLogs(
  callback: (logs: AuditLog[]) => void,
  onError?: (err: any) => void,
  clinicId?: string
): () => void {
  // Immediately provide cached local logs while listener connects
  const initialLocal = getLocalAuditLogs();
  const relevantInitial = clinicId
    ? initialLocal.filter(l => l.clinicId === clinicId)
    : initialLocal;
  if (relevantInitial.length > 0) {
    callback(relevantInitial);
  }

  const superAdminSession = typeof window !== 'undefined'
    ? sessionStorage.getItem('mediqueue_super_admin_session')
    : null;

  // Strict Lifecycle Guard: Do NOT create or start listener if unauthenticated in Firebase Auth or without Super Admin session
  if (!auth.currentUser && !superAdminSession) {
    if (onError) onError('Access restricted: Authentication required to view audit logs.');
    return () => {};
  }

  const createAuditQuery = () => {
    if (clinicId && typeof clinicId === 'string' && clinicId.trim()) {
      return query(
        collection(db, 'auditLogs'),
        where('clinicId', '==', clinicId.trim()),
        limit(50)
      );
    }
    return query(
      collection(db, 'auditLogs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
  };

  return createManagedListener<AuditLog[]>(
    createAuditQuery,
    (snapshot) => {
      const remoteLogs = snapshot.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      })) as AuditLog[];

      // Merge remote logs with any recent locally buffered logs
      const localLogs = getLocalAuditLogs();
      const relevantLocal = clinicId
        ? localLogs.filter(l => l.clinicId === clinicId)
        : localLogs;

      const mergedMap = new Map<string, AuditLog>();

      for (const log of relevantLocal) {
        mergedMap.set(log.id, log);
      }
      for (const log of remoteLogs) {
        mergedMap.set(log.id, log);
      }

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return merged.slice(0, 50);
    },
    callback,
    (err) => {
      // If remote subscription is restricted, fallback smoothly to local audit cache
      const local = getLocalAuditLogs();
      const filtered = clinicId ? local.filter(l => l.clinicId === clinicId) : local;
      callback(filtered);
      if (onError) onError(err);
    },
    { 
      path: 'auditLogs', 
      filter: clinicId ? `clinicId == ${clinicId}` : 'limit 50', 
      clinicId,
      authRequired: true,
      requiresAdmin: true,
      requiredRole: ['SUPER_ADMIN', 'CLINIC_ADMIN', 'admin'],
      guard: async () => {
        const check = await verifyUserAuthorization({
          clinicId,
          requiredRole: ['SUPER_ADMIN', 'CLINIC_ADMIN', 'admin']
        });
        return check.isAuthorized;
      }
    }
  );
}

export async function getAuditLogs(clinicId?: string): Promise<AuditLog[]> {
  const authCheck = await verifyUserAuthorization({
    clinicId,
    requiredRole: ['SUPER_ADMIN', 'CLINIC_ADMIN', 'admin']
  });
  if (!authCheck.isAuthorized) {
    return getLocalAuditLogs();
  }

  try {
    let q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50));
    if (clinicId && clinicId.trim()) {
      q = query(collection(db, 'auditLogs'), where('clinicId', '==', clinicId.trim()), limit(50));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id })) as AuditLog[];
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'auditLogs');
    return getLocalAuditLogs();
  }
}

// -------------------------------------------------------------
// CLINIC ADMIN MANAGEMENT SERVICE (SUPER ADMIN)
// -------------------------------------------------------------

export async function createClinicAdminAccount(params: {
  name: string;
  email: string;
  password: string;
  clinicIds: string[];
  phone?: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
}): Promise<UserProfile> {
  const authCheck = await verifyUserAuthorization({
    requiredRole: ['SUPER_ADMIN']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized: Only Super Administrators can provision staff accounts.');
  }

  const secondaryAuth = getSecondaryAuth();
  
  // 1. Create the user in Firebase Auth without disturbing current Super Admin session
  const cred = await createUserWithEmailAndPassword(secondaryAuth, params.email.trim(), params.password);
  const newUid = cred.user.uid;

  // 2. Sign out the secondary auth instance immediately
  try {
    await authSignOut(secondaryAuth);
  } catch (_) {}

  // 3. Create user profile in Firestore
  const resolvedClinicIds = params.clinicIds.length > 0 ? params.clinicIds : [];
  const profile = await saveUserProfile({
    uid: newUid,
    email: params.email.trim(),
    name: params.name.trim(),
    displayName: params.name.trim(),
    phone: params.phone || '',
    age: params.age || 35,
    gender: params.gender || 'Male',
    role: 'CLINIC_ADMIN',
    clinicIds: resolvedClinicIds,
    accessibleClinicIds: resolvedClinicIds,
    clinicId: resolvedClinicIds[0] || '',
    activeClinicId: resolvedClinicIds[0] || '',
    status: 'active'
  });

  // 4. Log audit event
  const primaryClinicId = resolvedClinicIds[0] || '';
  await logAuditEvent({
    action: 'ADMIN_CREATED',
    clinicId: primaryClinicId || undefined,
    details: {
      adminEmail: params.email,
      assignedClinicIds: resolvedClinicIds
    }
  });

  return profile;
}

export function subscribeClinicAdmins(
  callback: (admins: UserProfile[]) => void,
  onError?: (err: any) => void
): () => void {
  const superAdminSession = typeof window !== 'undefined' ? sessionStorage.getItem('mediqueue_super_admin_session') : null;
  if (!auth.currentUser && !superAdminSession) {
    callback([]);
    if (onError) onError('Access restricted: Authentication required to view administrative users.');
    return () => {};
  }
  return createManagedListener<UserProfile[]>(
    () => collection(db, 'users'),
    (snapshot) => {
      const all = snapshot.docs.map((d: any) => ({
        ...d.data(),
        uid: d.id
      })) as UserProfile[];
      
      // Filter for administrative users
      return all.filter(u => u.role === 'CLINIC_ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'admin');
    },
    callback,
    onError,
    { 
      path: 'users', 
      filter: 'role in [CLINIC_ADMIN, SUPER_ADMIN]', 
      authRequired: true,
      requiresAdmin: true,
      requiredRole: ['SUPER_ADMIN'],
      guard: async () => {
        const check = await verifyUserAuthorization({
          requiredRole: ['SUPER_ADMIN']
        });
        return check.isAuthorized;
      }
    }
  );
}

export function subscribeUsers(
  callback: (users: UserProfile[]) => void,
  onError?: (err: any) => void
): () => void {
  const superAdminSession = typeof window !== 'undefined' ? sessionStorage.getItem('mediqueue_super_admin_session') : null;
  if (!auth.currentUser && !superAdminSession) {
    callback([]);
    if (onError) onError('Access restricted: Authentication required to view users collection.');
    return () => {};
  }
  return createManagedListener<UserProfile[]>(
    () => collection(db, 'users'),
    (snapshot) => {
      return snapshot.docs.map((d: any) => ({
        ...d.data(),
        uid: d.id
      })) as UserProfile[];
    },
    callback,
    onError,
    { 
      path: 'users', 
      authRequired: true,
      requiresAdmin: true,
      requiredRole: ['SUPER_ADMIN'],
      guard: async () => {
        const check = await verifyUserAuthorization({
          requiredRole: ['SUPER_ADMIN']
        });
        return check.isAuthorized;
      }
    }
  );
}

export async function updateClinicAdminProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  const authCheck = await verifyUserAuthorization({
    requiredRole: ['SUPER_ADMIN']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized: Only Super Administrators can modify admin profiles.');
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    ...data,
    updatedAt: now
  };
  
  if (data.clinicIds) {
    updatePayload.clinicIds = data.clinicIds;
    updatePayload.accessibleClinicIds = data.clinicIds;
    if (!data.clinicId && data.clinicIds.length > 0) {
      updatePayload.clinicId = data.clinicIds[0];
    }
  }

  try {
    await updateDoc(doc(db, 'users', uid), updatePayload);
    const targetClinicId = data.clinicIds && data.clinicIds.length > 0 ? data.clinicIds[0] : (data.clinicId || undefined);
    await logAuditEvent({
      action: 'ADMIN_UPDATED',
      clinicId: targetClinicId,
      details: { targetUid: uid, updatedFields: Object.keys(data) }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    throw err;
  }
}

export async function toggleClinicAdminStatus(
  uid: string,
  currentStatus: 'active' | 'inactive' | 'ACTIVE' | 'INACTIVE' | undefined
): Promise<void> {
  const authCheck = await verifyUserAuthorization({
    requiredRole: ['SUPER_ADMIN']
  });
  if (!authCheck.isAuthorized) {
    throw new Error(authCheck.reason || 'Unauthorized: Super Admin access required.');
  }

  const newStatus = (currentStatus === 'active' || currentStatus === 'ACTIVE') ? 'inactive' : 'active';
  try {
    await updateDoc(doc(db, 'users', uid), {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    await logAuditEvent({
      action: 'ADMIN_STATUS_TOGGLE',
      details: { targetUid: uid, newStatus }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    throw err;
  }
}

export async function sendClinicAdminPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
    await logAuditEvent({
      action: 'PASSWORD_RESET_TRIGGERED',
      details: { targetEmail: email }
    });
  } catch (err) {
    throw err;
  }
}

// -------------------------------------------------------------
// GENERATE TOKEN (TENANT-ISOLATED)
// -------------------------------------------------------------

export async function generateToken(params: {
  clinicId: string;
  patientName: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  reason?: string;
  doctorId: string;
  userId?: string;
}): Promise<QueueToken> {
  const { clinicId, patientName, age, gender, phone, reason, doctorId, userId } = params;
  if (!clinicId || !clinicId.trim()) {
    throw new Error('Clinic ID is required to generate a token.');
  }

  // 1. Fetch Doctor within Clinic
  const doctorSnap = await getDoc(doc(db, 'clinics', clinicId, 'doctors', doctorId));
  if (!doctorSnap.exists()) {
    throw new Error('Selected doctor not found in this clinic.');
  }
  const doctor = { ...doctorSnap.data(), id: doctorSnap.id } as Doctor;

  // 2. Fetch Clinic Info for Name and Branding
  const clinicSnap = await getDoc(doc(db, 'clinics', clinicId));
  const clinicData = clinicSnap.exists() ? (clinicSnap.data() as Clinic) : null;
  const clinicName = clinicData?.name || '';

  // 3. Create or sync patient record in clinic's patients subcollection
  let patientRecordId = '';
  try {
    const qPatients = query(
      collection(db, 'clinics', clinicId, 'patients'),
      where('phone', '==', phone)
    );
    const patientSnap = await getDocs(qPatients);

    if (!patientSnap.empty) {
      const pDoc = patientSnap.docs[0];
      patientRecordId = pDoc.id;
      const currentData = pDoc.data();
      await updateDoc(doc(db, 'clinics', clinicId, 'patients', pDoc.id), {
        lastVisit: getTodayDateString(),
        totalVisits: (currentData.totalVisits || 1) + 1,
        name: patientName,
        age: Number(age),
        gender
      });
    } else {
      const allPatientsSnap = await getDocs(collection(db, 'clinics', clinicId, 'patients'));
      const nextNumber = allPatientsSnap.size + 1001;
      const patientId = `PAT-${nextNumber}`;
      const newDoc = await addDoc(collection(db, 'clinics', clinicId, 'patients'), {
        clinicId,
        patientId,
        name: patientName,
        age: Number(age),
        gender,
        phone,
        reason: reason || 'General Consultation',
        createdAt: new Date().toISOString(),
        lastVisit: getTodayDateString(),
        totalVisits: 1
      });
      patientRecordId = newDoc.id;
    }
  } catch (err) {
    console.warn('Patient directory sync notice:', formatFirestoreError(err, 'Could not sync patient directory'));
    if (!patientRecordId) patientRecordId = `pat-${Date.now()}`;
  }

  // 4. Calculate daily doctor-specific sequential token number within clinic
  const todayStr = getTodayDateString();
  const q = query(
    collection(db, 'clinics', clinicId, 'tokens'),
    where('queueDate', '==', todayStr),
    where('doctorId', '==', doctorId)
  );
  const existingSnap = await getDocs(q);
  const nextCount = existingSnap.size + 1;
  const prefix = doctor.tokenPrefix || clinicData?.tokenPrefix || 'A';
  const tokenNumber = `${prefix}-${String(nextCount).padStart(3, '0')}`;

  const now = new Date().toISOString();
  const tokenData = {
    clinicId,
    clinicName,
    tokenNumber,
    patientId: patientRecordId,
    userId: userId || auth.currentUser?.uid || '',
    patientName,
    patientAge: Number(age),
    patientGender: gender,
    patientPhone: phone,
    reason: reason || 'General Consultation',
    doctorId: doctor.id,
    doctorName: doctor.name,
    roomNumber: doctor.roomNumber,
    status: 'WAITING' as TokenStatus,
    createdAt: now,
    calledAt: null,
    completedAt: null,
    queueDate: todayStr
  };

  // Write token to Firestore clinic subcollection
  const tokenRef = await addDoc(collection(db, 'clinics', clinicId, 'tokens'), tokenData);

  return {
    id: tokenRef.id,
    ...tokenData
  };
}

// -------------------------------------------------------------
// SUBSCRIBE USER TOKENS (ACROSS OR WITHIN CLINIC)
// -------------------------------------------------------------

export function subscribeUserTokens(
  userIdOrPhone: string,
  clinicIdOrCallback?: string | ((tokens: QueueToken[]) => void),
  maybeCallback?: ((tokens: QueueToken[]) => void) | FirestoreErrorCallback,
  maybeOnError?: FirestoreErrorCallback
) {
  let clinicId = '';
  let callback: (tokens: QueueToken[]) => void = () => {};
  let onError: FirestoreErrorCallback | undefined = undefined;

  if (typeof clinicIdOrCallback === 'function') {
    callback = clinicIdOrCallback;
    onError = maybeCallback as FirestoreErrorCallback | undefined;
  } else if (typeof clinicIdOrCallback === 'string') {
    clinicId = clinicIdOrCallback;
    callback = (maybeCallback as (tokens: QueueToken[]) => void) || (() => {});
    onError = maybeOnError;
  }

  if (!userIdOrPhone || !clinicId) {
    callback([]);
    return () => {};
  }

  return createManagedListener(
    () => collection(db, 'clinics', clinicId, 'tokens'),
    (snapshot) => {
      const all = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id, clinicId })) as QueueToken[];
      const userTokens = all.filter(
        t => (t.userId && t.userId === userIdOrPhone) || (t.patientPhone && t.patientPhone === userIdOrPhone)
      );
      userTokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return userTokens;
    },
    callback,
    onError,
    { path: `clinics/${clinicId}/tokens`, filter: `userId==${userIdOrPhone}`, clinicId }
  );
}

// -------------------------------------------------------------
// ATOMIC TRANSACTION: CALL NEXT TOKEN (TENANT ISOLATED)
// -------------------------------------------------------------

export async function callNextToken(
  clinicId: string,
  doctorId?: string
): Promise<QueueToken | null> {
  if (!clinicId) {
    throw new Error('Clinic ID is required.');
  }
  const todayStr = getTodayDateString();
  const targetDocIdFilter = (doctorId && doctorId !== 'ALL') ? doctorId : null;

  // Retry up to 3 times for race-condition resilience
  for (let attempt = 0; attempt < 3; attempt++) {
    const q = query(
      collection(db, 'clinics', clinicId, 'tokens'),
      where('queueDate', '==', todayStr),
      where('status', '==', 'WAITING')
    );
    const snap = await getDocs(q);

    let waitingDocs = snap.docs;
    if (targetDocIdFilter) {
      waitingDocs = waitingDocs.filter(d => d.data().doctorId === targetDocIdFilter);
    }

    if (waitingDocs.length === 0) {
      return null;
    }

    // Sort by createdAt ascending (earliest registered waiting patient first)
    waitingDocs.sort((a, b) => {
      const tA = new Date(a.data().createdAt || 0).getTime();
      const tB = new Date(b.data().createdAt || 0).getTime();
      return tA - tB;
    });

    const targetDoc = waitingDocs[0];
    const targetDocId = targetDoc.id;
    const targetDoctorId = targetDoc.data().doctorId;

    // Find active token(s) (CALLED or IN CONSULTATION) for this doctor to auto-complete
    const activeDocIdsToComplete: string[] = [];
    if (targetDoctorId) {
      const activeQ = query(
        collection(db, 'clinics', clinicId, 'tokens'),
        where('queueDate', '==', todayStr),
        where('doctorId', '==', targetDoctorId)
      );
      const activeSnap = await getDocs(activeQ);
      for (const d of activeSnap.docs) {
        if (d.id !== targetDocId && (d.data().status === 'CALLED' || d.data().status === 'IN CONSULTATION')) {
          activeDocIdsToComplete.push(d.id);
        }
      }
    }

    // Run atomic Firestore transaction within the clinic
    try {
      const updatedToken = await runTransaction(db, async (transaction) => {
        const tokenRef = doc(db, 'clinics', clinicId, 'tokens', targetDocId);
        const tokenSnap = await transaction.get(tokenRef);

        if (!tokenSnap.exists()) {
          throw new Error('TOKEN_EXPIRED_OR_DELETED');
        }

        const data = tokenSnap.data();
        if (data.status !== 'WAITING') {
          throw new Error('TOKEN_ALREADY_PROCESSED');
        }

        // Fetch active token snaps to perform reads before writes
        const activeSnapsToComplete = [];
        for (const activeId of activeDocIdsToComplete) {
          const activeRef = doc(db, 'clinics', clinicId, 'tokens', activeId);
          const activeSnap = await transaction.get(activeRef);
          if (activeSnap.exists()) {
            const activeStatus = activeSnap.data().status;
            if (activeStatus === 'CALLED' || activeStatus === 'IN CONSULTATION') {
              activeSnapsToComplete.push(activeRef);
            }
          }
        }

        const now = new Date().toISOString();

        // Auto-complete previous active tokens for this doctor
        for (const activeRef of activeSnapsToComplete) {
          transaction.update(activeRef, {
            status: 'COMPLETED',
            completedAt: now
          });
        }

        // Call the target token
        transaction.update(tokenRef, {
          status: 'CALLED',
          calledAt: now
        });

        return {
          ...data,
          id: tokenSnap.id,
          clinicId,
          status: 'CALLED',
          calledAt: now
        } as QueueToken;
      });

      return updatedToken;
    } catch (err: any) {
      if (err.message === 'TOKEN_EXPIRED_OR_DELETED' || err.message === 'TOKEN_ALREADY_PROCESSED') {
        console.warn(`Token candidate ${targetDocId} was modified by another session. Retrying next token...`);
        continue;
      }
      handleFirestoreError(err, OperationType.UPDATE, `clinics/${clinicId}/tokens/${targetDocId}`);
      throw new Error('Queue changed. Please refresh and try again.');
    }
  }

  throw new Error('Queue changed. Please refresh and try again.');
}

// -------------------------------------------------------------
// UPDATE TOKEN STATUS (TENANT ISOLATED)
// -------------------------------------------------------------

export async function updateTokenStatus(
  clinicId: string,
  tokenId: string, 
  status: TokenStatus
): Promise<boolean> {
  if (!clinicId || !tokenId) {
    throw new Error('Clinic ID and Token ID are required.');
  }

  const tokenRef = doc(db, 'clinics', clinicId, 'tokens', tokenId);

  try {
    const tokenSnap = await getDoc(tokenRef);
    if (!tokenSnap.exists()) {
      console.warn(`Token document ${tokenId} no longer exists.`);
      throw new Error('Queue changed. Please refresh and try again.');
    }

    const tokenData = tokenSnap.data();
    const now = new Date().toISOString();
    const updates: Record<string, any> = { status };

    if (status === 'CALLED') {
      updates.calledAt = now;

      // Auto-complete previous active patient for this doctor
      if (tokenData?.status === 'WAITING' && tokenData?.doctorId && tokenData?.queueDate) {
        const activeQ = query(
          collection(db, 'clinics', clinicId, 'tokens'),
          where('queueDate', '==', tokenData.queueDate),
          where('doctorId', '==', tokenData.doctorId)
        );
        const activeSnap = await getDocs(activeQ);
        for (const activeDoc of activeSnap.docs) {
          if (activeDoc.id !== tokenId && (activeDoc.data().status === 'CALLED' || activeDoc.data().status === 'IN CONSULTATION')) {
            await updateDoc(doc(db, 'clinics', clinicId, 'tokens', activeDoc.id), {
              status: 'COMPLETED',
              completedAt: now
            });
          }
        }
      }
    } else if (status === 'COMPLETED' || status === 'CANCELLED') {
      updates.completedAt = now;
    }

    await updateDoc(tokenRef, updates);
    return true;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.UPDATE, `clinics/${clinicId}/tokens/${tokenId}`);
    if (err.message === 'Queue changed. Please refresh and try again.') {
      throw err;
    }
    throw new Error('Queue changed. Please refresh and try again.');
  }
}

// -------------------------------------------------------------
// LOOKUP TOKEN BY NUMBER (TENANT ISOLATED)
// -------------------------------------------------------------

export async function lookupTokenByNumber(
  clinicId: string,
  inputTokenNumber: string
) {
  if (!clinicId || !clinicId.trim()) return null;
  const cleanInput = inputTokenNumber.trim().toUpperCase();
  const todayStr = getTodayDateString();

  const snap = await getDocs(collection(db, 'clinics', clinicId, 'tokens'));
  const allToday = snap.docs.map((d: any) => ({ ...d.data(), id: d.id, clinicId })) as QueueToken[];

  const token = allToday.find(t => t.tokenNumber.toUpperCase() === cleanInput && t.queueDate === todayStr);
  if (!token) return null;

  const doctorTokens = allToday.filter(t => t.doctorId === token.doctorId && t.queueDate === todayStr);
  const tokenCreatedAt = new Date(token.createdAt).getTime();

  const waitingAhead = doctorTokens.filter(t => {
    const isWaiting = t.status === 'WAITING';
    const isCreatedBefore = new Date(t.createdAt).getTime() < tokenCreatedAt;
    return isWaiting && isCreatedBefore;
  }).length;

  const currentServing = doctorTokens
    .filter(t => t.status === 'CALLED' || t.status === 'IN CONSULTATION')
    .sort((a, b) => new Date(b.calledAt || b.createdAt).getTime() - new Date(a.calledAt || a.createdAt).getTime())[0];

  return {
    id: token.id,
    clinicId,
    tokenNumber: token.tokenNumber,
    doctorName: token.doctorName,
    roomNumber: token.roomNumber,
    status: token.status,
    patientsAhead: waitingAhead,
    currentServingToken: currentServing ? currentServing.tokenNumber : 'None'
  };
}

// -------------------------------------------------------------
// SUBSCRIBE PUBLIC QUEUE (TENANT ISOLATED)
// -------------------------------------------------------------

export function subscribePublicQueue(
  clinicId: string,
  callback: (data: { nowServing: QueueToken[]; upNext: QueueToken[] }) => void,
  onError?: FirestoreErrorCallback
) {
  if (!clinicId || !clinicId.trim()) {
    callback({ nowServing: [], upNext: [] });
    return () => {};
  }
  const todayStr = getTodayDateString();
  return createManagedListener(
    () => query(collection(db, 'clinics', clinicId.trim(), 'tokens'), where('queueDate', '==', todayStr)),
    (snapshot) => {
      const todayTokens = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id, clinicId })) as QueueToken[];

      // 1. UP NEXT (WAITING): sorted by createdAt ascending
      const upNext = todayTokens
        .filter(t => t.status === 'WAITING' && t.tokenNumber.toUpperCase() !== 'A-024')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // 2. NOW SERVING: Show ONLY the currently active/called token (at most ONE per doctor)
      const activeTokens = todayTokens.filter(t => 
        (t.status === 'CALLED' || t.status === 'IN CONSULTATION') &&
        t.tokenNumber.toUpperCase() !== 'A-024'
      );

      const latestPerDoctor = new Map<string, QueueToken>();
      for (const token of activeTokens) {
        const docKey = token.doctorId || 'default';
        const existing = latestPerDoctor.get(docKey);
        if (!existing) {
          latestPerDoctor.set(docKey, token);
        } else {
          const existingTime = new Date(existing.calledAt || existing.createdAt).getTime();
          const tokenTime = new Date(token.calledAt || token.createdAt).getTime();
          if (tokenTime > existingTime) {
            latestPerDoctor.set(docKey, token);
          }
        }
      }

      const nowServing = Array.from(latestPerDoctor.values());

      return { nowServing, upNext };
    },
    callback,
    onError,
    { path: `clinics/${clinicId}/tokens`, filter: `queueDate==${todayStr}`, clinicId }
  );
}

// -------------------------------------------------------------
// DELETE TOKEN (TENANT ISOLATED)
// -------------------------------------------------------------

export async function deleteToken(
  clinicId: string,
  tokenId: string
): Promise<boolean> {
  if (!clinicId || !tokenId) throw new Error('Clinic ID and Token ID are required.');
  try {
    await deleteDoc(doc(db, 'clinics', clinicId, 'tokens', tokenId));
    return true;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `clinics/${clinicId}/tokens/${tokenId}`);
    throw new Error('Failed to delete token.');
  }
}

export async function removeTokenByNumberAndDoctor(
  clinicId: string,
  tokenNumber: string, 
  doctorQuery?: string
) {
  if (!clinicId) return;
  try {
    const q = query(collection(db, 'clinics', clinicId, 'tokens'));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      if (data.tokenNumber && data.tokenNumber.trim().toUpperCase() === tokenNumber.trim().toUpperCase()) {
        if (!doctorQuery || (data.doctorName && data.doctorName.toLowerCase().includes(doctorQuery.toLowerCase()))) {
          await deleteDoc(doc(db, 'clinics', clinicId, 'tokens', d.id));
        }
      }
    }
  } catch (err) {
    console.error('Error removing token permanently:', err);
  }
}

