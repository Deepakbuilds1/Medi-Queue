import type { Request, Response } from 'express';
import crypto from 'crypto';
import { handleCors } from '../_lib/cors.ts';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  signSuperAdminSessionToken,
  setSessionCookie,
  getClientIp,
  getJsonBody,
  sendJsonResponse,
} from '../_lib/security.ts';

export async function handleVerifyPin(req: Request | any, res: Response | any) {
  try {
    if (handleCors(req, res)) return;

    if (req.method !== 'POST') {
      return sendJsonResponse(res, 405, {
        success: false,
        error: 'Method Not Allowed. POST is required.',
      });
    }

    const clientIp = getClientIp(req);
    const rateLimitStatus = checkRateLimit(clientIp);

    if (rateLimitStatus.isLocked) {
      return sendJsonResponse(res, 429, {
        success: false,
        error: 'Too many failed attempts. Super Admin access is temporarily locked.',
        locked: true,
        remainingSeconds: rateLimitStatus.remainingSeconds,
      });
    }

    const body = await getJsonBody(req);
    const { pin } = body || {};

    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return sendJsonResponse(res, 400, {
        success: false,
        error: 'Super Admin PIN is required.',
      });
    }

    const isProd = process.env.NODE_ENV === 'production';
    const rawPin = process.env.SUPER_ADMIN_PIN;

    if (isProd && (!rawPin || !rawPin.trim())) {
      console.error('[SECURITY_ALERT] SUPER_ADMIN_PIN environment variable is required in production.');
      return sendJsonResponse(res, 500, {
        success: false,
        error: 'Server configuration error: SUPER_ADMIN_PIN environment variable is required in production.',
      });
    }

    const targetPin = (rawPin || '8303').trim();
    const submittedPin = pin.trim();

    const pinHash = crypto.createHash('sha256').update(submittedPin).digest();
    const targetHash = crypto.createHash('sha256').update(targetPin).digest();

    const isMatch = crypto.timingSafeEqual(pinHash, targetHash);

    if (!isMatch) {
      const failedResult = recordFailedAttempt(clientIp, rateLimitStatus.record);

      if (failedResult.isLocked) {
        return sendJsonResponse(res, 429, {
          success: false,
          error: 'Too many failed attempts. Super Admin access has been temporarily locked for 15 minutes.',
          locked: true,
          remainingSeconds: failedResult.remainingSeconds,
        });
      }

      return sendJsonResponse(res, 401, {
        success: false,
        error: 'Invalid Super Admin PIN.',
        remainingAttempts: failedResult.remainingAttempts,
      });
    }

    // Success: clear rate limit counter and issue token
    clearFailedAttempts(clientIp);

    const { token, expiresIn, payload } = signSuperAdminSessionToken({
      email: 'superadmin@mediqueue.internal',
      name: 'Super Administrator',
    });

    setSessionCookie(res, token, expiresIn);

    return sendJsonResponse(res, 200, {
      success: true,
      sessionToken: token,
      expiresIn,
      user: {
        role: payload.role,
        name: payload.name,
        email: payload.email,
      },
    });
  } catch (err: any) {
    console.error('[VERCEL RUNTIME ERROR /api/super-admin/verify-pin]', err?.message);
    return sendJsonResponse(res, 500, {
      success: false,
      error: 'An unexpected server error occurred during PIN verification.',
    });
  }
}

export default async function handler(req: Request | any, res: Response | any) {
  return handleVerifyPin(req, res);
}
