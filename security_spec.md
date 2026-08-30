# Security Specification: MediQueue RBAC & Privileged Field Protection

## 1. System Invariants & RBAC Access Matrix

| Resource / Action | PATIENT | CLINIC_ADMIN | SUPER_ADMIN | Unauthenticated |
| :--- | :--- | :--- | :--- | :--- |
| **Read `/super-admin` Routes** | ❌ DENIED (Forbidden) | ❌ DENIED (Requires PIN/SuperAdmin) | ✅ ALLOWED | ❌ DENIED |
| **Verify PIN `/api/super-admin/verify-pin`** | ❌ Fails (Invalid PIN) | ❌ Fails (Invalid PIN) | ✅ ALLOWED (Valid PIN) | ❌ DENIED (Lockout on 5 fails) |
| **Update Own Role to `SUPER_ADMIN`** | ❌ PERMISSION_DENIED | ❌ PERMISSION_DENIED | ✅ ALLOWED | ❌ PERMISSION_DENIED |
| **Update Own Role to `CLINIC_ADMIN`** | ❌ PERMISSION_DENIED | ❌ PERMISSION_DENIED | ✅ ALLOWED | ❌ PERMISSION_DENIED |
| **Modify `clinicIds` / Privileged Access** | ❌ PERMISSION_DENIED | ❌ (Cannot grant SUPER_ADMIN) | ✅ ALLOWED | ❌ PERMISSION_DENIED |
| **Create `/clinics/{clinicId}`** | ❌ PERMISSION_DENIED | ❌ PERMISSION_DENIED | ✅ ALLOWED | ❌ PERMISSION_DENIED |
| **Delete `/clinics/{clinicId}`** | ❌ PERMISSION_DENIED | ❌ PERMISSION_DENIED | ✅ ALLOWED | ❌ PERMISSION_DENIED |
| **Cross-Tenant Clinic Updates** | ❌ PERMISSION_DENIED | ❌ PERMISSION_DENIED (Other clinics) | ✅ ALLOWED (All clinics) | ❌ PERMISSION_DENIED |
| **Manage Doctors / Staff** | ❌ PERMISSION_DENIED | ✅ ALLOWED (Own clinic only) | ✅ ALLOWED (All clinics) | ❌ PERMISSION_DENIED |
| **Update / Delete `/auditLogs/{logId}`** | ❌ PERMISSION_DENIED | ❌ PERMISSION_DENIED | ✅ ALLOWED | ❌ PERMISSION_DENIED |
| **Read Other Patients' Data** | ❌ PERMISSION_DENIED | ✅ ALLOWED (Own clinic) | ✅ ALLOWED | ❌ PERMISSION_DENIED |

---

## 2. The "Dirty Dozen" Malicious Payloads (Security Attack Vectors)

1. **Payload 1 (Patient Role Privilege Escalation to SUPER_ADMIN):**
   `PATIENT` sends `updateDoc(/users/patient_123, { role: 'SUPER_ADMIN' })`.
   *Expected Result:* `PERMISSION_DENIED`

2. **Payload 2 (Patient Role Privilege Escalation to CLINIC_ADMIN):**
   `PATIENT` sends `updateDoc(/users/patient_123, { role: 'CLINIC_ADMIN' })`.
   *Expected Result:* `PERMISSION_DENIED`

3. **Payload 3 (Patient Injects Multi-Clinic Access via Privileged Fields):**
   `PATIENT` sends `updateDoc(/users/patient_123, { clinicIds: ['clinic_alpha', 'clinic_beta', 'clinic_gamma'] })`.
   *Expected Result:* `PERMISSION_DENIED`

4. **Payload 4 (Patient Unauthorized Tenant Creation):**
   `PATIENT` sends `setDoc(/clinics/rogue_clinic, { name: 'Rogue Tenant', status: 'ACTIVE' })`.
   *Expected Result:* `PERMISSION_DENIED`

5. **Payload 5 (Patient Unauthorized Tenant Deletion):**
   `PATIENT` sends `deleteDoc(/clinics/valid_clinic)`.
   *Expected Result:* `PERMISSION_DENIED`

6. **Payload 6 (Clinic Admin Escalates Self or Other to SUPER_ADMIN):**
   `CLINIC_ADMIN` sends `updateDoc(/users/clinic_admin_456, { role: 'SUPER_ADMIN' })`.
   *Expected Result:* `PERMISSION_DENIED`

7. **Payload 7 (Clinic Admin Creates New Root Clinic Tenant):**
   `CLINIC_ADMIN` sends `setDoc(/clinics/new_tenant_999, { name: 'Illegal Tenant', status: 'ACTIVE' })`.
   *Expected Result:* `PERMISSION_DENIED` (Root tenant provisioning is reserved strictly for Super Admin).

8. **Payload 8 (Clinic Admin Cross-Tenant Sabotage):**
   `CLINIC_ADMIN` of `clinic_alpha` sends `updateDoc(/clinics/clinic_beta, { name: 'Hacked Beta Clinic' })`.
   *Expected Result:* `PERMISSION_DENIED`

9. **Payload 9 (Clinic Admin Audit Log Tampering / Deletion):**
   `CLINIC_ADMIN` sends `deleteDoc(/auditLogs/security_log_789)` or `updateDoc(/auditLogs/security_log_789, { action: 'CLEARED' })`.
   *Expected Result:* `PERMISSION_DENIED`

10. **Payload 10 (Patient Reads/Modifies Another Patient's Profile):**
    `PATIENT` (`uid: patient_123`) sends `getDoc(/clinics/clinic_alpha/patients/patient_999)` or `updateDoc(...)`.
    *Expected Result:* `PERMISSION_DENIED`

11. **Payload 11 (Unauthenticated / Patient Route Access to /super-admin):**
    `PATIENT` or unauthenticated client accesses route `/super-admin/dashboard` or `/admin/super-admin`.
    *Expected Result:* Route Guard blocks access with `isAuthorized: false` and renders Forbidden status.

12. **Payload 12 (Brute Force PIN Attack on /api/super-admin/verify-pin):**
    Attacker sends 5 consecutive invalid PIN attempts to `/api/super-admin/verify-pin`.
    *Expected Result:* 429 Too Many Requests with IP lockout enforced.
