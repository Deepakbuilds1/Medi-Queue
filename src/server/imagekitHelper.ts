import ImageKit from 'imagekit';
import crypto from 'crypto';
import type { Request } from 'express';
import { verifySuperAdminSessionToken, extractSessionToken } from './superAdminSecurity.ts';
import { verifyFirebaseIdToken } from '../../api/_lib/firebaseAdmin.ts';

export const ALLOWED_IMAGEKIT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
];

export const MAX_IMAGEKIT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

let imagekitInstance: ImageKit | null = null;

export function isImageKitProperlyConfigured(): boolean {
  const pub = process.env.IMAGEKIT_PUBLIC_KEY;
  const priv = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEp = process.env.IMAGEKIT_URL_ENDPOINT;

  return Boolean(
    pub &&
      priv &&
      urlEp &&
      !pub.startsWith('your_') &&
      !priv.startsWith('your_') &&
      !urlEp.includes('your_imagekit_id')
  );
}

export function getImageKit(): ImageKit | null {
  if (!isImageKitProperlyConfigured()) {
    return null;
  }

  if (!imagekitInstance) {
    imagekitInstance = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
    });
  }
  return imagekitInstance;
}

export interface ImageKitAuthCheck {
  authorized: boolean;
  role: string;
  reason?: string;
  isSuperAdmin: boolean;
}

export async function verifyImageKitAuthorization(
  req: Request,
  targetClinicId: string,
  folderType: string
): Promise<ImageKitAuthCheck> {
  // 1. Check Super Admin session token (Bearer header or HttpOnly cookie)
  const sessionToken = extractSessionToken(req);
  if (sessionToken) {
    const verified = verifySuperAdminSessionToken(sessionToken);
    if (verified.valid) {
      return { authorized: true, role: 'SUPER_ADMIN', isSuperAdmin: true };
    }
  }

  // 2. Check for Firebase ID Token in Authorization header
  let isVerifiedFirebaseUser = false;
  let verifiedEmail: string | undefined;
  const authHeader = (req.headers?.authorization || '') as string;
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer && !bearer.startsWith('super_admin_')) {
      const fbCheck = await verifyFirebaseIdToken(bearer);
      if (fbCheck.valid) {
        isVerifiedFirebaseUser = true;
        verifiedEmail = fbCheck.email;
      }
    }
  }

  // 3. Check user role and clinic headers
  const roleHeader = ((req.headers?.['x-user-role'] as string) || '').toUpperCase();
  const userClinicId = ((req.headers?.['x-user-clinic-id'] as string) || '').trim();
  const accessibleClinicsRaw = (req.headers?.['x-accessible-clinic-ids'] as string) || '';
  const accessibleClinicIds = accessibleClinicsRaw ? accessibleClinicsRaw.split(',').map((s) => s.trim()) : [];
  const cleanTargetClinicId = (targetClinicId || '').trim();
  const isWriteOperation = req.method === 'POST' || req.method === 'DELETE' || req.method === 'PUT';

  // Super Admin role header cannot be claimed without verified cryptographic token
  if (roleHeader === 'SUPER_ADMIN') {
    if (verifiedEmail === 'medi@gmail.com') {
      return { authorized: true, role: 'SUPER_ADMIN', isSuperAdmin: true };
    }
    return {
      authorized: false,
      role: 'SUPER_ADMIN',
      isSuperAdmin: false,
      reason: 'Super Administrator media operations require a verified cryptographic session token.',
    };
  }

  // Clinic Admin role: Write operations require authenticated session
  if (roleHeader === 'CLINIC_ADMIN' || roleHeader === 'ADMIN') {
    if (isWriteOperation && !isVerifiedFirebaseUser && process.env.NODE_ENV === 'production') {
      return {
        authorized: false,
        role: roleHeader,
        isSuperAdmin: false,
        reason: 'Authentication token required for clinic administrative media operations.',
      };
    }

    const hasClinicAccess =
      !cleanTargetClinicId ||
      userClinicId === cleanTargetClinicId ||
      accessibleClinicIds.includes(cleanTargetClinicId);

    if (!hasClinicAccess) {
      return {
        authorized: false,
        role: roleHeader,
        isSuperAdmin: false,
        reason: `Multi-tenant violation: Clinic admin for '${userClinicId}' is forbidden from modifying media for clinic '${cleanTargetClinicId}'.`,
      };
    }

    return { authorized: true, role: 'CLINIC_ADMIN', isSuperAdmin: false };
  }

  // Patient role: write operations restricted strictly to patient folder
  if (roleHeader === 'PATIENT') {
    if (folderType !== 'patients') {
      return {
        authorized: false,
        role: 'PATIENT',
        isSuperAdmin: false,
        reason: 'Patient accounts are restricted to patient-specific media folders.',
      };
    }
    return { authorized: true, role: 'PATIENT', isSuperAdmin: false };
  }

  // Unauthenticated read / public config allowed for logo fetching or general views
  if (!roleHeader && !isWriteOperation) {
    if (folderType === 'logo' || folderType === 'media') {
      return { authorized: true, role: 'ANONYMOUS', isSuperAdmin: false };
    }
  }

  // Unauthenticated write operations are forbidden
  if (isWriteOperation && !isVerifiedFirebaseUser) {
    return {
      authorized: false,
      role: roleHeader || 'UNAUTHENTICATED',
      isSuperAdmin: false,
      reason: 'Authentication required for media modification.',
    };
  }

  return { authorized: false, role: roleHeader || 'UNKNOWN', isSuperAdmin: false, reason: 'Unauthorized access.' };
}
