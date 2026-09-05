import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';

export interface FirebaseAdminStatus {
  isConfigured: boolean;
  isInitialized: boolean;
  projectId?: string;
  error?: string;
}

let cachedStatus: FirebaseAdminStatus | null = null;
let adminApp: App | null = null;

/**
 * Initializes Firebase Admin safely using singleton pattern.
 * Never throws uncaught exceptions.
 * Supports:
 * - FIREBASE_SERVICE_ACCOUNT (JSON string)
 * - FIREBASE_ADMIN_CREDENTIALS (JSON string)
 * - Individual FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY / FIREBASE_PROJECT_ID
 * - Application Default Credentials
 */
export function initFirebaseAdmin(): FirebaseAdminStatus {
  const existingApps = getApps();
  if (cachedStatus && cachedStatus.isInitialized && existingApps.length > 0) {
    return cachedStatus;
  }

  try {
    // 1. Singleton pattern: check if already initialized
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      cachedStatus = {
        isConfigured: true,
        isInitialized: true,
        projectId: adminApp.options.projectId,
      };
      return cachedStatus;
    }

    // 2. Check for service account JSON in environment variables
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_CREDENTIALS;
    if (serviceAccountJson && typeof serviceAccountJson === 'string' && serviceAccountJson.trim()) {
      let parsed: any;
      try {
        parsed = JSON.parse(serviceAccountJson.trim());
      } catch (err: any) {
        cachedStatus = {
          isConfigured: false,
          isInitialized: false,
          error: `Failed to parse FIREBASE_SERVICE_ACCOUNT: ${err?.message}`,
        };
        return cachedStatus;
      }

      if (parsed.private_key && typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }

      adminApp = initializeApp({
        credential: cert(parsed),
        projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      });

      cachedStatus = {
        isConfigured: true,
        isInitialized: true,
        projectId: parsed.project_id,
      };
      return cachedStatus;
    }

    // 3. Check for individual credentials
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      'medi-queue-4be67';

    if (clientEmail && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      adminApp = initializeApp({
        credential: cert({
          clientEmail: clientEmail.trim(),
          privateKey,
          projectId,
        }),
        projectId,
      });

      cachedStatus = {
        isConfigured: true,
        isInitialized: true,
        projectId,
      };
      return cachedStatus;
    }

    // 4. Check for Google Cloud environment (e.g. Cloud Run, GCP with default credentials)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
      adminApp = initializeApp({
        projectId,
      });

      cachedStatus = {
        isConfigured: true,
        isInitialized: true,
        projectId,
      };
      return cachedStatus;
    }

    // 5. If no explicit admin service account was configured, gracefully report it
    cachedStatus = {
      isConfigured: false,
      isInitialized: false,
      projectId,
      error: 'Firebase Admin credentials not provided in environment (HMAC session provider active).',
    };
    return cachedStatus;
  } catch (err: any) {
    cachedStatus = {
      isConfigured: false,
      isInitialized: false,
      error: err?.message || 'Failed to initialize Firebase Admin.',
    };
    return cachedStatus;
  }
}

export function getFirebaseAdminApp(): App | null {
  initFirebaseAdmin();
  return adminApp || (getApps().length > 0 ? getApps()[0] : null);
}
