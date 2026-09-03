import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  type Firestore, 
  type FirestoreSettings 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || '',
};

/**
 * Safe diagnostics for Firebase web client configuration.
 * Validates presence of critical identifiers without exposing secret credentials.
 */
export function getFirebaseConfigDiagnostics(): {
  isValid: boolean;
  missingKeys: string[];
  status: Record<string, 'present' | 'missing'>;
} {
  const keys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
  const status: Record<string, 'present' | 'missing'> = {};
  const missingKeys: string[] = [];

  for (const k of keys) {
    const val = firebaseConfig[k];
    if (val && typeof val === 'string' && val.trim().length > 0) {
      status[k] = 'present';
    } else {
      status[k] = 'missing';
      missingKeys.push(k);
    }
  }

  return {
    isValid: missingKeys.length === 0,
    missingKeys,
    status,
  };
}

// Perform safe diagnostic log in non-production or on startup
const diagnostics = getFirebaseConfigDiagnostics();
if (!diagnostics.isValid) {
  console.warn(
    `[Firebase Config Warning] Missing configuration keys: ${diagnostics.missingKeys.join(', ')}. ` +
    `Please configure VITE_FIREBASE_* environment variables.`
  );
} else if (import.meta.env.DEV) {
  console.info('[Firebase Config] Configuration validated:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    apiKey: diagnostics.status.apiKey,
    appId: diagnostics.status.appId,
  });
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * Root-Cause Transport Configuration:
 * 
 * In production web deployments (such as Vercel, Cloud Run, and restrictive proxy/firewall networks),
 * WebChannel HTTP streaming connections can be dropped or buffered by intermediate proxies,
 * emitting:
 *   "Firestore (12.17.0): WebChannelConnection RPC 'Listen' stream transport errored."
 * 
 * Configuring `experimentalAutoDetectLongPolling: true` enables the Firestore WebChannel transport
 * to dynamically detect stream disruptions and fall back smoothly to long-polling mode,
 * maintaining seamless real-time snapshot synchronization without tearing down the client.
 */
function initializeCentralizedFirestore(): Firestore {
  const settings: FirestoreSettings = {
    experimentalAutoDetectLongPolling: true,
  };

  const targetDbId = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
    ? firebaseConfigJson.firestoreDatabaseId
    : undefined;

  try {
    if (targetDbId) {
      return initializeFirestore(app, settings, targetDbId);
    }
    return initializeFirestore(app, settings);
  } catch (err: any) {
    // If Firestore has already been initialized (e.g., in unit test runners or Vite HMR reloads),
    // getFirestore returns the active singleton instance.
    if (targetDbId) {
      return getFirestore(app, targetDbId);
    }
    return getFirestore(app);
  }
}

export const db: Firestore = initializeCentralizedFirestore();

export const auth = getAuth(app);

export const storage = getStorage(app);

export { firebaseConfig, app };

// Helper to create a secondary auth instance for Super Admin to provision users
export function getSecondaryAuth() {
  const secondaryAppName = 'SuperAdminUserCreationApp';
  const existingApp = getApps().find(a => a.name === secondaryAppName);
  const secondaryApp = existingApp || initializeApp(firebaseConfig, secondaryAppName);
  return getAuth(secondaryApp);
}


