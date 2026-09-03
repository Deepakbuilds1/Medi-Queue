import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';
import {
  verifySuperAdminPinValue,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  signSuperAdminSessionToken,
  validateSuperAdminConfig,
} from '../../src/server/superAdminSecurity';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export default function handler(req: Request, res: Response) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      error: 'Method Not Allowed. POST is required.',
    });
  }

  // 0. Verify server environment configuration (fail closed in production if secret is missing)
  const configCheck = validateSuperAdminConfig();
  if (!configCheck.isConfigured) {
    console.error('[SECURITY AUDIT] Super Admin authentication failed closed due to configuration error:', configCheck.error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_CONFIGURATION_ERROR',
      error: 'Server configuration error: Super Admin authentication credentials are not configured.',
    });
  }

  const clientIp = getClientIp(req);

  // 1. Check Rate Limiting / Lockout status
  const rateLimitStatus = checkRateLimit(clientIp);
  if (rateLimitStatus.isLocked) {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      error: `Too many failed attempts. Super Admin access is temporarily locked for security. Please try again in ${rateLimitStatus.remainingSeconds} seconds.`,
      locked: true,
      remainingSeconds: rateLimitStatus.remainingSeconds,
    });
  }

  const body = req.body || {};
  const { pin } = body;

  // 2. Validate PIN input
  if (!pin || typeof pin !== 'string' || !pin.trim()) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_INPUT',
      error: 'Super Admin PIN is required.',
    });
  }

  const cleanPin = pin.trim();

  // 3. Timing-Safe Constant-Time Verification
  const isMatch = verifySuperAdminPinValue(cleanPin);

  if (!isMatch) {
    const failedResult = recordFailedAttempt(clientIp, rateLimitStatus.record);

    if (failedResult.isLocked) {
      console.warn(`[SECURITY AUDIT] Super Admin PIN lockout triggered for IP: ${clientIp}`);
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        error: 'Too many failed attempts. Super Admin access has been temporarily locked for 15 minutes.',
        locked: true,
        remainingSeconds: failedResult.remainingSeconds,
      });
    }

    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      error: 'Invalid Super Admin PIN.',
      remainingAttempts: failedResult.remainingAttempts,
    });
  }

  // 4. Successful Authentication: Reset failed attempts and issue cryptographically signed session token
  clearFailedAttempts(clientIp);

  const { token, expiresIn, payload } = signSuperAdminSessionToken({
    email: 'superadmin@mediqueue.internal',
    name: 'Super Administrator',
  });

  return res.status(200).json({
    success: true,
    sessionToken: token,
    expiresIn,
    user: {
      role: payload.role,
      name: payload.name,
      email: payload.email,
    },
  });
}
