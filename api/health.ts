import type { Request, Response } from 'express';

export default function handler(req: Request | any, res: Response | any) {
  try {
    // 1. CORS & Preflight handling
    const origin = req.headers?.origin || '';
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
      if (typeof res.status === 'function') {
        res.status(204).end();
      } else {
        res.statusCode = 204;
        res.end();
      }
      return;
    }

    const env = process.env.NODE_ENV || 'production';

    // 2. Safe Diagnostic Logging (Never logging secrets)
    console.log('[Health] request received');
    console.log(`[Health] environment=${env}`);
    console.log('[Health] server configuration valid');

    const payload = {
      status: 'ok',
      environment: env,
      timestamp: new Date().toISOString(),
      uptime: typeof process.uptime === 'function' ? Math.floor(process.uptime()) : 0,
    };

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(payload);
    }

    res.statusCode = 200;
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (typeof res.end === 'function') {
      res.end(JSON.stringify(payload));
      return;
    }
    if (typeof res.send === 'function') {
      res.send(JSON.stringify(payload));
      return;
    }
  } catch (err: any) {
    console.error('[Health] Error processing health check:', err?.message);
    const errorPayload = {
      status: 'error',
      code: 'SERVER_NOT_CONFIGURED',
      message: 'Internal server error processing health check.',
    };

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(503).json(errorPayload);
    }
    res.statusCode = 503;
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (typeof res.end === 'function') {
      res.end(JSON.stringify(errorPayload));
      return;
    }
    if (typeof res.send === 'function') {
      res.send(JSON.stringify(errorPayload));
      return;
    }
  }
}
