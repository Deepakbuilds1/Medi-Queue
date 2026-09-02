import ImageKit from 'imagekit';
import crypto from 'crypto';
import type { Request } from 'express';
import { verifySuperAdminSessionToken } from './superAdminSecurity';

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

export function verifyImageKitAuthorization(
  req: Request,
  targetClinicId: string,
  folderType: string
): ImageKitAuthCheck {
  const authHeader = req.headers?.authorization;
  const clientToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  // 1. Check Super Admin session token
  if (clientToken) {
    const verified = verifySuperAdminSessionToken(clientToken);
    if (verified.valid) {
      return { authorized: true, role: 'SUPER_ADMIN', isSuperAdmin: true };
    }
  }

  // 2. Check user headers passed from authenticated client
  const roleHeader = ((req.headers?.['x-user-role'] as string) || '').toUpperCase();
  const userClinicId = ((req.headers?.['x-user-clinic-id'] as string) || '').trim();
  const accessibleClinicsRaw = (req.headers?.['x-accessible-clinic-ids'] as string) || '';
  const accessibleClinicIds = accessibleClinicsRaw ? accessibleClinicsRaw.split(',').map((s) => s.trim()) : [];
  const cleanTargetClinicId = (targetClinicId || '').trim();

  // Super Admin role header
  if (roleHeader === 'SUPER_ADMIN') {
    return { authorized: true, role: 'SUPER_ADMIN', isSuperAdmin: true };
  }

  // Clinic Admin role
  if (roleHeader === 'CLINIC_ADMIN' || roleHeader === 'ADMIN') {
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

  // Patient role
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

  // Unauthenticated/public allowed for logo fetching or general views
  if (!roleHeader) {
    if (folderType === 'logo' || folderType === 'media') {
      return { authorized: true, role: 'ANONYMOUS', isSuperAdmin: false };
    }
  }

  return { authorized: false, role: roleHeader || 'UNKNOWN', isSuperAdmin: false, reason: 'Unauthorized access.' };
}
