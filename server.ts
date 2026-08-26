import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment configuration
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON requests
app.use(express.json({ limit: '1mb' }));

// ----------------------------------------------------------------------------
// SERVER-SIDE SECURITY & RATE LIMITING FOR SUPER ADMIN PIN
// ----------------------------------------------------------------------------

// Server-side Secret: PIN is NEVER sent or exposed to the client
const SERVER_SUPER_ADMIN_PIN = process.env.SUPER_ADMIN_PIN || '8899';

// Rate Limiting & Failed Attempts Tracking (Stored in server memory)
interface AttemptRecord {
  failedAttempts: number;
  lockoutUntil: number | null;
  lastAttempt: number;
}

const pinAttemptStore = new Map<string, AttemptRecord>();

// Maximum permitted consecutive failed attempts before temporary lockout
const MAX_FAILED_ATTEMPTS = 5;
// Lockout duration: 15 minutes in milliseconds
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// Active Authenticated Super Admin Sessions (Token -> metadata)
interface SuperAdminSession {
  token: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
}

const activeSuperAdminSessions = new Map<string, SuperAdminSession>();
// Session duration: 8 hours in milliseconds
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

// Helper to get client IP cleanly
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// ----------------------------------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------------------------------

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Super Admin PIN Verification (Server-Side Only)
app.post('/api/super-admin/verify-pin', (req: Request, res: Response) => {
  const clientIp = getClientIp(req);
  const now = Date.now();

  // Retrieve or initialize attempt record
  const record: AttemptRecord = pinAttemptStore.get(clientIp) || {
    failedAttempts: 0,
    lockoutUntil: null,
    lastAttempt: now,
  };

  // Check if IP is currently locked out
  if (record.lockoutUntil && record.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      error: `Too many failed attempts. Super Admin access is temporarily locked for security. Please try again in ${remainingSeconds} seconds.`,
      locked: true,
      remainingSeconds,
    });
  }

  // If lockout expired, reset failed attempts
  if (record.lockoutUntil && record.lockoutUntil <= now) {
    record.failedAttempts = 0;
    record.lockoutUntil = null;
  }

  const { pin } = req.body;

  // Validate that a PIN was provided and is a non-empty string
  if (!pin || typeof pin !== 'string' || !pin.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Super Admin PIN is required.',
    });
  }

  const submittedPin = pin.trim();

  // Constant-time comparison to prevent timing attacks
  const pinBuffer = Buffer.from(submittedPin);
  const targetBuffer = Buffer.from(SERVER_SUPER_ADMIN_PIN);
  const isMatch =
    pinBuffer.length === targetBuffer.length &&
    crypto.timingSafeEqual(pinBuffer, targetBuffer);

  if (!isMatch) {
    record.failedAttempts += 1;
    record.lastAttempt = now;

    if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      record.lockoutUntil = now + LOCKOUT_DURATION_MS;
      pinAttemptStore.set(clientIp, record);
      
      console.warn(`[SECURITY AUDIT] Super Admin PIN lockout triggered for IP: ${clientIp}`);

      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Super Admin access has been temporarily locked for 15 minutes.',
        locked: true,
        remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
      });
    }

    pinAttemptStore.set(clientIp, record);

    return res.status(401).json({
      success: false,
      error: 'Invalid Super Admin PIN.',
      remainingAttempts: MAX_FAILED_ATTEMPTS - record.failedAttempts,
    });
  }

  // Successful authentication: Reset failed attempts for this client
  pinAttemptStore.delete(clientIp);

  // Generate cryptographically secure random session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = now + SESSION_LIFETIME_MS;

  activeSuperAdminSessions.set(sessionToken, {
    token: sessionToken,
    createdAt: now,
    expiresAt,
    ip: clientIp,
  });

  // Note: We NEVER return the PIN or any server secrets back to the client
  return res.json({
    success: true,
    sessionToken,
    expiresIn: Math.floor(SESSION_LIFETIME_MS / 1000),
    user: {
      role: 'SUPER_ADMIN',
      name: 'Super Administrator',
      email: 'superadmin@mediqueue.internal',
    },
  });
});

// 3. Super Admin Session Verification Endpoint
app.post('/api/super-admin/verify-session', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Missing authorization header.' });
  }

  const token = authHeader.split(' ')[1];
  const session = activeSuperAdminSessions.get(token);
  const now = Date.now();

  if (!session || session.expiresAt <= now) {
    if (session) {
      activeSuperAdminSessions.delete(token);
    }
    return res.status(401).json({ valid: false, error: 'Session expired or invalid.' });
  }

  return res.json({
    valid: true,
    expiresIn: Math.ceil((session.expiresAt - now) / 1000),
    user: {
      role: 'SUPER_ADMIN',
      name: 'Super Administrator',
      email: 'superadmin@mediqueue.internal',
    },
  });
});

// 4. Super Admin Logout Endpoint (Revokes server session)
app.post('/api/super-admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    activeSuperAdminSessions.delete(token);
  }
  return res.json({ success: true, message: 'Super admin session terminated.' });
});

// ----------------------------------------------------------------------------
// VITE MIDDLEWARE & SPA SERVING
// ----------------------------------------------------------------------------

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`MediQueue server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
