import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';
import {
  extractSessionToken,
  verifySuperAdminSessionToken,
  sendJsonResponse,
} from '../../src/server/superAdminSecurity';

export async function handleSuperAdminSession(req: Request | any, res: Response | any) {
  try {
    if (handleCors(req, res)) return;

    if (req.method !== 'GET' && req.method !== 'POST') {
      return sendJsonResponse(res, 405, {
        authenticated: false,
        valid: false,
        error: 'Method Not Allowed. GET or POST required.',
      });
    }

    const token = extractSessionToken(req);

    if (!token) {
      return sendJsonResponse(res, 200, {
        authenticated: false,
        valid: false,
        message: 'No active session found.',
      });
    }

    const verification = verifySuperAdminSessionToken(token);

    if (!verification.valid || !verification.payload) {
      return sendJsonResponse(res, 200, {
        authenticated: false,
        valid: false,
        error: verification.error || 'Session expired or invalid.',
      });
    }

    const remainingSeconds = Math.max(0, Math.ceil((verification.payload.exp - Date.now()) / 1000));

    return sendJsonResponse(res, 200, {
      authenticated: true,
      valid: true,
      role: 'superAdmin',
      expiresIn: remainingSeconds,
      user: {
        role: verification.payload.role,
        name: verification.payload.name,
        email: verification.payload.email,
      },
    });
  } catch (err: any) {
    console.error('[VERCEL RUNTIME ERROR /api/super-admin/session]', {
      name: err?.name,
      message: err?.message,
      timestamp: new Date().toISOString(),
    });
    return sendJsonResponse(res, 500, {
      authenticated: false,
      valid: false,
      error: 'An unexpected server error occurred.',
    });
  }
}

export default async function handler(req: Request | any, res: Response | any) {
  return handleSuperAdminSession(req, res);
}
