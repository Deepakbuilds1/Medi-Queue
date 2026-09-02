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
import verifyPinHandler from '../../api/super-admin/verify-pin';
import verifySessionHandler from '../../api/super-admin/verify-session';
import healthHandler from '../../api/health';

describe('Super Admin Security & Token Verification Core', () => {
  it('correctly validates the Super Admin PIN using constant-time comparison', () => {
    expect(verifySuperAdminPinValue('8899')).toBe(true);
    expect(verifySuperAdminPinValue(' 8899 ')).toBe(true);
    expect(verifySuperAdminPinValue('1234')).toBe(false);
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
  app.post('/api/super-admin/verify-pin', (req, res) => verifyPinHandler(req as any, res as any));
  app.post('/api/super-admin/verify-session', (req, res) => verifySessionHandler(req as any, res as any));

  it('GET /api/health returns 200 with ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/super-admin/verify-pin returns session token for correct PIN', async () => {
    const res = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({ pin: '8899' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionToken).toBeDefined();
    expect(res.body.user.role).toBe('SUPER_ADMIN');

    // Test verifying that session token
    const verifyRes = await request(app)
      .post('/api/super-admin/verify-session')
      .set('Authorization', `Bearer ${res.body.sessionToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.user.role).toBe('SUPER_ADMIN');
  });

  it('POST /api/super-admin/verify-pin rejects invalid PIN with 401', async () => {
    const res = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({ pin: '0000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid');
  });

  it('POST /api/super-admin/verify-pin rejects empty PIN with 400', async () => {
    const res = await request(app)
      .post('/api/super-admin/verify-pin')
      .send({ pin: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
