import type { Request, Response } from 'express';
import { handleCors } from '../_lib/cors.ts';
import { clearSessionCookie, sendJsonResponse } from '../_lib/security.ts';

export async function handleSuperAdminLogout(req: Request | any, res: Response | any) {
  try {
    if (handleCors(req, res)) return;

    // Clear the HttpOnly session cookie
    clearSessionCookie(res);

    return sendJsonResponse(res, 200, {
      success: true,
      message: 'Super admin session terminated successfully.',
    });
  } catch (err: any) {
    console.error('[VERCEL RUNTIME ERROR /api/super-admin/logout]', {
      name: err?.name,
      message: err?.message,
      timestamp: new Date().toISOString(),
    });
    return sendJsonResponse(res, 500, {
      success: false,
      error: 'An unexpected server error occurred during logout.',
    });
  }
}

export default async function handler(req: Request | any, res: Response | any) {
  return handleSuperAdminLogout(req, res);
}
