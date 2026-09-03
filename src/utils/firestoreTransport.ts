/**
 * Firestore Transport & Realtime Error Handling Utilities
 * 
 * Provides:
 * 1. Error classification distinguishing transient transport issues from terminal authorization/precondition errors.
 * 2. Controlled diagnostic logging to prevent duplicate console warning flooding.
 * 3. Exponential backoff calculation for resilient connection recovery.
 */

export type FirestoreErrorCategory = 
  | 'PERMISSION_DENIED'
  | 'UNAUTHENTICATED'
  | 'QUERY_PRECONDITION'
  | 'NETWORK_TRANSIENT'
  | 'INTERNAL'
  | 'UNKNOWN';

export interface FirestoreErrorClassification {
  code: string;
  category: FirestoreErrorCategory;
  isRetryable: boolean;
  isTerminal: boolean;
  userMessage: string;
  originalError: unknown;
}

/**
 * Extracts a normalized Firestore error code from an error object or string.
 */
export function extractFirestoreErrorCode(error: unknown): string {
  if (!error) return 'unknown';

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    if (typeof candidate.code === 'string' && candidate.code.trim().length > 0) {
      // Normalize 'firestore/unavailable' -> 'unavailable'
      return candidate.code.replace(/^firestore\//, '').trim().toLowerCase();
    }
    if (typeof candidate.message === 'string') {
      const msg = candidate.message.toLowerCase();
      if (msg.includes('permission-denied') || msg.includes('permission denied') || msg.includes('insufficient permissions')) {
        return 'permission-denied';
      }
      if (msg.includes('unauthenticated') || msg.includes('requires authentication')) {
        return 'unauthenticated';
      }
      if (msg.includes('unavailable') || msg.includes('stream transport errored') || msg.includes('transport errored')) {
        return 'unavailable';
      }
      if (msg.includes('deadline-exceeded') || msg.includes('timeout')) {
        return 'deadline-exceeded';
      }
      if (msg.includes('failed-precondition') || msg.includes('requires an index') || msg.includes('index')) {
        return 'failed-precondition';
      }
    }
  }

  if (typeof error === 'string') {
    const str = error.toLowerCase();
    if (str.includes('permission-denied') || str.includes('insufficient permissions')) return 'permission-denied';
    if (str.includes('unauthenticated')) return 'unauthenticated';
    if (str.includes('unavailable') || str.includes('transport errored')) return 'unavailable';
    if (str.includes('deadline-exceeded')) return 'deadline-exceeded';
    if (str.includes('failed-precondition')) return 'failed-precondition';
  }

  return 'unknown';
}

/**
 * Authoritative classification of Firestore listener errors.
 * Strictly separates terminal security/query issues from transient network/transport reconnects.
 */
export function classifyFirestoreError(
  error: unknown,
  customFallbackMessage = 'A real-time synchronization error occurred.'
): FirestoreErrorClassification {
  const code = extractFirestoreErrorCode(error);

  let category: FirestoreErrorCategory = 'UNKNOWN';
  let isRetryable = false;
  let isTerminal = false;
  let userMessage = customFallbackMessage;

  switch (code) {
    case 'permission-denied':
      category = 'PERMISSION_DENIED';
      isRetryable = false;
      isTerminal = true;
      userMessage = 'Access restricted: Insufficient database privileges or unauthorized clinic scope.';
      break;

    case 'unauthenticated':
      category = 'UNAUTHENTICATED';
      isRetryable = false;
      isTerminal = true;
      userMessage = 'Authentication required: User session has expired or is not signed in.';
      break;

    case 'failed-precondition':
      category = 'QUERY_PRECONDITION';
      isRetryable = false;
      isTerminal = true;
      userMessage = 'Database query configuration requires composite indexing or valid constraints.';
      break;

    case 'unavailable':
    case 'deadline-exceeded':
    case 'cancelled':
      category = 'NETWORK_TRANSIENT';
      isRetryable = true;
      isTerminal = false;
      userMessage = 'Live connection notice: Re-establishing real-time connection...';
      break;

    case 'internal':
      category = 'INTERNAL';
      isRetryable = true;
      isTerminal = false;
      userMessage = 'Internal database notice: Retrying real-time sync...';
      break;

    default: {
      const errStr = String((error as any)?.message || error || '').toLowerCase();
      if (errStr.includes('permission') || errStr.includes('unauthorized')) {
        category = 'PERMISSION_DENIED';
        isRetryable = false;
        isTerminal = true;
        userMessage = 'Access restricted: Insufficient database privileges.';
      } else if (errStr.includes('network') || errStr.includes('offline') || errStr.includes('transport')) {
        category = 'NETWORK_TRANSIENT';
        isRetryable = true;
        isTerminal = false;
        userMessage = 'Live connection notice: Connecting to real-time service...';
      }
      break;
    }
  }

  return {
    code,
    category,
    isRetryable,
    isTerminal,
    userMessage,
    originalError: error,
  };
}

// -------------------------------------------------------------
// CONTROLLED CONSOLE LOGGER (Prevents Warning Spam)
// -------------------------------------------------------------

interface LogHistoryEntry {
  timestamp: number;
  count: number;
}

const logHistory = new Map<string, LogHistoryEntry>();
const LOG_THROTTLE_WINDOW_MS = 15000; // 15-second throttle per key

/**
 * Emits controlled, formatted Firestore logging without spamming the console with duplicate warnings.
 */
export function logFirestoreEvent(event: {
  action: 'connect' | 'interrupted' | 'reconnecting' | 'reconnected' | 'error' | 'permission_denied';
  path?: string;
  code?: string;
  message?: string;
  details?: unknown;
}): void {
  const key = `${event.action}:${event.path || 'global'}:${event.code || 'default'}`;
  const now = Date.now();
  const existing = logHistory.get(key);

  if (existing && (now - existing.timestamp < LOG_THROTTLE_WINDOW_MS)) {
    existing.count += 1;
    return; // Throttled
  }

  const suppressedCount = existing && existing.count > 1 ? ` (${existing.count} duplicate events debounced)` : '';
  logHistory.set(key, { timestamp: now, count: 1 });

  const pathLabel = event.path ? ` [${event.path}]` : '';

  switch (event.action) {
    case 'connect':
    case 'reconnected':
      if (import.meta.env.DEV) {
        console.info(`[Firestore Listener]${pathLabel} Realtime connection active.`);
      }
      break;

    case 'interrupted':
    case 'reconnecting':
      console.warn(
        `[Firestore Listener]${pathLabel} Transport interrupted (${event.code || 'unavailable'}). ` +
        `WebChannel auto-recovery active.${suppressedCount}`
      );
      break;

    case 'permission_denied':
      console.error(
        `[Firestore Listener]${pathLabel} Security rule permission denied. (Code: ${event.code}). ` +
        `Verify request.auth and activeClinicId.${suppressedCount}`
      );
      break;

    case 'error':
      console.error(`[Firestore Listener]${pathLabel} Realtime error:`, {
        code: event.code,
        message: event.message,
        details: event.details,
      });
      break;
  }
}

/**
 * Calculates exponential backoff delay with jitter.
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs = 2000,
  maxDelayMs = 30000
): number {
  const exponential = baseDelayMs * Math.pow(1.5, Math.min(attempt, 6));
  const jitter = Math.random() * 1000;
  return Math.min(exponential + jitter, maxDelayMs);
}
