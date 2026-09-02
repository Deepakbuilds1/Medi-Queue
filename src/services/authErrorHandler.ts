/**
 * Centralized Firebase Authentication error handler module.
 * Re-exports the unified error handler defined in AuthContext.
 */

export {
  type AuthErrorDetails,
  parseAuthError,
  logAuthError,
  handleAuthError,
} from '../context/AuthContext';

