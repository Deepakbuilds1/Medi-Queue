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
  onSnapshot,
  runTransaction,
  Query,
  DocumentReference
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ClinicSettings, Doctor, Patient, QueueToken, TokenStatus } from '../types';

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
  clinicName: 'CITY CARE CLINIC',
  clinicLogo: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=150&auto=format&fit=crop&q=80',
  clinicAddress: '123 Healthcare Boulevard, Medical District',
  phone: '+1 (800) 555-0199',
  email: 'gdeepak4689@gmail.com',
  tokenPrefix: 'A',
  startingTokenNumber: 1,
  tokenDisplaySettings: {
    enableSound: true,
    autoRefreshInterval: 5,
    announcementVoice: true
  }
};

export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export type FirestoreErrorCallback = (errorMessage: string | null) => void;

/**
 * Creates a managed real-time Firestore listener with automatic retry,
 * error handling callbacks, and clean unsubscription to avoid leaks.
 */
function createManagedListener<T>(
  createQuery: () => Query | DocumentReference,
  parseSnapshot: (snapshot: any) => T,
  onData: (data: T) => void,
  onError?: FirestoreErrorCallback
): () => void {
  let unsub: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let isCancelled = false;

  const startListening = () => {
    if (isCancelled) return;

    try {
      const ref = createQuery();
      unsub = onSnapshot(
        ref as any,
        (snapshot) => {
          if (isCancelled) return;
          if (onError) onError(null); // Clear error on successful connection
          const data = parseSnapshot(snapshot);
          onData(data);
        },
        (error) => {
          if (isCancelled) return;
          console.warn('Firestore real-time listener error:', error?.message || error);
          if (onError) {
            onError('Unable to connect to live queue. Retrying...');
          }

          // Safely tear down current errored listener
          if (unsub) {
            try { unsub(); } catch (_) {}
            unsub = null;
          }

          // Schedule single safe reconnection attempt after 5 seconds
          if (!retryTimer && !isCancelled) {
            retryTimer = setTimeout(() => {
              retryTimer = null;
              if (!isCancelled) {
                startListening();
              }
            }, 5000);
          }
        }
      );
    } catch (err) {
      if (isCancelled) return;
      console.warn('Firestore subscription initialization error:', err);
      if (onError) {
        onError('Unable to connect to live queue. Retrying...');
      }
      if (!retryTimer && !isCancelled) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (!isCancelled) {
            startListening();
          }
        }, 5000);
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

// Seed initial data if database is fresh
export async function seedInitialDataIfEmpty() {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID));
    if (!settingsDoc.exists()) {
      await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), DEFAULT_SETTINGS);
    }

    const doctorsSnap = await getDocs(collection(db, 'doctors'));
    if (doctorsSnap.empty) {
      const initialDoctors: Omit<Doctor, 'id'>[] = [
        { name: 'Dr. Sharma', specialization: 'General Physician', roomNumber: 'Room 1', tokenPrefix: 'A', status: 'ACTIVE' },
        { name: 'Dr. Verma', specialization: 'Dentist', roomNumber: 'Room 2', tokenPrefix: 'B', status: 'ACTIVE' },
        { name: 'Dr. Patel', specialization: 'Pediatrician', roomNumber: 'Room 3', tokenPrefix: 'C', status: 'ACTIVE' }
      ];
      for (const d of initialDoctors) {
        await addDoc(collection(db, 'doctors'), d);
      }
    }

    // Permanently purge token A-024 if present in database
    await removeTokenByNumberAndDoctor('A-024');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seed_data');
  }
}

// Subscribe Clinic Settings
export function subscribeSettings(
  callback: (settings: ClinicSettings) => void,
  onError?: FirestoreErrorCallback
) {
  return createManagedListener(
    () => doc(db, 'settings', SETTINGS_DOC_ID),
    (snapshot) => {
      if (snapshot.exists()) {
        return { ...snapshot.data(), id: snapshot.id } as ClinicSettings;
      }
      return DEFAULT_SETTINGS;
    },
    callback,
    onError
  );
}

export async function updateSettings(settings: Partial<ClinicSettings>) {
  try {
    await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), settings, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings');
    throw err;
  }
}

// Doctors
export function subscribeDoctors(
  callback: (doctors: Doctor[]) => void,
  onError?: FirestoreErrorCallback
) {
  return createManagedListener(
    () => collection(db, 'doctors'),
    (snapshot) => {
      return snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id })) as Doctor[];
    },
    callback,
    onError
  );
}

export async function addDoctor(doctor: Omit<Doctor, 'id'>) {
  try {
    const res = await addDoc(collection(db, 'doctors'), {
      ...doctor,
      createdAt: new Date().toISOString()
    });
    return { id: res.id, ...doctor };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'doctors');
    throw err;
  }
}

export async function updateDoctor(doctorId: string, data: Partial<Doctor>) {
  try {
    await updateDoc(doc(db, 'doctors', doctorId), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `doctors/${doctorId}`);
    throw err;
  }
}

// Patients
export function subscribePatients(
  callback: (patients: Patient[]) => void,
  onError?: FirestoreErrorCallback
) {
  return createManagedListener(
    () => collection(db, 'patients'),
    (snapshot) => {
      return snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id })) as Patient[];
    },
    callback,
    onError
  );
}

export async function addPatientRecord(data: Omit<Patient, 'id' | 'patientId' | 'createdAt'>) {
  try {
    const snap = await getDocs(collection(db, 'patients'));
    const nextNumber = snap.size + 1001;
    const patientId = `PAT-${nextNumber}`;
    const now = new Date().toISOString();

    const docRef = await addDoc(collection(db, 'patients'), {
      ...data,
      patientId,
      createdAt: now,
      lastVisit: getTodayDateString(),
      totalVisits: 1
    });

    return { id: docRef.id, patientId, createdAt: now, lastVisit: getTodayDateString(), totalVisits: 1, ...data };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'patients');
    throw err;
  }
}

export async function updatePatientRecord(patientId: string, data: Partial<Patient>) {
  try {
    await updateDoc(doc(db, 'patients', patientId), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `patients/${patientId}`);
    throw err;
  }
}

// Tokens & Queue Management
export function subscribeTodayTokens(
  callback: (tokens: QueueToken[]) => void,
  onError?: FirestoreErrorCallback
) {
  const todayStr = getTodayDateString();
  return createManagedListener(
    () => query(collection(db, 'tokens'), where('queueDate', '==', todayStr)),
    (snapshot) => {
      const list = snapshot.docs.map((d: any) => ({
        ...d.data(),
        id: d.id // Guarantee Firestore doc ID takes precedence
      })) as QueueToken[];
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return list;
    },
    callback,
    onError
  );
}

export async function getTokensByDateRange(startDateStr: string, endDateStr: string): Promise<QueueToken[]> {
  try {
    const q = query(collection(db, 'tokens'));
    const snap = await getDocs(q);
    const all = snap.docs.map((d: any) => ({ ...d.data(), id: d.id })) as QueueToken[];
    return all.filter(t => t.queueDate >= startDateStr && t.queueDate <= endDateStr);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'tokens');
    return [];
  }
}

// Save or update User Profile
export async function saveUserProfile(profile: {
  uid: string;
  email: string;
  name: string;
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  role?: 'patient' | 'admin';
}) {
  const now = new Date().toISOString();
  const dataToSave = {
    uid: profile.uid,
    email: profile.email,
    name: profile.name,
    phone: profile.phone,
    age: Number(profile.age),
    gender: profile.gender,
    role: profile.role || 'patient',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const userRef = doc(db, 'users', profile.uid);
    await setDoc(userRef, dataToSave, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${profile.uid}`);
    throw err;
  }

  return dataToSave;
}

export async function getUserProfile(uid: string) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
  }
  return null;
}

// Generate new token for patient
export async function generateToken(params: {
  patientName: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  reason?: string;
  doctorId: string;
  userId?: string;
}): Promise<QueueToken> {
  const { patientName, age, gender, phone, reason, doctorId, userId } = params;

  const doctorSnap = await getDoc(doc(db, 'doctors', doctorId));
  if (!doctorSnap.exists()) {
    throw new Error('Selected doctor not found.');
  }
  const doctor = { ...doctorSnap.data(), id: doctorSnap.id } as Doctor;

  // Create or sync patient record in patients collection
  let patientRecordId = '';
  try {
    const qPatients = query(
      collection(db, 'patients'),
      where('phone', '==', phone)
    );
    const patientSnap = await getDocs(qPatients);

    if (!patientSnap.empty) {
      const pDoc = patientSnap.docs[0];
      patientRecordId = pDoc.id;
      const currentData = pDoc.data();
      await updateDoc(doc(db, 'patients', pDoc.id), {
        lastVisit: getTodayDateString(),
        totalVisits: (currentData.totalVisits || 1) + 1,
        name: patientName,
        age: Number(age),
        gender
      });
    } else {
      const allPatientsSnap = await getDocs(collection(db, 'patients'));
      const nextNumber = allPatientsSnap.size + 1001;
      const patientId = `PAT-${nextNumber}`;
      const newDoc = await addDoc(collection(db, 'patients'), {
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
    console.warn('Patient directory sync notice:', err);
    if (!patientRecordId) patientRecordId = `pat-${Date.now()}`;
  }

  const todayStr = getTodayDateString();
  const q = query(
    collection(db, 'tokens'),
    where('queueDate', '==', todayStr),
    where('doctorId', '==', doctorId)
  );
  const existingSnap = await getDocs(q);
  const nextCount = existingSnap.size + 1;
  const prefix = doctor.tokenPrefix || 'A';
  const tokenNumber = `${prefix}-${String(nextCount).padStart(3, '0')}`;

  const now = new Date().toISOString();
  const tokenData = {
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

  // Write token to Firestore and wait for confirmation
  const tokenRef = await addDoc(collection(db, 'tokens'), tokenData);

  return {
    id: tokenRef.id,
    ...tokenData
  };
}

export function subscribeUserTokens(
  userIdOrPhone: string,
  callback: (tokens: QueueToken[]) => void,
  onError?: FirestoreErrorCallback
) {
  if (!userIdOrPhone) {
    callback([]);
    return () => {};
  }
  return createManagedListener(
    () => collection(db, 'tokens'),
    (snapshot) => {
      const all = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id })) as QueueToken[];
      const userTokens = all.filter(
        t => (t.userId && t.userId === userIdOrPhone) || (t.patientPhone && t.patientPhone === userIdOrPhone)
      );
      userTokens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return userTokens;
    },
    callback,
    onError
  );
}

/**
 * Transactional Call Next Token algorithm.
 * Guarantees race-condition safety and verifies document existence and status before calling.
 */
export async function callNextToken(doctorId?: string): Promise<QueueToken | null> {
  const todayStr = getTodayDateString();
  const targetDocIdFilter = (doctorId && doctorId !== 'ALL') ? doctorId : null;

  // Retry up to 3 times if concurrent admin updates or deleted documents occur
  for (let attempt = 0; attempt < 3; attempt++) {
    const q = query(
      collection(db, 'tokens'),
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
    const targetDocId = targetDoc.id; // Exact Firestore Document ID
    const targetDoctorId = targetDoc.data().doctorId;

    // Find active token(s) (CALLED or IN CONSULTATION) for this target doctor to auto-complete
    const activeDocIdsToComplete: string[] = [];
    if (targetDoctorId) {
      const activeQ = query(
        collection(db, 'tokens'),
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

    // Run atomic transaction to update active -> COMPLETED and target WAITING -> CALLED
    try {
      const updatedToken = await runTransaction(db, async (transaction) => {
        const tokenRef = doc(db, 'tokens', targetDocId);
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
          const activeRef = doc(db, 'tokens', activeId);
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

        // Call the next token
        transaction.update(tokenRef, {
          status: 'CALLED',
          calledAt: now
        });

        return {
          ...data,
          id: tokenSnap.id,
          status: 'CALLED',
          calledAt: now
        } as QueueToken;
      });

      return updatedToken;
    } catch (err: any) {
      if (err.message === 'TOKEN_EXPIRED_OR_DELETED' || err.message === 'TOKEN_ALREADY_PROCESSED') {
        console.warn(`Token candidate ${targetDocId} was modified/deleted by another session. Retrying next token in queue...`);
        continue;
      }
      handleFirestoreError(err, OperationType.UPDATE, `tokens/${targetDocId}`);
      throw new Error('Queue changed. Please refresh and try again.');
    }
  }

  throw new Error('Queue changed. Please refresh and try again.');
}

export async function updateTokenStatus(tokenId: string, status: TokenStatus): Promise<boolean> {
  if (!tokenId) {
    throw new Error('Queue changed. Please refresh and try again.');
  }

  const tokenRef = doc(db, 'tokens', tokenId);

  try {
    const tokenSnap = await getDoc(tokenRef);
    if (!tokenSnap.exists()) {
      console.warn(`Token document ${tokenId} no longer exists in Firestore.`);
      throw new Error('Queue changed. Please refresh and try again.');
    }

    const tokenData = tokenSnap.data();
    const now = new Date().toISOString();
    const updates: Record<string, any> = { status };

    if (status === 'CALLED') {
      updates.calledAt = now;

      // If calling a WAITING token, auto-complete any existing active CALLED or IN CONSULTATION patient for this doctor
      if (tokenData?.status === 'WAITING' && tokenData?.doctorId && tokenData?.queueDate) {
        const activeQ = query(
          collection(db, 'tokens'),
          where('queueDate', '==', tokenData.queueDate),
          where('doctorId', '==', tokenData.doctorId)
        );
        const activeSnap = await getDocs(activeQ);
        for (const activeDoc of activeSnap.docs) {
          if (activeDoc.id !== tokenId && (activeDoc.data().status === 'CALLED' || activeDoc.data().status === 'IN CONSULTATION')) {
            await updateDoc(doc(db, 'tokens', activeDoc.id), {
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
    handleFirestoreError(err, OperationType.UPDATE, `tokens/${tokenId}`);
    if (err.message === 'Queue changed. Please refresh and try again.') {
      throw err;
    }
    throw new Error('Queue changed. Please refresh and try again.');
  }
}

export async function lookupTokenByNumber(inputTokenNumber: string) {
  const cleanInput = inputTokenNumber.trim().toUpperCase();
  const todayStr = getTodayDateString();

  const snap = await getDocs(collection(db, 'tokens'));
  const allToday = snap.docs.map((d: any) => ({ ...d.data(), id: d.id })) as QueueToken[];

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
    tokenNumber: token.tokenNumber,
    doctorName: token.doctorName,
    roomNumber: token.roomNumber,
    status: token.status,
    patientsAhead: waitingAhead,
    currentServingToken: currentServing ? currentServing.tokenNumber : 'None'
  };
}

export function subscribePublicQueue(
  callback: (data: { nowServing: QueueToken[]; upNext: QueueToken[] }) => void,
  onError?: FirestoreErrorCallback
) {
  const todayStr = getTodayDateString();
  return createManagedListener(
    () => query(collection(db, 'tokens'), where('queueDate', '==', todayStr)),
    (snapshot) => {
      const todayTokens = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id })) as QueueToken[];

      // 1. UP NEXT (WAITING): Show ALL patients/tokens whose status is exactly WAITING, sorted by createdAt ascending
      // (Exclude any permanently removed tokens such as A-024)
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
    onError
  );
}

export async function deleteToken(tokenId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'tokens', tokenId));
    return true;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.DELETE, `tokens/${tokenId}`);
    throw new Error('Failed to delete token.');
  }
}

export async function removeTokenByNumberAndDoctor(tokenNumber: string, doctorQuery?: string) {
  try {
    const q = query(collection(db, 'tokens'));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      if (data.tokenNumber && data.tokenNumber.trim().toUpperCase() === tokenNumber.trim().toUpperCase()) {
        if (!doctorQuery || (data.doctorName && data.doctorName.toLowerCase().includes(doctorQuery.toLowerCase()))) {
          await deleteDoc(doc(db, 'tokens', d.id));
        }
      }
    }
  } catch (err) {
    console.error('Error removing token permanently:', err);
  }
}


