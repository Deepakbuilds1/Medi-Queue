import type { Request, Response } from 'express';
import { handleCors } from '../_lib/cors.ts';
import {
  verifySuperAdminPinValue,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  signSuperAdminSessionToken,
  validateSuperAdminConfig,
  setSessionCookie,
  getClientIp,
  getJsonBody,
  sendJsonResponse,
} from '../_lib/security.ts';
import { initFirebaseAdmin } from '../_lib/firebaseAdmin.ts';

export async function handleSuperAdminAuth(req: Request | any, res: Response | any) {
  try {
    // 1. Handle CORS and preflight
    if (handleCors(req, res)) return;

    // Diagnostic logging per Step 18
    console.log('[SuperAdminAuth] request received');

    if (req.method !== 'POST') {
      console.warn('[AUTH_METHOD_NOT_ALLOWED]', { method: req.method, path: req.url });
      return sendJsonResponse(res, 405, {
        success: false,
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method Not Allowed. POST is required.',
        error: 'Method Not Allowed. POST is required.',
      });
    }

    // 2. Safe Firebase Admin check
    try {
      const fbStatus = initFirebaseAdmin();
      if (fbStatus.isInitialized) {
        console.log('[SuperAdminAuth] Firebase Admin initialized');
      } else {
        console.log('[SuperAdminAuth] Firebase Admin not configured (using HMAC session provider)');
      }
    } catch (_) {
      console.log('[SuperAdminAuth] Firebase Admin fallback mode');
    }

    // 3. Verify server environment configuration
    const configCheck = validateSuperAdminConfig();
    if (!configCheck.isConfigured) {
      console.error('[AUTH_CONFIG_MISSING]', {
        message: configCheck.error || 'Super Admin authentication service not configured on server.',
        timestamp: new Date().toISOString(),
      });
      return sendJsonResponse(res, 503, {
        success: false,
        code: 'AUTH_SERVICE_NOT_CONFIGURED',
        message: 'Authentication service is temporarily unavailable.',
        error: 'Authentication service is temporarily unavailable.',
      });
    }

    console.log('[SuperAdminAuth] PIN configuration available');

    const clientIp = getClientIp(req);

    // 4. Check Rate Limiting / Lockout status
    const rateLimitStatus = checkRateLimit(clientIp);
    if (rateLimitStatus.isLocked) {
      console.warn('[AUTH_RATE_LIMITED]', { clientIp, remainingSeconds: rateLimitStatus.remainingSeconds });
      return sendJsonResponse(res, 429, {
        success: false,
        code: 'RATE_LIMITED',
        message: `Too many failed attempts. Super Admin access is temporarily locked for ${rateLimitStatus.remainingSeconds} seconds.`,
        error: `Too many failed attempts. Super Admin access is temporarily locked for ${rateLimitStatus.remainingSeconds} seconds.`,
        locked: true,
        remainingSeconds: rateLimitStatus.remainingSeconds,
      });
    }

    // 5. Safely parse JSON body
    const body = await getJsonBody(req);
    const { pin } = body || {};

    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      console.warn('[AUTH_INVALID_INPUT]', { clientIp, reason: 'PIN is empty or not a string' });
      return sendJsonResponse(res, 400, {
        success: false,
        code: 'INVALID_INPUT',
        message: 'Super Admin PIN is required.',
        error: 'Super Admin PIN is required.',
      });
    }

    const cleanPin = pin.trim();

    console.log('[SuperAdminAuth] authentication verification started');

    // 6. Timing-Safe Constant-Time Verification against server secret
    const isMatch = verifySuperAdminPinValue(cleanPin);

    if (!isMatch) {
      console.warn('[SuperAdminAuth] authentication failed');
      const failedResult = recordFailedAttempt(clientIp, rateLimitStatus.record);

      if (failedResult.isLocked) {
        return sendJsonResponse(res, 429, {
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many failed attempts. Super Admin access has been temporarily locked for 15 minutes.',
          error: 'Too many failed attempts. Super Admin access has been temporarily locked for 15 minutes.',
          locked: true,
          remainingSeconds: failedResult.remainingSeconds,
        });
      }

      return sendJsonResponse(res, 401, {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid Super Admin credentials.',
        error: 'Invalid Super Admin PIN.',
        remainingAttempts: failedResult.remainingAttempts,
      });
    }

    // 7. Successful Authentication
    console.log('[SuperAdminAuth] authentication successful');
    clearFailedAttempts(clientIp);

    const { token, expiresIn, payload } = signSuperAdminSessionToken({
      email: 'superadmin@mediqueue.internal',
      name: 'Super Administrator',
    });

    // 8. Set HttpOnly Session Cookie for browser persistence
    setSessionCookie(res, token, expiresIn);

    return sendJsonResponse(res, 200, {
      success: true,
      role: 'superAdmin',
      sessionToken: token,
      expiresIn,
      user: {
        role: payload.role,
        name: payload.name,
        email: payload.email,
      },
    });
  } catch (err: any) {
    console.error('[AUTH_UNEXPECTED_EXCEPTION]', {
      name: err?.name,
      message: err?.message,
      timestamp: new Date().toISOString(),
    });

    return sendJsonResponse(res, 500, {
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication service encountered an unexpected error.',
      error: 'Authentication service encountered an unexpected error.',
    });
  }
}

export default async function handler(req: Request | any, res: Response | any) {
  return handleSuperAdminAuth(req, res);
}
