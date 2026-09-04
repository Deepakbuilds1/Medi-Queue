import type { Request, Response } from 'express';
import { handleCors } from '../src/server/corsHelper';
import { sendJsonResponse } from '../src/server/superAdminSecurity';

export default function handler(req: Request | any, res: Response | any) {
  try {
    if (handleCors(req, res)) return;

    return sendJsonResponse(res, 200, {
      status: 'ok',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  } catch (err: any) {
    console.error('[VERCEL RUNTIME ERROR /api/health]', {
      name: err?.name,
      message: err?.message,
      timestamp: new Date().toISOString(),
    });
    return sendJsonResponse(res, 500, {
      status: 'error',
      message: 'Internal server error processing health check.',
    });
  }
}

