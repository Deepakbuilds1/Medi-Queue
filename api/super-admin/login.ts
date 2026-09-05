import type { Request, Response } from 'express';
import { handleSuperAdminAuth } from './auth.ts';
import { sendJsonResponse } from '../_lib/security.ts';

export default async function handler(req: Request | any, res: Response | any) {
  try {
    return await handleSuperAdminAuth(req, res);
  } catch (err: any) {
    console.error('[VERCEL RUNTIME ERROR /api/super-admin/login]', {
      name: err?.name,
      message: err?.message,
      timestamp: new Date().toISOString(),
    });
    return sendJsonResponse(res, 500, {
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
      error: 'An unexpected server error occurred.',
    });
  }
}
