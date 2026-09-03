import { describe, it, expect } from 'vitest';
import { 
  normalizeFirebaseError, 
  getAuthErrorCategory, 
  getHumanReadableAuthMessage 
} from '../../src/utils/errorUtils';
import {
  signSuperAdminSessionToken,
  verifySuperAdminSessionToken,
  verifySuperAdminPinValue,
  validateSuperAdminConfig,
  getSuperAdminSecret,
  getSuperAdminPin,
} from '../../src/server/superAdminSecurity';

describe('Authentication & Authorization Error Normalization', () => {
  it('correctly maps invalid credentials without generic masking', () => {
    const err = { code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' };
    const normalized = normalizeFirebaseError(err);
    expect(normalized.category).toBe('INVALID_CREDENTIALS');
    expect(normalized.message).toBe('Invalid email or password.');
    expect(normalized.isCredentialError).toBe(true);
    expect(normalized.isNetworkError).toBe(false);
  });

  it('correctly maps network request failures', () => {
    const err = { code: 'auth/network-request-failed', message: 'Network error occurred' };
    const normalized = normalizeFirebaseError(err);
    expect(normalized.category).toBe('AUTHENTICATION_SERVICE_UNAVAILABLE');
    expect(normalized.isNetworkError).toBe(true);
    expect(normalized.message).toContain('internet connection');
  });

  it('correctly maps account disabled state', () => {
    const err = { code: 'auth/user-disabled', message: 'User has been disabled' };
    const normalized = normalizeFirebaseError(err);
    expect(normalized.category).toBe('ACCOUNT_DISABLED');
    expect(normalized.message).toBe('This account has been disabled.');
  });

  it('correctly maps rate limit too-many-requests', () => {
    const err = { code: 'auth/too-many-requests', message: 'Too many requests' };
    const normalized = normalizeFirebaseError(err);
    expect(normalized.category).toBe('RATE_LIMITED');
    expect(normalized.message).toContain('Too many unsuccessful attempts');
  });

  it('correctly maps operation-not-allowed as configuration error', () => {
    const err = { code: 'auth/operation-not-allowed', message: 'Operation not allowed' };
    const normalized = normalizeFirebaseError(err);
    expect(normalized.category).toBe('SERVER_CONFIGURATION_ERROR');
    expect(normalized.message).toContain('Email/password authentication is not enabled');
  });

  it('correctly maps permission-denied as authorization error', () => {
    const err = { code: 'permission-denied', message: 'Missing permissions' };
    const normalized = normalizeFirebaseError(err);
    expect(normalized.category).toBe('ACCOUNT_NOT_AUTHORIZED');
    expect(normalized.message).toBe('Your account is not authorized to access this clinic.');
  });

  it('preserves clean application-level custom errors', () => {
    const err = new Error('Your account is not authorized for the selected clinic.');
    const normalized = normalizeFirebaseError(err);
    expect(normalized.message).toBe('Your account is not authorized for the selected clinic.');
  });
});

describe('Super Admin Session Security & Timing-Safe Verification', () => {
  it('correctly validates the valid PIN using timing-safe comparison', () => {
    const validPin = getSuperAdminPin();
    expect(verifySuperAdminPinValue(validPin)).toBe(true);
    expect(verifySuperAdminPinValue('wrong-pin')).toBe(false);
    expect(verifySuperAdminPinValue('')).toBe(false);
  });

  it('signs and verifies a valid HMAC-SHA256 session token', () => {
    const { token, payload } = signSuperAdminSessionToken({
      email: 'superadmin@mediqueue.internal',
      name: 'Super Administrator',
    });

    expect(token).toBeDefined();
    expect(payload.role).toBe('SUPER_ADMIN');

    const verified = verifySuperAdminSessionToken(token);
    expect(verified.valid).toBe(true);
    expect(verified.payload?.role).toBe('SUPER_ADMIN');
    expect(verified.payload?.email).toBe('superadmin@mediqueue.internal');
  });

  it('rejects tampered session tokens', () => {
    const { token } = signSuperAdminSessionToken();
    const [payloadPart, sigPart] = token.split('.');
    
    // Tamper with payload
    const tamperedPayload = Buffer.from(JSON.stringify({ role: 'SUPER_ADMIN', exp: Date.now() + 100000 })).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${sigPart}`;
    
    const result = verifySuperAdminSessionToken(tamperedToken);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature verification failed');
  });

  it('rejects expired session tokens', () => {
    const secret = getSuperAdminSecret();
    const crypto = require('crypto');
    const expiredPayload = {
      role: 'SUPER_ADMIN',
      email: 'test@internal',
      name: 'Super Admin',
      iat: Date.now() - 100000,
      exp: Date.now() - 1000, // Expired in the past
      nonce: '1234567890',
    };
    const serialized = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(serialized).digest('hex');
    const expiredToken = `${serialized}.${signature}`;

    const result = verifySuperAdminSessionToken(expiredToken);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('validates server configuration readiness', () => {
    const status = validateSuperAdminConfig();
    expect(status.isConfigured).toBe(true);
  });
});
