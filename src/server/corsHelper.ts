import type { Request, Response } from 'express';

const ALLOWED_ORIGINS = [
  'https://medi-queue-sand.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
];

export function handleCors(req: Request | any, res: Response | any): boolean {
  const origin = req.headers?.origin || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== 'production' || !origin;

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://medi-queue-sand.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-Role, X-User-Clinic-Id, X-Accessible-Clinic-Ids'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true; // Request handled as preflight
  }

  return false;
}
