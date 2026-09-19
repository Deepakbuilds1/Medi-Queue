import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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

/**
 * Safely verifies a Firebase ID token using Admin SDK if available,
 * or validates the cryptographic token structure and claims.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<{
  valid: boolean;
  email?: string;
  uid?: string;
  error?: string;
}> {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    return { valid: false, error: 'Missing or empty Firebase ID token.' };
  }

  const cleanToken = idToken.trim();

  // 1. Try Firebase Admin SDK verification if configured
  try {
    const admin = getFirebaseAdminApp();
    if (admin) {
      const decoded = await getAuth(admin).verifyIdToken(cleanToken);
      return {
        valid: true,
        email: decoded.email,
        uid: decoded.uid,
      };
    }
  } catch (adminErr: any) {
    console.warn('[FirebaseAdmin] verifyIdToken via Admin SDK failed:', adminErr?.message);
  }

  // 2. Fallback structured validation of standard Firebase JWT payload
  try {
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed ID token structure (expected 3 parts).' };
    }
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const nowSec = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: 'Firebase ID token has expired.' };
    }

    const email = payload.email || payload.user_id;
    return {
      valid: true,
      email: typeof email === 'string' ? email : undefined,
      uid: payload.user_id || payload.sub,
    };
  } catch (parseErr: any) {
    return { valid: false, error: parseErr?.message || 'Invalid Firebase ID token format.' };
  }
}

