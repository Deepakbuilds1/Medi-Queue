/**
 * Comprehensive, safe error normalization and formatting utilities.
 * Ensures no raw JavaScript/Firebase error objects ({code, message}) reach React JSX as children.
 * Preserves Firebase error codes internally for diagnostics while delivering clean, user-friendly UI strings.
 */

export type AuthErrorCategory = 
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_NOT_AUTHORIZED'
  | 'AUTHENTICATION_SERVICE_UNAVAILABLE'
  | 'SERVER_CONFIGURATION_ERROR'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export interface AppErrorState {
  code?: string;
  message: string;
  category?: AuthErrorCategory;
  isNetworkError?: boolean;
  isCredentialError?: boolean;
  isConfigurationError?: boolean;
  isAuthorizationError?: boolean;
}

/**
 * Safely extracts a clean, human-readable error message string from any caught value.
 * Handles Error instances, Firebase error objects ({code, message}), string literals,
 * and custom object payloads.
 */
export function getErrorMessage(
  error: unknown, 
  fallbackMessage = 'Authentication service encountered an issue. Please try again.'
): string {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (!trimmed) return fallbackMessage;
    // Strip raw Firebase error prefix if present in string
    if (trimmed.includes('Firebase: Error (')) {
      const match = trimmed.match(/auth\/[a-z0-9-]+/i);
      if (match) {
        return getHumanReadableAuthMessage(match[0], fallbackMessage);
      }
    }
    return trimmed;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { 
      message?: unknown; 
      code?: unknown; 
      userMessage?: unknown;
      error?: unknown;
      statusText?: unknown;
    };

    // If userMessage or user-friendly string exists
    if (typeof candidate.userMessage === 'string' && candidate.userMessage.trim()) {
      return candidate.userMessage.trim();
    }

    // If error.error is a string (e.g. from server JSON response)
    if (typeof candidate.error === 'string' && candidate.error.trim()) {
      return candidate.error.trim();
    }

    // If candidate has code and standard Firebase format
    if (typeof candidate.code === 'string') {
      const code = candidate.code;
      // Only use mapped message if this is a recognized code
      const mapped = getMappedCodeMessage(code);
      if (mapped) {
        return mapped;
      }
    }

    // If candidate has message
    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      const rawMsg = candidate.message.trim();
      if (rawMsg.includes('Firebase: Error (')) {
        const match = rawMsg.match(/auth\/[a-z0-9-]+/i);
        if (match) {
          return getHumanReadableAuthMessage(match[0], fallbackMessage);
        }
      }
      return rawMsg;
    }

    if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
  }

  return fallbackMessage;
}

/**
 * Safely extracts the error code from any error object, if available.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  if (typeof error === 'string' && error.includes('auth/')) {
    const match = error.match(/auth\/[a-z0-9-]+/i);
    return match ? match[0] : undefined;
  }
  if (typeof error === 'string' && (error.includes('permission-denied') || error.includes('unavailable'))) {
    const match = error.match(/(firestore\/)?(permission-denied|unavailable)/i);
    return match ? match[0] : undefined;
  }
  return undefined;
}

/**
 * Maps known specific Firebase / Firestore error codes to explicit, targeted messages.
 * Returns null if the code is not explicitly recognized (prevents masking).
 */
export function getMappedCodeMessage(code: string): string | null {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';

    case 'auth/user-disabled':
      return 'This account has been disabled.';

    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please try again later.';

    case 'auth/network-request-failed':
      return 'Unable to connect to the authentication service. Please check your internet connection.';

    case 'auth/operation-not-allowed':
      return 'Email/password authentication is not enabled in the Firebase Console.';

    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Firebase configuration error: Invalid or missing API key.';

    case 'auth/app-not-authorized':
      return 'Firebase configuration error: This domain is not authorized in Firebase Console.';

    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/weak-password':
      return 'Password must be at least 6 characters in length.';

    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';

    case 'auth/requires-recent-login':
      return 'This operation requires recent authentication. Please sign in again.';

    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Authentication was cancelled.';

    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'Your account is not authorized to access this clinic.';

    case 'unavailable':
    case 'firestore/unavailable':
      return 'The database service is temporarily unavailable. Please try again shortly.';

    default:
      return null;
  }
}

/**
 * Returns a human readable auth message, honoring specific mapped codes without generic credential masking.
 */
export function getHumanReadableAuthMessage(
  code: string, 
  defaultFallback = 'Authentication failed. Please check your inputs and try again.'
): string {
  const mapped = getMappedCodeMessage(code);
  if (mapped) return mapped;
  return defaultFallback;
}

/**
 * Classifies an error into a high-level category to prevent masking server/auth issues.
 */
export function getAuthErrorCategory(code?: string, rawMessage?: string): AuthErrorCategory {
  if (!code && !rawMessage) return 'UNKNOWN';

  const c = (code || '').toLowerCase();
  const m = (rawMessage || '').toLowerCase();

  if (
    c.includes('invalid-credential') || 
    c.includes('wrong-password') || 
    c.includes('user-not-found')
  ) {
    return 'INVALID_CREDENTIALS';
  }

  if (c.includes('user-disabled') || m.includes('disabled') || m.includes('inactive')) {
    return 'ACCOUNT_DISABLED';
  }

  if (
    c.includes('permission-denied') || 
    m.includes('not authorized') || 
    m.includes('unauthorized') ||
    m.includes('patient') ||
    m.includes('access denied')
  ) {
    return 'ACCOUNT_NOT_AUTHORIZED';
  }

  if (
    c.includes('network-request-failed') || 
    c.includes('unavailable') || 
    m.includes('network') ||
    m.includes('timeout')
  ) {
    return 'AUTHENTICATION_SERVICE_UNAVAILABLE';
  }

  if (
    c.includes('invalid-api-key') || 
    c.includes('operation-not-allowed') || 
    c.includes('app-not-authorized') ||
    m.includes('configuration') ||
    m.includes('environment variable')
  ) {
    return 'SERVER_CONFIGURATION_ERROR';
  }

  if (c.includes('too-many-requests') || m.includes('too many') || m.includes('lockout')) {
    return 'RATE_LIMITED';
  }

  if (c.includes('invalid-email') || c.includes('weak-password') || m.includes('required')) {
    return 'VALIDATION_ERROR';
  }

  return 'UNKNOWN';
}

/**
 * Creates a normalized error representation preserving both the debugging code and safe UI string.
 */
export function normalizeFirebaseError(
  error: unknown, 
  defaultFallback = 'An unexpected authentication error occurred.'
): AppErrorState {
  const code = getErrorCode(error);
  const message = getErrorMessage(error, defaultFallback);
  const category = getAuthErrorCategory(code, message);

  const isNetwork = category === 'AUTHENTICATION_SERVICE_UNAVAILABLE';
  const isCredential = category === 'INVALID_CREDENTIALS';
  const isConfig = category === 'SERVER_CONFIGURATION_ERROR';
  const isAuth = category === 'ACCOUNT_NOT_AUTHORIZED';

  return {
    code,
    message,
    category,
    isNetworkError: isNetwork,
    isCredentialError: isCredential,
    isConfigurationError: isConfig,
    isAuthorizationError: isAuth,
  };
}

/**
 * Safely converts any value (including unexpected objects or undefined) to a safe string for JSX rendering.
 * Guarantees that `{safeRender(x)}` will NEVER crash React with Minified React Error #31.
 */
export function safeRender(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return getErrorMessage(value, fallback);
  }
  return String(value);
}

/**
 * Safely extracts a readable, informative error message from Firestore errors.
 */
export function formatFirestoreError(
  error: unknown, 
  fallbackMessage = 'An unexpected Firestore error occurred'
): string {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as { message?: unknown; code?: unknown };
    if (typeof errObj.message === 'string' && errObj.message.trim()) {
      return errObj.message.trim();
    }
    if (typeof errObj.code === 'string' && errObj.code.trim()) {
      return getHumanReadableAuthMessage(errObj.code, `Error code: ${errObj.code}`);
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}
