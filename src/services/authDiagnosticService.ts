import { auth, db, firebaseConfig } from '../lib/firebase';

export interface DiagnosticsReport {
  environment: string;
  firebaseInitialized: boolean;
  projectConfigured: boolean;
  authServiceAvailable: boolean;
  firestoreAvailable: boolean;
  apiEndpointStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
  missingConfigKeys: string[];
}

/**
 * Runs safe diagnostics on client startup and logs status without exposing secrets.
 */
export async function runAuthDiagnostics(): Promise<DiagnosticsReport> {
  const isProd = import.meta.env.PROD || process.env.NODE_ENV === 'production';
  const environment = isProd ? 'production' : 'development';

  const missingKeys: string[] = [];
  if (!firebaseConfig.projectId) missingKeys.push('projectId');
  if (!firebaseConfig.apiKey) missingKeys.push('apiKey');
  if (!firebaseConfig.authDomain) missingKeys.push('authDomain');
  if (!firebaseConfig.appId) missingKeys.push('appId');

  const firebaseInitialized = Boolean(auth && db);
  const projectConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.authDomain);
  const authServiceAvailable = Boolean(auth);
  const firestoreAvailable = Boolean(db);

  let apiEndpointStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN' = 'UNKNOWN';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // Primary check: /api/health
    const res = await fetch('/api/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.status === 'ok') {
        apiEndpointStatus = 'AVAILABLE';
      } else {
        apiEndpointStatus = 'AVAILABLE';
      }
    } else if (res.status === 401 || res.status === 200) {
      // Endpoint is reachable and active
      apiEndpointStatus = 'AVAILABLE';
    } else {
      // Secondary check: /api/super-admin/session
      try {
        const sessionRes = await fetch('/api/super-admin/session', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        // 200 (authenticated or unauthenticated object) or 401 (not logged in) both prove server availability
        if (sessionRes.status === 200 || sessionRes.status === 401) {
          apiEndpointStatus = 'AVAILABLE';
        } else {
          apiEndpointStatus = 'UNAVAILABLE';
        }
      } catch {
        apiEndpointStatus = 'UNAVAILABLE';
      }
    }
  } catch {
    // Fallback probe
    try {
      const sessionRes = await fetch('/api/super-admin/session', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (sessionRes.status === 200 || sessionRes.status === 401) {
        apiEndpointStatus = 'AVAILABLE';
      } else {
        apiEndpointStatus = 'UNAVAILABLE';
      }
    } catch {
      apiEndpointStatus = 'UNAVAILABLE';
    }
  }

  // Safe developer logging
  console.info(`[SuperAdminAuth] Environment: ${environment}`);
  console.info(`[SuperAdminAuth] Firebase initialized: ${firebaseInitialized ? 'YES' : 'NO'}`);
  console.info(`[SuperAdminAuth] Project configured: ${projectConfigured ? 'YES' : 'NO'}`);
  console.info(`[SuperAdminAuth] Authentication endpoint: ${apiEndpointStatus}`);

  if (missingKeys.length > 0) {
    console.warn(`[SuperAdminAuth] Notice - missing config variables: ${missingKeys.join(', ')}`);
  }

  return {
    environment,
    firebaseInitialized,
    projectConfigured,
    authServiceAvailable,
    firestoreAvailable,
    apiEndpointStatus,
    missingConfigKeys: missingKeys,
  };
}
