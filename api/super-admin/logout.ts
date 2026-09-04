import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';
import { clearSessionCookie } from '../../src/server/superAdminSecurity';

export async function handleSuperAdminLogout(req: Request | any, res: Response | any) {
  if (handleCors(req, res)) return;

  // Clear the HttpOnly session cookie
  clearSessionCookie(res);

  return res.status(200).json({
    success: true,
    message: 'Super admin session terminated successfully.',
  });
}

export default async function handler(req: Request | any, res: Response | any) {
  return handleSuperAdminLogout(req, res);
}
