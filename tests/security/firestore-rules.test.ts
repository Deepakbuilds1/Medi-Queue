import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  RulesTestContext,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ============================================================================
 * FIREBASE EMULATOR SECURITY RULES AUTOMATED TEST SUITE
 * ============================================================================
 * 
 * Target: Verify that PATIENT and CLINIC_ADMIN users CANNOT access privileged
 *         database fields, elevate roles, create/delete clinics, modify
 *         audit logs, or tamper with multi-tenant data.
 * ============================================================================
 */

const PROJECT_ID = 'mediqueue-test-project';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

let testEnv: RulesTestEnvironment;

// Test Actor Identifiers
const SUPER_ADMIN_UID = 'super_admin_user_001';
const SUPER_ADMIN_EMAIL = 'gdeepak4689@gmail.com';

const CLINIC_ADMIN_ALPHA_UID = 'clinic_admin_alpha_002';
const CLINIC_ADMIN_ALPHA_EMAIL = 'admin@alpha-clinic.com';

const CLINIC_ADMIN_BETA_UID = 'clinic_admin_beta_003';
const CLINIC_ADMIN_BETA_EMAIL = 'admin@beta-clinic.com';

const PATIENT_USER_UID = 'patient_user_004';
const PATIENT_USER_EMAIL = 'patient.john@example.com';

const OTHER_PATIENT_UID = 'patient_user_005';
const OTHER_PATIENT_EMAIL = 'patient.jane@example.com';

const CLINIC_ALPHA_ID = 'clinic_alpha_101';
const CLINIC_BETA_ID = 'clinic_beta_202';

describe('Firestore Security Rules: RBAC & Privileged Fields Protection', () => {
  beforeAll(async () => {
    const rules = fs.readFileSync(RULES_PATH, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: process.env.FIRESTORE_EMULATOR_HOST?.split(':')[0] || '127.0.0.1',
        port: parseInt(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] || '8080', 10),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed master users and clinic resources using security rules bypass
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // 1. Seed Super Admin profile
      await db.collection('users').doc(SUPER_ADMIN_UID).set({
        uid: SUPER_ADMIN_UID,
        email: SUPER_ADMIN_EMAIL,
        name: 'Primary Super Administrator',
        role: 'SUPER_ADMIN',
        clinicId: '',
        clinicIds: [],
        accessibleClinicIds: [],
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      // 2. Seed Clinic Admin for Clinic Alpha
      await db.collection('users').doc(CLINIC_ADMIN_ALPHA_UID).set({
        uid: CLINIC_ADMIN_ALPHA_UID,
        email: CLINIC_ADMIN_ALPHA_EMAIL,
        name: 'Alpha Clinic Administrator',
        role: 'CLINIC_ADMIN',
        clinicId: CLINIC_ALPHA_ID,
        clinicIds: [CLINIC_ALPHA_ID],
        accessibleClinicIds: [CLINIC_ALPHA_ID],
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      // 3. Seed Clinic Admin for Clinic Beta
      await db.collection('users').doc(CLINIC_ADMIN_BETA_UID).set({
        uid: CLINIC_ADMIN_BETA_UID,
        email: CLINIC_ADMIN_BETA_EMAIL,
        name: 'Beta Clinic Administrator',
        role: 'CLINIC_ADMIN',
        clinicId: CLINIC_BETA_ID,
        clinicIds: [CLINIC_BETA_ID],
        accessibleClinicIds: [CLINIC_BETA_ID],
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      // 4. Seed Patient User
      await db.collection('users').doc(PATIENT_USER_UID).set({
        uid: PATIENT_USER_UID,
        email: PATIENT_USER_EMAIL,
        name: 'John Patient',
        role: 'PATIENT',
        clinicId: CLINIC_ALPHA_ID,
        clinicIds: [CLINIC_ALPHA_ID],
        accessibleClinicIds: [CLINIC_ALPHA_ID],
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      // 5. Seed Other Patient User
      await db.collection('users').doc(OTHER_PATIENT_UID).set({
        uid: OTHER_PATIENT_UID,
        email: OTHER_PATIENT_EMAIL,
        name: 'Jane Patient',
        role: 'PATIENT',
        clinicId: CLINIC_ALPHA_ID,
        clinicIds: [CLINIC_ALPHA_ID],
        accessibleClinicIds: [CLINIC_ALPHA_ID],
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      // 6. Seed Clinics
      await db.collection('clinics').doc(CLINIC_ALPHA_ID).set({
        name: 'Alpha Medical Center',
        slug: 'alpha-medical',
        status: 'ACTIVE',
        address: '100 Health Ave',
        tokenPrefix: 'A',
        createdAt: new Date().toISOString(),
      });

      await db.collection('clinics').doc(CLINIC_BETA_ID).set({
        name: 'Beta Healthcare Clinic',
        slug: 'beta-healthcare',
        status: 'ACTIVE',
        address: '200 Wellness Blvd',
        tokenPrefix: 'B',
        createdAt: new Date().toISOString(),
      });

      // 7. Seed Doctors
      await db.collection('clinics').doc(CLINIC_ALPHA_ID).collection('doctors').doc('doc_1').set({
        name: 'Dr. Gregory House',
        specialization: 'Diagnostics',
        tokenPrefix: 'A',
        status: 'ACTIVE',
      });

      // 8. Seed Patients Subcollection Record
      await db.collection('clinics').doc(CLINIC_ALPHA_ID).collection('patients').doc(OTHER_PATIENT_UID).set({
        userId: OTHER_PATIENT_UID,
        name: 'Jane Patient Private Record',
        phone: '+1 555-0199',
        reason: 'Confidential Cardiology Consultation',
      });

      // 9. Seed Audit Log
      await db.collection('auditLogs').doc('audit_log_001').set({
        actorUid: SUPER_ADMIN_UID,
        actorEmail: SUPER_ADMIN_EMAIL,
        actorRole: 'SUPER_ADMIN',
        action: 'CLINIC_CREATED',
        clinicId: CLINIC_ALPHA_ID,
        timestamp: new Date().toISOString(),
      });
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 1: PATIENT RESTRICTIONS ON PRIVILEGED FIELDS & ROUTES
  // --------------------------------------------------------------------------
  describe('PATIENT Role: Privileged Fields & Multi-Tenant Boundaries', () => {
    let patientContext: RulesTestContext;

    beforeEach(() => {
      patientContext = testEnv.authenticatedContext(PATIENT_USER_UID, {
        email: PATIENT_USER_EMAIL,
      });
    });

    it('DENIES: Patient attempting to elevate own role to SUPER_ADMIN', async () => {
      const db = patientContext.firestore();
      const patientDocRef = db.collection('users').doc(PATIENT_USER_UID);

      await assertFails(
        patientDocRef.update({
          role: 'SUPER_ADMIN',
        })
      );
    });

    it('DENIES: Patient attempting to elevate own role to CLINIC_ADMIN', async () => {
      const db = patientContext.firestore();
      const patientDocRef = db.collection('users').doc(PATIENT_USER_UID);

      await assertFails(
        patientDocRef.update({
          role: 'CLINIC_ADMIN',
        })
      );
    });

    it('DENIES: Patient attempting to elevate own role to DOCTOR or RECEPTIONIST', async () => {
      const db = patientContext.firestore();
      const patientDocRef = db.collection('users').doc(PATIENT_USER_UID);

      await assertFails(
        patientDocRef.update({
          role: 'DOCTOR',
        })
      );
    });

    it('DENIES: Patient attempting to modify privileged clinic access fields (clinicIds / accessibleClinicIds)', async () => {
      const db = patientContext.firestore();
      const patientDocRef = db.collection('users').doc(PATIENT_USER_UID);

      await assertFails(
        patientDocRef.update({
          clinicIds: [CLINIC_ALPHA_ID, CLINIC_BETA_ID, 'unauthorized_clinic_999'],
        })
      );

      await assertFails(
        patientDocRef.update({
          accessibleClinicIds: [CLINIC_ALPHA_ID, CLINIC_BETA_ID],
        })
      );
    });

    it('DENIES: Patient attempting to create a new clinic tenant at root /clinics', async () => {
      const db = patientContext.firestore();
      const rogueClinicRef = db.collection('clinics').doc('rogue_patient_clinic');

      await assertFails(
        rogueClinicRef.set({
          name: 'Unauthorized Patient Clinic',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        })
      );
    });

    it('DENIES: Patient attempting to delete a clinic tenant at /clinics/{clinicId}', async () => {
      const db = patientContext.firestore();
      const clinicRef = db.collection('clinics').doc(CLINIC_ALPHA_ID);

      await assertFails(clinicRef.delete());
    });

    it('DENIES: Patient attempting to update clinic profile or settings', async () => {
      const db = patientContext.firestore();
      const clinicRef = db.collection('clinics').doc(CLINIC_ALPHA_ID);

      await assertFails(
        clinicRef.update({
          name: 'Hacked Alpha Clinic Name',
        })
      );

      const settingsRef = db.collection('clinics').doc(CLINIC_ALPHA_ID).collection('settings').doc('general');
      await assertFails(
        settingsRef.set({
          startingTokenNumber: 999,
        })
      );
    });

    it('DENIES: Patient attempting to create or modify doctor profiles', async () => {
      const db = patientContext.firestore();
      const doctorRef = db.collection('clinics').doc(CLINIC_ALPHA_ID).collection('doctors').doc('doc_2');

      await assertFails(
        doctorRef.set({
          name: 'Dr. Fake Doctor',
          specialization: 'None',
          tokenPrefix: 'F',
          status: 'ACTIVE',
        })
      );
    });

    it('DENIES: Patient attempting to read other patients private medical files', async () => {
      const db = patientContext.firestore();
      const otherPatientDoc = db
        .collection('clinics')
        .doc(CLINIC_ALPHA_ID)
        .collection('patients')
        .doc(OTHER_PATIENT_UID);

      await assertFails(otherPatientDoc.get());
    });

    it('DENIES: Patient attempting to update or delete audit logs in /auditLogs', async () => {
      const db = patientContext.firestore();
      const auditLogRef = db.collection('auditLogs').doc('audit_log_001');

      await assertFails(
        auditLogRef.update({
          action: 'TAMPERED_ACTION',
        })
      );

      await assertFails(auditLogRef.delete());
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: CLINIC ADMIN RESTRICTIONS ON SUPER ADMIN PRIVILEGES
  // --------------------------------------------------------------------------
  describe('CLINIC_ADMIN Role: Super-Admin Privilege Barriers & Tenant Isolation', () => {
    let clinicAdminAlphaContext: RulesTestContext;

    beforeEach(() => {
      clinicAdminAlphaContext = testEnv.authenticatedContext(CLINIC_ADMIN_ALPHA_UID, {
        email: CLINIC_ADMIN_ALPHA_EMAIL,
      });
    });

    it('DENIES: Clinic Admin attempting to elevate own role to SUPER_ADMIN', async () => {
      const db = clinicAdminAlphaContext.firestore();
      const adminDocRef = db.collection('users').doc(CLINIC_ADMIN_ALPHA_UID);

      await assertFails(
        adminDocRef.update({
          role: 'SUPER_ADMIN',
        })
      );
    });

    it('DENIES: Clinic Admin attempting to elevate another user to SUPER_ADMIN', async () => {
      const db = clinicAdminAlphaContext.firestore();
      const patientDocRef = db.collection('users').doc(PATIENT_USER_UID);

      await assertFails(
        patientDocRef.update({
          role: 'SUPER_ADMIN',
        })
      );
    });

    it('DENIES: Clinic Admin attempting to create a new clinic tenant at root /clinics', async () => {
      const db = clinicAdminAlphaContext.firestore();
      const newClinicRef = db.collection('clinics').doc('clinic_gamma_303');

      await assertFails(
        newClinicRef.set({
          name: 'Gamma Medical Hospital',
          slug: 'gamma-medical',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        })
      );
    });

    it('DENIES: Clinic Admin attempting to delete a clinic tenant at root /clinics', async () => {
      const db = clinicAdminAlphaContext.firestore();
      const clinicAlphaRef = db.collection('clinics').doc(CLINIC_ALPHA_ID);

      await assertFails(clinicAlphaRef.delete());
    });

    it('DENIES: Clinic Admin attempting cross-tenant update on another clinic (Clinic Beta)', async () => {
      const db = clinicAdminAlphaContext.firestore();
      const clinicBetaRef = db.collection('clinics').doc(CLINIC_BETA_ID);

      await assertFails(
        clinicBetaRef.update({
          name: 'Compromised Beta Clinic Name',
        })
      );

      const clinicBetaDoctorRef = db
        .collection('clinics')
        .doc(CLINIC_BETA_ID)
        .collection('doctors')
        .doc('beta_doc_1');

      await assertFails(
        clinicBetaDoctorRef.set({
          name: 'Unauthorized Doctor in Beta',
          tokenPrefix: 'B',
          status: 'ACTIVE',
        })
      );
    });

    it('DENIES: Clinic Admin attempting to update or delete audit logs in /auditLogs', async () => {
      const db = clinicAdminAlphaContext.firestore();
      const auditLogRef = db.collection('auditLogs').doc('audit_log_001');

      await assertFails(
        auditLogRef.update({
          action: 'ADMIN_CLEARED_LOGS',
        })
      );

      await assertFails(auditLogRef.delete());
    });

    it('ALLOWS: Clinic Admin managing their own clinic staff and doctors', async () => {
      const db = clinicAdminAlphaContext.firestore();
      const ownClinicDoctorRef = db
        .collection('clinics')
        .doc(CLINIC_ALPHA_ID)
        .collection('doctors')
        .doc('alpha_doc_new');

      await assertSucceeds(
        ownClinicDoctorRef.set({
          name: 'Dr. Allison Cameron',
          specialization: 'Immunology',
          tokenPrefix: 'A',
          status: 'ACTIVE',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: SUPER ADMIN AUTHORIZED PRIVILEGED ACCESS
  // --------------------------------------------------------------------------
  describe('SUPER_ADMIN Role: Full Privileged Access Verification', () => {
    let superAdminContext: RulesTestContext;

    beforeEach(() => {
      superAdminContext = testEnv.authenticatedContext(SUPER_ADMIN_UID, {
        email: SUPER_ADMIN_EMAIL,
      });
    });

    it('ALLOWS: Super Admin creating a new clinic tenant at /clinics', async () => {
      const db = superAdminContext.firestore();
      const newClinicRef = db.collection('clinics').doc('clinic_delta_404');

      await assertSucceeds(
        newClinicRef.set({
          name: 'Delta Specialty Center',
          slug: 'delta-specialty',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        })
      );
    });

    it('ALLOWS: Super Admin assigning SUPER_ADMIN or CLINIC_ADMIN roles to users', async () => {
      const db = superAdminContext.firestore();
      const userRef = db.collection('users').doc(OTHER_PATIENT_UID);

      await assertSucceeds(
        userRef.update({
          role: 'CLINIC_ADMIN',
          clinicId: CLINIC_ALPHA_ID,
        })
      );
    });

    it('ALLOWS: Super Admin updating and managing audit logs', async () => {
      const db = superAdminContext.firestore();
      const auditLogRef = db.collection('auditLogs').doc('audit_log_001');

      await assertSucceeds(
        auditLogRef.update({
          verifiedBy: SUPER_ADMIN_EMAIL,
        })
      );
    });
  });
});
