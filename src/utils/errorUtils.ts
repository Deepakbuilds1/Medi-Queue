/**
 * Comprehensive, safe error normalization and formatting utilities.
 * Ensures no raw JavaScript/Firebase error objects ({code, message}) reach React JSX as children.
 * Preserves Firebase error codes internally for diagnostics while delivering clean, user-friendly UI strings.
 */

export interface AppErrorState {
  code?: string;
  message: string;
  isNetworkError?: boolean;
  isCredentialError?: boolean;
}

/**
 * Safely extracts a clean, human-readable error message string from any caught value.
 * Handles Error instances, Firebase error objects ({code, message}), string literals,
 * and custom object payloads.
 */
export function getErrorMessage(
  error: unknown, 
  fallbackMessage = 'Something went wrong. Please try again.'
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
      const authMessage = getHumanReadableAuthMessage(candidate.code);
      if (authMessage) return authMessage;
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
  return undefined;
}

/**
 * Maps known Firebase Auth / Firestore codes to clean, patient-safe human readable strings.
 */
export function getHumanReadableAuthMessage(code: string, defaultFallback = 'Authentication failed. Please check your credentials.'): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';

    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact clinic support.';

    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please try again in a few minutes or reset your password.';

    case 'auth/network-request-failed':
      return 'Unable to connect. Please check your internet connection and try again.';

    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';

    case 'auth/weak-password':
      return 'Password must be at least 6 characters in length.';

    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/operation-not-allowed':
      return 'Email and password sign-in is currently unavailable.';

    case 'auth/requires-recent-login':
      return 'This operation requires recent authentication. Please sign in again.';

    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Authentication was cancelled.';

    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'Access denied: Insufficient permissions for this action.';

    case 'unavailable':
    case 'firestore/unavailable':
      return 'The service is temporarily unavailable. Reconnecting...';

    default:
      return defaultFallback;
  }
}

/**
 * Creates a normalized error representation preserving both the debugging code and safe UI string.
 */
export function normalizeFirebaseError(
  error: unknown, 
  defaultFallback = 'Something went wrong. Please try again.'
): AppErrorState {
  const code = getErrorCode(error);
  const isNetwork = code === 'auth/network-request-failed' || code === 'unavailable' || code === 'firestore/unavailable';
  const isCredential = code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/user-disabled';

  const message = getErrorMessage(error, defaultFallback);

  return {
    code,
    message,
    isNetworkError: isNetwork,
    isCredentialError: isCredential
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
