import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';
import {
  extractSessionToken,
  verifySuperAdminSessionToken,
} from '../../src/server/superAdminSecurity';

export async function handleSuperAdminSession(req: Request | any, res: Response | any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      authenticated: false,
      valid: false,
      error: 'Method Not Allowed. GET or POST required.',
    });
  }

  const token = extractSessionToken(req);

  if (!token) {
    return res.status(200).json({
      authenticated: false,
      valid: false,
      message: 'No active session found.',
    });
  }

  const verification = verifySuperAdminSessionToken(token);

  if (!verification.valid || !verification.payload) {
    return res.status(200).json({
      authenticated: false,
      valid: false,
      error: verification.error || 'Session expired or invalid.',
    });
  }

  const remainingSeconds = Math.max(0, Math.ceil((verification.payload.exp - Date.now()) / 1000));

  return res.status(200).json({
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
}

export default async function handler(req: Request | any, res: Response | any) {
  return handleSuperAdminSession(req, res);
}
