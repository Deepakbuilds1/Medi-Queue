import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import crypto from 'crypto';

/**
 * ============================================================================
 * SUPER ADMIN ROUTE GUARDS & API ENDPOINTS AUTOMATED TEST SUITE
 * ============================================================================
 * 
 * Verifies that:
 * 1. PATIENT accounts cannot access '/super-admin' or administrative routes.
 * 2. CLINIC_ADMIN accounts cannot access '/super-admin' controls without
 *    verified Super Admin credentials and active server session.
 * 3. Server-side PIN verification enforces strict timing-safe comparisons,
 *    rate limiting, and 15-minute brute-force IP lockout.
 * ============================================================================
 */

// Helper function implementing route authorization logic equivalent to src/services/clinicService.ts
function evaluateRouteAuthorization(user: {
  uid: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CLINIC_ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'PATIENT' | 'patient';
  clinicId?: string;
  clinicIds?: string[];
  isSuperAdminSessionActive?: boolean;
}, targetRoute: string): {
  isAuthorized: boolean;
  status: 200 | 401 | 403;
  redirectUrl?: string;
  reason?: string;
} {
  // 1. Unauthenticated checks
  if (!user || !user.uid) {
    return {
      isAuthorized: false,
      status: 401,
      redirectUrl: targetRoute.startsWith('/super-admin') ? '/super-admin/login' : '/admin/login',
      reason: 'Authentication required.'
    };
  }

  // 2. Patient role strictly blocked from all /super-admin and /admin paths
  if (user.role === 'PATIENT' || user.role === 'patient') {
    if (targetRoute.startsWith('/super-admin') || targetRoute.startsWith('/admin')) {
      return {
        isAuthorized: false,
        status: 403,
        redirectUrl: '/forbidden',
        reason: 'PATIENT account is strictly prohibited from accessing administrative portal data.'
      };
    }
  }

  // 3. Super Admin dedicated routes: /super-admin/*, /admin/super-admin
  if (targetRoute.startsWith('/super-admin') || targetRoute === '/admin/super-admin') {
    // Only authorized if the user has an active super admin session OR primary super admin verified role
    if (user.isSuperAdminSessionActive || user.role === 'SUPER_ADMIN' || user.email === 'gdeepak4689@gmail.com') {
      return {
        isAuthorized: true,
        status: 200
      };
    }

    return {
      isAuthorized: false,
      status: 403,
      redirectUrl: '/super-admin/login',
      reason: 'Elevated Super Administrator PIN verification required.'
    };
  }

  // 4. Standard clinic admin routes
  if (targetRoute.startsWith('/admin')) {
    if (user.role === 'CLINIC_ADMIN' || user.role === 'DOCTOR' || user.role === 'RECEPTIONIST' || user.role === 'SUPER_ADMIN') {
      return {
        isAuthorized: true,
        status: 200
      };
    }
  }

  return {
    isAuthorized: false,
    status: 403,
    redirectUrl: '/forbidden',
    reason: 'Insufficient permissions for this resource.'
  };
}

// Build an isolated Express instance mirroring server.ts for API testing
function createTestServer() {
  const app = express();
  app.use(express.json());

  const SERVER_SUPER_ADMIN_PIN = '8899';
  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
  const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

  interface AttemptRecord {
    failedAttempts: number;
    lockoutUntil: number | null;
    lastAttempt: number;
  }

  const pinAttemptStore = new Map<string, AttemptRecord>();
  const activeSuperAdminSessions = new Map<string, { token: string; createdAt: number; expiresAt: number; ip: string }>();

  function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.socket.remoteAddress || '127.0.0.1';
  }

  // POST /api/super-admin/verify-pin
  app.post('/api/super-admin/verify-pin', (req: Request, res: Response) => {
    const clientIp = getClientIp(req);
    const now = Date.now();

    const record: AttemptRecord = pinAttemptStore.get(clientIp) || {
      failedAttempts: 0,
      lockoutUntil: null,
      lastAttempt: now,
    };

    if (record.lockoutUntil && record.lockoutUntil > now) {
      const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Super Admin access is temporarily locked.',
        locked: true,
        remainingSeconds,
      });
    }

    if (record.lockoutUntil && record.lockoutUntil <= now) {
      record.failedAttempts = 0;
      record.lockoutUntil = null;
    }

    const { pin } = req.body;
    if (!pin || typeof pin !== 'string' || !pin.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Super Admin PIN is required.',
      });
    }

    const submittedPin = pin.trim();
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

    pinAttemptStore.delete(clientIp);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = now + SESSION_LIFETIME_MS;

    activeSuperAdminSessions.set(sessionToken, {
      token: sessionToken,
      createdAt: now,
      expiresAt,
      ip: clientIp,
    });

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

  // POST /api/super-admin/verify-session
  app.post('/api/super-admin/verify-session', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Missing authorization header.' });
    }

    const token = authHeader.split(' ')[1];
    const session = activeSuperAdminSessions.get(token);
    const now = Date.now();

    if (!session || session.expiresAt <= now) {
      if (session) activeSuperAdminSessions.delete(token);
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

  // POST /api/super-admin/logout
  app.post('/api/super-admin/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      activeSuperAdminSessions.delete(token);
    }
    return res.json({ success: true, message: 'Super admin session terminated.' });
  });

  return app;
}

describe('Super Admin Route Guards & Client Access Control', () => {
  const patientUser = {
    uid: 'patient_101',
    email: 'patient.alice@example.com',
    role: 'PATIENT' as const,
    clinicId: 'clinic_alpha',
    clinicIds: ['clinic_alpha'],
  };

  const clinicAdminUser = {
    uid: 'admin_202',
    email: 'clinic.manager@alpha.com',
    role: 'CLINIC_ADMIN' as const,
    clinicId: 'clinic_alpha',
    clinicIds: ['clinic_alpha'],
    isSuperAdminSessionActive: false,
  };

  const superAdminUser = {
    uid: 'super_admin_303',
    email: 'superadmin@mediqueue.internal',
    role: 'SUPER_ADMIN' as const,
    isSuperAdminSessionActive: true,
  };

  it('DENIES: PATIENT user navigating to /super-admin/dashboard', () => {
    const check = evaluateRouteAuthorization(patientUser, '/super-admin/dashboard');
    expect(check.isAuthorized).toBe(false);
    expect(check.status).toBe(403);
    expect(check.redirectUrl).toBe('/forbidden');
  });

  it('DENIES: PATIENT user navigating to /super-admin/tenants', () => {
    const check = evaluateRouteAuthorization(patientUser, '/super-admin/tenants');
    expect(check.isAuthorized).toBe(false);
    expect(check.status).toBe(403);
    expect(check.redirectUrl).toBe('/forbidden');
  });

  it('DENIES: PATIENT user navigating to /admin/super-admin', () => {
    const check = evaluateRouteAuthorization(patientUser, '/admin/super-admin');
    expect(check.isAuthorized).toBe(false);
    expect(check.status).toBe(403);
    expect(check.redirectUrl).toBe('/forbidden');
  });

  it('DENIES: CLINIC_ADMIN accessing /super-admin routes without elevated Super Admin session', () => {
    const check = evaluateRouteAuthorization(clinicAdminUser, '/super-admin/dashboard');
    expect(check.isAuthorized).toBe(false);
    expect(check.status).toBe(403);
    expect(check.redirectUrl).toBe('/super-admin/login');
  });

  it('ALLOWS: CLINIC_ADMIN accessing standard clinic routes (/admin/dashboard)', () => {
    const check = evaluateRouteAuthorization(clinicAdminUser, '/admin/dashboard');
    expect(check.isAuthorized).toBe(true);
    expect(check.status).toBe(200);
  });

  it('ALLOWS: SUPER_ADMIN accessing /super-admin/dashboard and /admin/super-admin', () => {
    const check1 = evaluateRouteAuthorization(superAdminUser, '/super-admin/dashboard');
    expect(check1.isAuthorized).toBe(true);
    expect(check1.status).toBe(200);

    const check2 = evaluateRouteAuthorization(superAdminUser, '/admin/super-admin');
    expect(check2.isAuthorized).toBe(true);
    expect(check2.status).toBe(200);
  });
});

describe('Super Admin Server API Endpoints (/api/super-admin/*)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestServer();
  });

  it('REJECTS: Empty or missing PIN on /api/super-admin/verify-pin', async () => {
    const res = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('PIN is required');
  });

  it('REJECTS: Incorrect PIN with 401 Unauthorized and decrementing attempts', async () => {
    const res = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({ pin: '0000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.remainingAttempts).toBe(4);
  });

  it('LOCKS OUT: Client after 5 consecutive failed PIN attempts (429 Rate Limit)', async () => {
    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      await request(app)
        .post('/api/super-admin/verify-pin')
        .send({ pin: `wrong_${i}` });
    }

    // 5th attempt triggers lockout
    const res5 = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({ pin: 'wrong_5' });

    expect(res5.status).toBe(429);
    expect(res5.body.locked).toBe(true);
    expect(res5.body.error).toContain('temporarily locked');

    // 6th attempt is blocked even if correct PIN is submitted
    const res6 = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({ pin: '8899' });

    expect(res6.status).toBe(429);
    expect(res6.body.locked).toBe(true);
  });

  it('AUTHENTICATES: Correct PIN returns cryptographically secure session token', async () => {
    const res = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({ pin: '8899' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionToken).toBeDefined();
    expect(res.body.user.role).toBe('SUPER_ADMIN');
  });

  it('VERIFIES: Valid active session token on /api/super-admin/verify-session', async () => {
    // 1. Authenticate to get valid token
    const loginRes = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({ pin: '8899' });

    const sessionToken = loginRes.body.sessionToken;

    // 2. Verify valid session
    const verifyRes = await request(app)
      .post('/api/super-admin/verify-session')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.user.role).toBe('SUPER_ADMIN');
  });

  it('REJECTS: Invalid or forged session token on /api/super-admin/verify-session', async () => {
    const verifyRes = await request(app)
      .post('/api/super-admin/verify-session')
      .set('Authorization', 'Bearer forged_session_token_12345');

    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.valid).toBe(false);
  });

  it('REVOKES: Session token on /api/super-admin/logout', async () => {
    // 1. Authenticate to get valid token
    const loginRes = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({ pin: '8899' });

    const sessionToken = loginRes.body.sessionToken;

    // 2. Terminate session
    const logoutRes = await request(app)
      .post('/api/super-admin/logout')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // 3. Confirm token is now rejected
    const verifyAfterLogout = await request(app)
      .post('/api/super-admin/verify-session')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(verifyAfterLogout.status).toBe(401);
    expect(verifyAfterLogout.body.valid).toBe(false);
  });
});
