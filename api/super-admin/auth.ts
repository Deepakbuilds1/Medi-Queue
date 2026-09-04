import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';
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
} from '../../src/server/superAdminSecurity';

export async function handleSuperAdminAuth(req: Request | any, res: Response | any) {
  try {
    // 1. Handle CORS and preflight
    if (handleCors(req, res)) return;

    if (req.method !== 'POST') {
      console.warn('[AUTH_METHOD_NOT_ALLOWED]', { method: req.method, path: req.url });
      return sendJsonResponse(res, 405, {
        success: false,
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method Not Allowed. POST is required.',
        error: 'Method Not Allowed. POST is required.',
      });
    }

    // 2. Verify server environment configuration (Fail safe: return 503 instead of 500)
    const configCheck = validateSuperAdminConfig();
    if (!configCheck.isConfigured) {
      console.error('[AUTH_CONFIG_MISSING]', {
        message: configCheck.error || 'Super Admin authentication service not configured on server.',
        timestamp: new Date().toISOString(),
      });
      return sendJsonResponse(res, 503, {
        success: false,
        code: 'AUTH_SERVICE_NOT_CONFIGURED',
        message: 'Super Admin authentication service is temporarily unavailable.',
        error: 'Super Admin authentication service is temporarily unavailable.',
      });
    }

    const clientIp = getClientIp(req);

    // 3. Check Rate Limiting / Lockout status
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

    // 4. Safely parse JSON body
    const body = await getJsonBody(req);
    const { pin } = body || {};

    // 5. Validate PIN input format
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

    // 6. Timing-Safe Constant-Time Verification against server secret
    const isMatch = verifySuperAdminPinValue(cleanPin);

    if (!isMatch) {
      const failedResult = recordFailedAttempt(clientIp, rateLimitStatus.record);

      if (failedResult.isLocked) {
        console.warn('[AUTH_LOCKOUT_TRIGGERED]', {
          clientIp,
          lockoutSeconds: failedResult.remainingSeconds,
          timestamp: new Date().toISOString(),
        });
        return sendJsonResponse(res, 429, {
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many failed attempts. Super Admin access has been temporarily locked for 15 minutes.',
          error: 'Too many failed attempts. Super Admin access has been temporarily locked for 15 minutes.',
          locked: true,
          remainingSeconds: failedResult.remainingSeconds,
        });
      }

      console.warn('[AUTH_INVALID_PIN]', {
        clientIp,
        remainingAttempts: failedResult.remainingAttempts,
        timestamp: new Date().toISOString(),
      });

      return sendJsonResponse(res, 401, {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid Super Admin credentials.',
        error: 'Invalid Super Admin PIN.',
        remainingAttempts: failedResult.remainingAttempts,
      });
    }

    // 7. Successful Authentication: Reset failed attempts & issue signed session token
    clearFailedAttempts(clientIp);

    const { token, expiresIn, payload } = signSuperAdminSessionToken({
      email: 'superadmin@mediqueue.internal',
      name: 'Super Administrator',
    });

    // 8. Set HttpOnly Session Cookie for cross-tab and refresh persistence
    setSessionCookie(res, token, expiresIn);

    console.log('[AUTH_SUCCESS]', {
      role: payload.role,
      clientIp,
      expiresIn,
      timestamp: new Date().toISOString(),
    });

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
      message: 'An unexpected server error occurred while processing authentication.',
      error: 'An unexpected server error occurred.',
    });
  }
}

export default async function handler(req: Request | any, res: Response | any) {
  return handleSuperAdminAuth(req, res);
}
