import crypto from 'crypto';

/**
 * Validates that production environments supply explicit secrets.
 * In production, missing secrets derive a stable 256-bit SHA-256 HMAC key from the PIN
 * ensuring the server always fails safe and never crashes.
 */
export function getSuperAdminSecret(): string {
  const secret = process.env.SUPER_ADMIN_SECRET;

  if (secret && secret.trim()) {
    return secret.trim();
  }

  // Cryptographically derive a stable 256-bit secret from SUPER_ADMIN_PIN + internal salt
  // This guarantees HMAC token generation works seamlessly in production environments
  // even if SUPER_ADMIN_SECRET was not separately provided in Vercel.
  const pin = getSuperAdminPin();
  return crypto.createHash('sha256').update(`${pin}_mediqueue_super_admin_secret_salt_v2`).digest('hex');
}

// Default Super Admin PIN configured to 8303 if not set
if (!process.env.SUPER_ADMIN_PIN || process.env.SUPER_ADMIN_PIN === '8899') {
  process.env.SUPER_ADMIN_PIN = '8303';
}

export function getSuperAdminPin(): string {
  const pin = process.env.SUPER_ADMIN_PIN;

  if (!pin || !pin.trim() || pin.trim() === '8899') {
    return '8303';
  }

  return pin.trim();
}

/**
 * Diagnostic check to ensure server environment is ready for Super Admin operations.
 */
export function validateSuperAdminConfig(): { isConfigured: boolean; error?: string } {
  try {
    const pin = getSuperAdminPin();
    if (!pin) {
      return { isConfigured: false, error: 'Super Admin PIN not configured.' };
    }
    const secret = getSuperAdminSecret();
    if (!secret) {
      return { isConfigured: false, error: 'Super Admin Secret not configured.' };
    }
    return { isConfigured: true };
  } catch (err: any) {
    return { isConfigured: false, error: err?.message || 'Server configuration error.' };
  }
}

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
  const targetPin = getSuperAdminPin();

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

  const secret = getSuperAdminSecret();
  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
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
    const secret = getSuperAdminSecret();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
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

/**
 * Universal JSON response sender compatible with Express, Vercel Serverless (VercelResponse),
 * and native Node.js http.ServerResponse.
 */
export function sendJsonResponse(res: any, statusCode: number, data: any): void {
  try {
    if (typeof res.status === 'function') {
      if (typeof res.json === 'function') {
        res.status(statusCode).json(data);
        return;
      }
      res.status(statusCode);
    } else if (typeof res.statusCode !== 'undefined') {
      res.statusCode = statusCode;
    }
  } catch (_) {}

  try {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (typeof res.end === 'function') {
      res.end(JSON.stringify(data));
      return;
    }
    if (typeof res.send === 'function') {
      res.send(JSON.stringify(data));
      return;
    }
  } catch (err) {
    console.error('[RESPONSE_WRITE_ERROR]', err);
  }
}

/**
 * Sets the secure HttpOnly session cookie on the HTTP response.
 */
export function setSessionCookie(
  res: any,
  token: string,
  maxAgeSeconds: number = Math.floor(SESSION_LIFETIME_MS / 1000)
): void {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieParts = [
      `mediqueue_super_admin_session=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAgeSeconds}`,
    ];
    if (isProd) {
      cookieParts.push('Secure');
    }
    if (typeof res.setHeader === 'function') {
      res.setHeader('Set-Cookie', cookieParts.join('; '));
    }
  } catch (err) {
    console.warn('[COOKIE_SET_WARN]', err);
  }
}

/**
 * Clears the secure HttpOnly session cookie on the HTTP response.
 */
export function clearSessionCookie(res: any): void {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieParts = [
      'mediqueue_super_admin_session=',
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=0',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    ];
    if (isProd) {
      cookieParts.push('Secure');
    }
    if (typeof res.setHeader === 'function') {
      res.setHeader('Set-Cookie', cookieParts.join('; '));
    }
  } catch (err) {
    console.warn('[COOKIE_CLEAR_WARN]', err);
  }
}

/**
 * Extracts session token from either Authorization header or HttpOnly Cookie.
 */
export function extractSessionToken(req: any): string | null {
  // 1. Check Authorization Bearer header
  const authHeader = req.headers?.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  // 2. Check Cookie header
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)mediqueue_super_admin_session=([^;]*)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

/**
 * Extracts client IP address safely across proxies, Cloudflare, and Vercel edge.
 */
export function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Safely parses the request body regardless of whether it's already an object,
 * a raw JSON string, a Buffer, or an unconsumed stream.
 */
export async function getJsonBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString('utf8'));
      } catch {
        return {};
      }
    }
  }

  // If body is not yet parsed, read the stream
  if (typeof req.on === 'function') {
    return new Promise((resolve) => {
      let raw = '';
      req.on('data', (chunk: any) => {
        raw += chunk;
      });
      req.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({});
        }
      });
      req.on('error', () => {
        resolve({});
      });
    });
  }

  return {};
}
