export const SUPER_ADMIN_SESSION_KEY = 'mediqueue_super_admin_session';

/**
 * Retrieves the stored Super Admin session token from browser sessionStorage.
 */
export function getStoredSuperAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores the verified Super Admin session token in browser sessionStorage.
 */
export function setStoredSuperAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, token);
  } catch {
    // ignore storage quota error
  }
}

/**
 * Clears the Super Admin session token from browser sessionStorage.
 */
export function clearStoredSuperAdminToken(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
  } catch {
    // ignore
  }
}
