import type { Request, Response } from 'express';

/**
 * Validates whether an incoming HTTP Origin is authorized to access the API.
 * Supports:
 * - Localhost & 127.0.0.1 on any port (development and testing)
 * - Any *.vercel.app domain (production, preview, branch environments, e.g. medi-queue-psi.vercel.app)
 * - Any *.run.app domain (Google Cloud Run / AI Studio preview)
 * - Custom domains specified in ALLOWED_ORIGIN or FRONTEND_URL environment variables
 */
export function isOriginAllowed(origin: string): boolean {
  if (!origin) return true;

  // 1. Any localhost / 127.0.0.1 on any port
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  // 2. Any Vercel deployment domain (including production medi-queue-psi.vercel.app, medi-queue-sand.vercel.app, etc.)
  if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) {
    return true;
  }

  // 3. Any Google Cloud Run / AI Studio domain
  if (/^https:\/\/[\w-]+\.run\.app$/.test(origin)) {
    return true;
  }

  // 4. Custom configured ALLOWED_ORIGIN or FRONTEND_URL
  if (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN) {
    return true;
  }
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
    return true;
  }

  // 5. In non-production environments, allow origin
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

/**
 * Applies robust, production-safe CORS headers to Express or Serverless responses.
 * Returns true if the request was an OPTIONS preflight that has been completely handled.
 */
export function handleCors(req: Request | any, res: Response | any): boolean {
  const origin = req.headers?.origin || '';
  const allowed = isOriginAllowed(origin);

  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Same-origin or non-browser HTTP requests (curl, server-to-server)
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // Untrusted external origin
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-User-Role, X-User-Clinic-Id, X-Accessible-Clinic-Ids'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.status(204).end();
    } else {
      res.statusCode = 204;
      res.end();
    }
    return true; // Preflight handled
  }

  return false;
}

