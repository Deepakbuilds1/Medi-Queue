import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';
import { verifySuperAdminSessionToken } from '../../src/server/superAdminSecurity';

export default function handler(req: Request, res: Response) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method Not Allowed. POST is required.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Missing authorization header.' });
  }

  const token = authHeader.split(' ')[1];
  const verification = verifySuperAdminSessionToken(token);

  if (!verification.valid || !verification.payload) {
    return res.status(401).json({
      valid: false,
      error: verification.error || 'Session expired or invalid.',
    });
  }

  const remainingSeconds = Math.max(0, Math.ceil((verification.payload.exp - Date.now()) / 1000));

  return res.status(200).json({
    valid: true,
    expiresIn: remainingSeconds,
    user: {
      role: verification.payload.role,
      name: verification.payload.name,
      email: verification.payload.email,
    },
  });
}
