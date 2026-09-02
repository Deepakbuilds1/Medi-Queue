import type { Request, Response } from 'express';
import { handleCors } from '../src/server/corsHelper';

export default function handler(req: Request, res: Response) {
  if (handleCors(req, res)) return;

  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
  });
}
