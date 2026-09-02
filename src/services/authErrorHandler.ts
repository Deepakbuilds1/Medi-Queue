/**
 * Centralized, production-safe Firebase Authentication error handler.
 * Handles Firebase Auth error codes, formats user-facing messages, and avoids leaking
 * sensitive security information or logging sensitive credentials.
 */

export interface AuthErrorDetails {
  code: string;
  userMessage: string;
  isNetworkError: boolean;
  isCredentialError: boolean;
}

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
        userMessage: 'This account has been disabled. Please contact clinic support.',
        isNetworkError: false,
        isCredentialError: true,
      };

    case 'auth/too-many-requests':
      return {
        code,
        userMessage: 'Too many unsuccessful attempts. Please try again in a few minutes or reset your password.',
        isNetworkError: false,
        isCredentialError: false,
      };

    case 'auth/network-request-failed':
      return {
        code,
        userMessage: 'Unable to connect. Please check your internet connection and try again.',
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
        userMessage: 'Email/Password sign-in is not enabled in the Firebase Console.',
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

    default:
      // If error message contains informative user-facing message (e.g. from our custom validation guards)
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
 * Safe logging helper that outputs diagnostic code without leaking passwords or sensitive info.
 */
export function logAuthError(context: string, error: unknown) {
  const parsed = parseAuthError(error);
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[Auth Diagnostic] ${context}: ${parsed.code} - ${parsed.userMessage}`);
  }
}
