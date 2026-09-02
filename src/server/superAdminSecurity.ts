import crypto from 'crypto';

// Server-side Secret: PIN is NEVER sent or exposed to the client
export const SERVER_SUPER_ADMIN_PIN = process.env.SUPER_ADMIN_PIN || '8899';
const TOKEN_SECRET = process.env.SUPER_ADMIN_SECRET || process.env.SUPER_ADMIN_PIN || 'mediqueue_super_admin_secret_key_2026';

// Maximum permitted consecutive failed attempts before temporary lockout
export const MAX_FAILED_ATTEMPTS = 5;
// Lockout duration: 15 minutes in milliseconds
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
// Session duration: 8 hours in milliseconds
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

export interface AttemptRecord {
  failedAttempts: number;
  lockoutUntil: number | null;
  lastAttempt: number;
}

// In-memory rate limiting store (for active container / serverless instance cache)
const pinAttemptStore = new Map<string, AttemptRecord>();

/**
 * Validates the submitted PIN against the server-side secret using timing-safe comparison.
 */
export function verifySuperAdminPinValue(submittedPin: string): boolean {
  if (!submittedPin || typeof submittedPin !== 'string') {
    return false;
  }
  const cleanPin = submittedPin.trim();
  const targetPin = SERVER_SUPER_ADMIN_PIN.trim();

  const pinBuffer = Buffer.from(cleanPin);
  const targetBuffer = Buffer.from(targetPin);

  if (pinBuffer.length !== targetBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(pinBuffer, targetBuffer);
}

/**
 * Checks client IP lockout status and returns attempt info.
 */
export function checkRateLimit(clientIp: string): {
  isLocked: boolean;
  remainingSeconds: number;
  record: AttemptRecord;
} {
  const now = Date.now();
  const record: AttemptRecord = pinAttemptStore.get(clientIp) || {
    failedAttempts: 0,
    lockoutUntil: null,
    lastAttempt: now,
  };

  if (record.lockoutUntil && record.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
    return { isLocked: true, remainingSeconds, record };
  }

  if (record.lockoutUntil && record.lockoutUntil <= now) {
    record.failedAttempts = 0;
    record.lockoutUntil = null;
    pinAttemptStore.set(clientIp, record);
  }

  return { isLocked: false, remainingSeconds: 0, record };
}

/**
 * Records a failed attempt for the client IP.
 */
export function recordFailedAttempt(clientIp: string, record: AttemptRecord): {
  isLocked: boolean;
  remainingSeconds: number;
  remainingAttempts: number;
} {
  const now = Date.now();
  record.failedAttempts += 1;
  record.lastAttempt = now;

  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.lockoutUntil = now + LOCKOUT_DURATION_MS;
    pinAttemptStore.set(clientIp, record);
    return {
      isLocked: true,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
      remainingAttempts: 0,
    };
  }

  pinAttemptStore.set(clientIp, record);
  return {
    isLocked: false,
    remainingSeconds: 0,
    remainingAttempts: MAX_FAILED_ATTEMPTS - record.failedAttempts,
  };
}

/**
 * Clears failed attempts upon successful login.
 */
export function clearFailedAttempts(clientIp: string): void {
  pinAttemptStore.delete(clientIp);
}

export interface SuperAdminSessionPayload {
  role: 'SUPER_ADMIN';
  email: string;
  name: string;
  iat: number;
  exp: number;
  nonce: string;
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 * Format: base64(payload).hex(hmac)
 */
export function signSuperAdminSessionToken(userMeta?: { email?: string; name?: string }): {
  token: string;
  expiresIn: number;
  payload: SuperAdminSessionPayload;
} {
  const now = Date.now();
  const exp = now + SESSION_LIFETIME_MS;
  const payload: SuperAdminSessionPayload = {
    role: 'SUPER_ADMIN',
    email: userMeta?.email || 'superadmin@mediqueue.internal',
    name: userMeta?.name || 'Super Administrator',
    iat: now,
    exp,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(serialized)
    .digest('hex');

  const token = `${serialized}.${signature}`;
  return {
    token,
    expiresIn: Math.floor(SESSION_LIFETIME_MS / 1000),
    payload,
  };
}

/**
 * Verifies a cryptographically signed HMAC-SHA256 session token.
 */
export function verifySuperAdminSessionToken(token: string): {
  valid: boolean;
  payload?: SuperAdminSessionPayload;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing or malformed.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid token format.' };
  }

  const [serialized, signature] = parts;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(serialized)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, error: 'Token signature verification failed.' };
    }

    const payloadJson = Buffer.from(serialized, 'base64url').toString('utf8');
    const payload: SuperAdminSessionPayload = JSON.parse(payloadJson);

    if (payload.exp <= Date.now()) {
      return { valid: false, error: 'Session has expired.' };
    }

    if (payload.role !== 'SUPER_ADMIN') {
      return { valid: false, error: 'Invalid role in token payload.' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Failed to decode token.' };
  }
}
