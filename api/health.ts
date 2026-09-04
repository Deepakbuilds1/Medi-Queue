import type { Request, Response } from 'express';
import { handleCors } from '../src/server/corsHelper';

export default function handler(req: Request | any, res: Response | any) {
  if (handleCors(req, res)) return;

  return res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
}
