import { describe, it, expect, vi } from 'vitest';
import { 
  classifyFirestoreError, 
  extractFirestoreErrorCode, 
  calculateBackoffDelay,
  logFirestoreEvent 
} from '../../src/utils/firestoreTransport';

describe('Firestore Transport & Error Classification', () => {
  describe('extractFirestoreErrorCode', () => {
    it('normalizes prefixed firestore error codes', () => {
      expect(extractFirestoreErrorCode({ code: 'firestore/unavailable' })).toBe('unavailable');
      expect(extractFirestoreErrorCode({ code: 'firestore/permission-denied' })).toBe('permission-denied');
    });

    it('identifies WebChannel transport error message strings', () => {
      const transportErrMsg = "@firebase/firestore: Firestore (12.17.0): WebChannelConnection RPC 'Listen' stream 0x5797a33f transport errored.";
      expect(extractFirestoreErrorCode({ message: transportErrMsg })).toBe('unavailable');
      expect(extractFirestoreErrorCode(transportErrMsg)).toBe('unavailable');
    });

    it('identifies timeout and deadline exceeded strings', () => {
      expect(extractFirestoreErrorCode({ message: 'The request timed out or deadline-exceeded' })).toBe('deadline-exceeded');
    });

    it('identifies missing index / precondition strings', () => {
      expect(extractFirestoreErrorCode({ message: 'The query requires an index' })).toBe('failed-precondition');
    });

    it('identifies permission denied messages', () => {
      expect(extractFirestoreErrorCode({ message: 'Missing or insufficient permissions.' })).toBe('permission-denied');
    });
  });

  describe('classifyFirestoreError', () => {
    it('correctly classifies unavailable as retryable transient network error', () => {
      const result = classifyFirestoreError({ code: 'unavailable', message: 'The operation could not be completed' });
      expect(result.category).toBe('NETWORK_TRANSIENT');
      expect(result.isRetryable).toBe(true);
      expect(result.isTerminal).toBe(false);
      expect(result.code).toBe('unavailable');
    });

    it('correctly classifies WebChannel transport error as retryable transient network error', () => {
      const result = classifyFirestoreError({ 
        message: "WebChannelConnection RPC 'Listen' stream 0x5797a33f transport errored." 
      });
      expect(result.category).toBe('NETWORK_TRANSIENT');
      expect(result.isRetryable).toBe(true);
      expect(result.isTerminal).toBe(false);
    });

    it('correctly classifies permission-denied as terminal authorization error (not network)', () => {
      const result = classifyFirestoreError({ 
        code: 'permission-denied', 
        message: 'Missing or insufficient permissions' 
      });
      expect(result.category).toBe('PERMISSION_DENIED');
      expect(result.isRetryable).toBe(false);
      expect(result.isTerminal).toBe(true);
      expect(result.code).toBe('permission-denied');
    });

    it('correctly classifies unauthenticated as terminal auth error', () => {
      const result = classifyFirestoreError({ code: 'unauthenticated' });
      expect(result.category).toBe('UNAUTHENTICATED');
      expect(result.isRetryable).toBe(false);
      expect(result.isTerminal).toBe(true);
    });

    it('correctly classifies failed-precondition as terminal query/index error', () => {
      const result = classifyFirestoreError({ code: 'failed-precondition' });
      expect(result.category).toBe('QUERY_PRECONDITION');
      expect(result.isRetryable).toBe(false);
      expect(result.isTerminal).toBe(true);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('increases exponentially across retry attempts', () => {
      const delay1 = calculateBackoffDelay(1);
      const delay3 = calculateBackoffDelay(3);
      expect(delay3).toBeGreaterThan(delay1);
    });

    it('caps backoff delay at maximum limit', () => {
      const delay10 = calculateBackoffDelay(10, 2000, 30000);
      expect(delay10).toBeLessThanOrEqual(30000);
    });
  });

  describe('logFirestoreEvent', () => {
    it('throttles duplicate warnings within the suppression window', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logFirestoreEvent({
        action: 'interrupted',
        path: 'clinics/test-clinic/tokens',
        code: 'unavailable'
      });

      // Second identical call immediately should be throttled
      logFirestoreEvent({
        action: 'interrupted',
        path: 'clinics/test-clinic/tokens',
        code: 'unavailable'
      });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });

  describe('Local Clinic Admin Caching & Security Context', () => {
    it('provides fallback super admin profile when cache is unpopulated', async () => {
      const { getLocalClinicAdmins } = await import('../../src/services/clinicService');
      const admins = getLocalClinicAdmins();
      expect(admins.length).toBeGreaterThan(0);
      expect(admins[0].role).toBe('SUPER_ADMIN');
      expect(admins[0].email).toBe('gdeepak4689@gmail.com');
    });

    it('stores and updates clinic admin in local storage', async () => {
      const { saveLocalClinicAdmin, getLocalClinicAdmins } = await import('../../src/services/clinicService');
      saveLocalClinicAdmin({
        uid: 'test_admin_uid_99',
        email: 'doctor.test@clinic.com',
        name: 'Dr. Test',
        phone: '+1 (555) 019-2834',
        role: 'CLINIC_ADMIN',
        clinicId: 'clinic_test_1',
        clinicIds: ['clinic_test_1'],
        status: 'active',
        createdAt: new Date().toISOString()
      });

      const updated = getLocalClinicAdmins();
      const found = updated.find(a => a.uid === 'test_admin_uid_99');
      expect(found).toBeDefined();
      expect(found?.email).toBe('doctor.test@clinic.com');
      expect(found?.role).toBe('CLINIC_ADMIN');
    });
  });
});
