/**
 * Centralized Firebase Authentication error details and user-friendly mapping.
 */
export interface AuthErrorDetails {
  code: string;
  userMessage: string;
  isNetworkError: boolean;
  isCredentialError: boolean;
}

/**
 * Maps raw Firebase authentication error codes to clean, safe, user-friendly messages.
 * Prevents account enumeration and never exposes raw stack traces or internal secrets.
 */
export function parseAuthError(error: unknown, defaultFallback = 'Authentication failed. Please try again.'): AuthErrorDetails {
  if (!error) {
    return {
      code: 'unknown',
      userMessage: defaultFallback,
      isNetworkError: false,
      isCredentialError: false,
    };
  }

  let code = 'unknown';
  let rawMessage = '';

  if (typeof error === 'object' && error !== null) {
    const errObj = error as { code?: string; message?: string };
    if (typeof errObj.code === 'string') {
      code = errObj.code;
    }
    if (typeof errObj.message === 'string') {
      rawMessage = errObj.message;
    }
  } else if (typeof error === 'string') {
    rawMessage = error;
    if (error.includes('auth/')) {
      const match = error.match(/auth\/[a-z0-9-]+/i);
      if (match) {
        code = match[0];
      }
    }
  }

  // Handle specific Firebase error codes
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        code,
        userMessage: 'Invalid email or password. Please check your credentials and try again.',
        isNetworkError: false,
        isCredentialError: true,
      };

    case 'auth/user-disabled':
      return {
        code,
        userMessage: 'This account has been disabled. Please contact clinic support or the administrator.',
        isNetworkError: false,
        isCredentialError: true,
      };

    case 'auth/too-many-requests':
      return {
        code,
        userMessage: 'Too many unsuccessful attempts. Access is temporarily delayed. Please wait a moment or reset your password.',
        isNetworkError: false,
        isCredentialError: false,
      };

    case 'auth/network-request-failed':
      return {
        code,
        userMessage: 'Network connectivity error. Please check your internet connection and try again.',
        isNetworkError: true,
        isCredentialError: false,
      };

    case 'auth/email-already-in-use':
      return {
        code,
        userMessage: 'An account with this email already exists. Please sign in instead.',
        isNetworkError: false,
        isCredentialError: false,
      };

    case 'auth/weak-password':
      return {
        code,
        userMessage: 'Password must be at least 6 characters in length.',
        isNetworkError: false,
        isCredentialError: false,
      };

    case 'auth/invalid-email':
      return {
        code,
        userMessage: 'Please enter a valid email address.',
        isNetworkError: false,
        isCredentialError: false,
      };

    case 'auth/operation-not-allowed':
      return {
        code,
        userMessage: 'Email/Password authentication is disabled in the Firebase project console.',
        isNetworkError: false,
        isCredentialError: false,
      };

    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return {
        code,
        userMessage: 'Firebase configuration error: The configured API key is invalid.',
        isNetworkError: false,
        isCredentialError: false,
      };

    case 'auth/requires-recent-login':
      return {
        code,
        userMessage: 'This operation requires recent authentication. Please sign in again.',
        isNetworkError: false,
        isCredentialError: false,
      };

    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        userMessage: 'Authentication was cancelled.',
        isNetworkError: false,
        isCredentialError: false,
      };

    default:
      if (rawMessage && !rawMessage.includes('Firebase: Error') && !rawMessage.includes('auth/')) {
        return {
          code,
          userMessage: rawMessage,
          isNetworkError: false,
          isCredentialError: false,
        };
      }

      return {
        code,
        userMessage: defaultFallback,
        isNetworkError: false,
        isCredentialError: false,
      };
  }
}

/**
 * Diagnostic logger for authentication events. Logs Firebase error codes for developer debugging
 * without logging raw passwords or sensitive credentials.
 */
export function logAuthError(context: string, error: unknown): void {
  const parsed = parseAuthError(error);
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[Auth Diagnostic] ${context}: ${parsed.code} - ${parsed.userMessage}`);
  }
}

/**
 * Centralized authentication error handler that logs diagnostic code safely and returns user-friendly details.
 */
export function handleAuthError(
  error: unknown, 
  contextLabel: string = 'Authentication', 
  defaultFallback = 'Authentication failed. Please try again.'
): AuthErrorDetails {
  logAuthError(contextLabel, error);
  return parseAuthError(error, defaultFallback);
}
