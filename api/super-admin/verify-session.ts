import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';
import {
  extractSessionToken,
  verifySuperAdminSessionToken,
  sendJsonResponse,
} from '../../src/server/superAdminSecurity';

export async function handleVerifySession(req: Request | any, res: Response | any) {
  try {
    if (handleCors(req, res)) return;

    const token = extractSessionToken(req);

    if (!token) {
      if (req.method === 'GET') {
        return sendJsonResponse(res, 200, {
          valid: false,
          authenticated: false,
          message: 'No active session found.',
        });
      }
      return sendJsonResponse(res, 401, {
        valid: false,
        authenticated: false,
        error: 'Missing authorization header or session cookie.',
      });
    }

    const verification = verifySuperAdminSessionToken(token);

    if (!verification.valid || !verification.payload) {
      return sendJsonResponse(res, 401, {
        valid: false,
        authenticated: false,
        error: verification.error || 'Session expired or invalid.',
      });
    }

    const remainingSeconds = Math.max(0, Math.ceil((verification.payload.exp - Date.now()) / 1000));

    return sendJsonResponse(res, 200, {
      valid: true,
      authenticated: true,
      role: 'superAdmin',
      expiresIn: remainingSeconds,
      user: {
        role: verification.payload.role,
        name: verification.payload.name,
        email: verification.payload.email,
      },
    });
  } catch (err: any) {
    console.error('[VERCEL RUNTIME ERROR /api/super-admin/verify-session]', {
      name: err?.name,
      message: err?.message,
      timestamp: new Date().toISOString(),
    });
    return sendJsonResponse(res, 500, {
      valid: false,
      authenticated: false,
      error: 'An unexpected server error occurred during session verification.',
    });
  }
}

export default async function handler(req: Request | any, res: Response | any) {
  return handleVerifySession(req, res);
}
