/**
 * Safely extracts a readable, informative error message from any caught error object
 * avoiding useless `null`, `undefined`, or `[object Object]` logs.
 */
export function formatFirestoreError(error: unknown, fallbackMessage = 'An unexpected Firestore error occurred'): string {
  if (!error) {
    return fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;
    if (errObj.message && typeof errObj.message === 'string') {
      return errObj.message;
    }
    if (errObj.code && typeof errObj.code === 'string') {
      return `Error code: ${errObj.code}`;
    }
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') {
        return serialized;
      }
    } catch {
      // Fallback if circular
    }
  }

  return String(error);
}
