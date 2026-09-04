import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifySuperAdminPinValue,
  signSuperAdminSessionToken,
  verifySuperAdminSessionToken,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  MAX_FAILED_ATTEMPTS,
} from '../../src/server/superAdminSecurity';
import request from 'supertest';
import express from 'express';
import authHandler from '../../api/super-admin/auth';
import loginHandler from '../../api/super-admin/login';
import verifyPinHandler from '../../api/super-admin/verify-pin';
import verifySessionHandler from '../../api/super-admin/verify-session';
import sessionHandler from '../../api/super-admin/session';
import logoutHandler from '../../api/super-admin/logout';
import healthHandler from '../../api/health';

describe('Super Admin Security & Token Verification Core', () => {
  it('correctly validates the Super Admin PIN using constant-time comparison', () => {
    expect(verifySuperAdminPinValue('8303')).toBe(true);
    expect(verifySuperAdminPinValue(' 8303 ')).toBe(true);
    expect(verifySuperAdminPinValue('1234')).toBe(false);
    expect(verifySuperAdminPinValue('8899')).toBe(false);
    expect(verifySuperAdminPinValue('')).toBe(false);
  });

  it('generates a valid cryptographically signed HMAC-SHA256 session token', () => {
    const { token, expiresIn, payload } = signSuperAdminSessionToken({
      email: 'superadmin@mediqueue.internal',
      name: 'Super Administrator',
    });

    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(2);
    expect(expiresIn).toBeGreaterThan(0);
    expect(payload.role).toBe('SUPER_ADMIN');
    expect(payload.email).toBe('superadmin@mediqueue.internal');

    // Verify token
    const verification = verifySuperAdminSessionToken(token);
    expect(verification.valid).toBe(true);
    expect(verification.payload?.role).toBe('SUPER_ADMIN');
  });

  it('rejects tampered or forged session tokens', () => {
    const { token } = signSuperAdminSessionToken();
    const [payload, signature] = token.split('.');

    // Tamper with payload
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    decoded.role = 'PATIENT';
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const forgedToken = `${tamperedPayload}.${signature}`;

    const verification = verifySuperAdminSessionToken(forgedToken);
    expect(verification.valid).toBe(false);
  });

  it('enforces rate limiting and IP lockout on repeated failed attempts', () => {
    const testIp = '192.168.1.99';
    clearFailedAttempts(testIp);

    let status = checkRateLimit(testIp);
    expect(status.isLocked).toBe(false);

    // Fail 5 times
    for (let i = 1; i <= MAX_FAILED_ATTEMPTS; i++) {
      const failed = recordFailedAttempt(testIp, status.record);
      if (i < MAX_FAILED_ATTEMPTS) {
        expect(failed.isLocked).toBe(false);
        expect(failed.remainingAttempts).toBe(MAX_FAILED_ATTEMPTS - i);
      } else {
        expect(failed.isLocked).toBe(true);
        expect(failed.remainingSeconds).toBeGreaterThan(0);
      }
    }

    // Now checkRateLimit should be locked
    const lockedStatus = checkRateLimit(testIp);
    expect(lockedStatus.isLocked).toBe(true);

    // Clear failed attempts
    clearFailedAttempts(testIp);
    const clearedStatus = checkRateLimit(testIp);
    expect(clearedStatus.isLocked).toBe(false);
  });
});

describe('Vercel Serverless Function Endpoints (/api)', () => {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (req, res) => healthHandler(req as any, res as any));
  app.post('/api/super-admin/auth', (req, res) => authHandler(req as any, res as any));
  app.post('/api/super-admin/login', (req, res) => loginHandler(req as any, res as any));
  app.post('/api/super-admin/verify-pin', (req, res) => verifyPinHandler(req as any, res as any));
  app.post('/api/super-admin/verify-session', (req, res) => verifySessionHandler(req as any, res as any));
  app.get('/api/super-admin/session', (req, res) => sessionHandler(req as any, res as any));
  app.post('/api/super-admin/logout', (req, res) => logoutHandler(req as any, res as any));

  it('GET /api/health returns 200 with ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('POST /api/super-admin/auth authenticates valid PIN and sets Set-Cookie', async () => {
    const res = await request(app)
      .post('/api/super-admin/auth')
      .send({ pin: '8303' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionToken).toBeDefined();
    expect(res.body.role).toBe('superAdmin');
    expect(res.body.user.role).toBe('SUPER_ADMIN');

    // Check Set-Cookie header
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie[0]).toContain('mediqueue_super_admin_session=');
    expect(setCookie[0]).toContain('HttpOnly');
  });

  it('POST /api/super-admin/login also works identically for backward compatibility', async () => {
    const res = await request(app)
      .post('/api/super-admin/login')
      .send({ pin: '8303' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionToken).toBeDefined();
  });

  it('GET /api/super-admin/session validates session via cookie or token', async () => {
    const loginRes = await request(app)
      .post('/api/super-admin/auth')
      .send({ pin: '8303' });

    const cookie = loginRes.headers['set-cookie'];

    // Test session inspection via cookie
    const sessionRes = await request(app)
      .get('/api/super-admin/session')
      .set('Cookie', cookie);

    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.authenticated).toBe(true);
    expect(sessionRes.body.user.role).toBe('SUPER_ADMIN');

    // Test session inspection without cookie/token returns 200 with authenticated: false
    const emptyRes = await request(app).get('/api/super-admin/session');
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.authenticated).toBe(false);
  });

  it('POST /api/super-admin/verify-session validates token via Authorization header', async () => {
    const loginRes = await request(app)
      .post('/api/super-admin/auth')
      .send({ pin: '8303' });

    const verifyRes = await request(app)
      .post('/api/super-admin/verify-session')
      .set('Authorization', `Bearer ${loginRes.body.sessionToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.user.role).toBe('SUPER_ADMIN');
  });

  it('POST /api/super-admin/logout clears session cookie', async () => {
    const res = await request(app).post('/api/super-admin/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie[0]).toContain('Max-Age=0');
  });

  it('POST /api/super-admin/auth rejects invalid PIN with 401', async () => {
    const res = await request(app)
      .post('/api/super-admin/auth')
      .send({ pin: '0000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid');
  });

  it('POST /api/super-admin/auth rejects empty PIN with 400', async () => {
    const res = await request(app)
      .post('/api/super-admin/auth')
      .send({ pin: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
