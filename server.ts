import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import ImageKit from 'imagekit';
import { createServer as createViteServer } from 'vite';

// Load environment configuration
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON requests with 10mb limit for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------------------------------------------------------------------
// IMAGEKIT SECURE SERVER-SIDE CLIENT CONFIGURATION
// ----------------------------------------------------------------------------
// PRIVATE KEY is strictly held on the server and NEVER exposed to frontend

let imagekitInstance: ImageKit | null = null;

function isImageKitProperlyConfigured(): boolean {
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

function getImageKit(): ImageKit | null {
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
// IMAGEKIT SECURE API ENDPOINTS
// ----------------------------------------------------------------------------

export const ALLOWED_IMAGEKIT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/gif'
];

export const MAX_IMAGEKIT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

interface ImageKitAuthCheck {
  authorized: boolean;
  role: string;
  reason?: string;
  isSuperAdmin: boolean;
}

function verifyImageKitAuthorization(
  req: Request,
  targetClinicId: string,
  folderType: string
): ImageKitAuthCheck {
  const authHeader = req.headers.authorization;
  const clientToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  // 1. Check Super Admin session token
  if (clientToken) {
    const session = activeSuperAdminSessions.get(clientToken);
    if (session && session.expiresAt > Date.now()) {
      return { authorized: true, role: 'SUPER_ADMIN', isSuperAdmin: true };
    }
  }

  // 2. Check user headers passed from authenticated client
  const roleHeader = ((req.headers['x-user-role'] as string) || '').toUpperCase();
  const userClinicId = ((req.headers['x-user-clinic-id'] as string) || '').trim();
  const accessibleClinicsRaw = (req.headers['x-accessible-clinic-ids'] as string) || '';
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
        reason: `Forbidden: Patients cannot access admin ImageKit folder '${folderType}'. Only patient avatar uploads are permitted.`,
      };
    }
    return { authorized: true, role: 'PATIENT', isSuperAdmin: false };
  }

  // Staff (Doctor / Receptionist)
  if (roleHeader === 'DOCTOR' || roleHeader === 'RECEPTIONIST') {
    const hasClinicAccess =
      !cleanTargetClinicId ||
      userClinicId === cleanTargetClinicId ||
      accessibleClinicIds.includes(cleanTargetClinicId);

    if (!hasClinicAccess) {
      return {
        authorized: false,
        role: roleHeader,
        isSuperAdmin: false,
        reason: 'Forbidden: Staff cannot modify media for another clinic.',
      };
    }
    return { authorized: true, role: roleHeader, isSuperAdmin: false };
  }

  // Fallback check: if no explicit role, but valid Super Admin session wasn't found
  return {
    authorized: false,
    role: 'ANONYMOUS',
    isSuperAdmin: false,
    reason: 'Unauthorized: Valid credentials required for ImageKit operations.',
  };
}

// 5. ImageKit Configuration & Public Parameters
// NOTE: IMAGEKIT_PRIVATE_KEY is NEVER exposed here or anywhere on client
app.get('/api/imagekit/config', (_req: Request, res: Response) => {
  const isConfigured = isImageKitProperlyConfigured();
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || '';
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || '';

  return res.json({
    isConfigured,
    publicKey: isConfigured ? publicKey : '',
    urlEndpoint: isConfigured ? urlEndpoint : '',
    allowedMimeTypes: ALLOWED_IMAGEKIT_MIME_TYPES,
    maxFileSizeBytes: MAX_IMAGEKIT_FILE_SIZE_BYTES,
  });
});

// 6. ImageKit Client-Side Upload Authentication Parameters
app.get('/api/imagekit/auth', (req: Request, res: Response) => {
  const clinicId = (req.query.clinicId as string) || '';
  const folderType = (req.query.folderType as string) || 'media';

  const authCheck = verifyImageKitAuthorization(req, clinicId, folderType);
  if (!authCheck.authorized) {
    return res.status(403).json({
      error: authCheck.reason || 'Forbidden: Unauthorized ImageKit access.',
      authorized: false,
    });
  }

  const ik = getImageKit();
  if (!ik) {
    // If not configured, provide mock signature for development testing
    const expire = Math.floor(Date.now() / 1000) + 1800;
    const token = crypto.randomUUID();
    return res.json({
      token,
      expire,
      signature: 'mock_signature_dev_mode',
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',
      isConfigured: false,
      folder: `/clinics/${clinicId}/${folderType}`,
    });
  }

  try {
    const authParams = ik.getAuthenticationParameters();
    return res.json({
      ...authParams,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      isConfigured: true,
      folder: `/clinics/${clinicId}/${folderType}`,
    });
  } catch (err: any) {
    console.error('ImageKit getAuthenticationParameters error:', err);
    return res.status(500).json({
      error: 'Failed to generate ImageKit authentication parameters.',
      details: err.message,
    });
  }
});

// 7. ImageKit Secure Server-Side Upload Endpoint
app.post('/api/imagekit/upload', async (req: Request, res: Response) => {
  const { file, fileName, clinicId, folderType, customMetadata } = req.body;

  if (!file) {
    return res.status(400).json({ error: 'File content (Base64 string or data URL) is required.' });
  }

  if (!clinicId || typeof clinicId !== 'string' || !clinicId.trim()) {
    return res.status(400).json({ error: 'Valid clinicId is required.' });
  }

  const validFolders = ['logo', 'doctors', 'patients', 'media'];
  const cleanFolderType = validFolders.includes(folderType) ? folderType : 'media';
  const cleanClinicId = clinicId.trim();

  // Multi-tenant authorization guard
  const authCheck = verifyImageKitAuthorization(req, cleanClinicId, cleanFolderType);
  if (!authCheck.authorized) {
    return res.status(403).json({
      error: authCheck.reason || 'Forbidden: Multi-tenant media isolation violation.',
    });
  }

  // Validate MIME type if data URL
  if (typeof file === 'string' && file.startsWith('data:')) {
    const mimeMatch = file.match(/^data:([^;]+);base64,/);
    if (mimeMatch) {
      const mime = mimeMatch[1].toLowerCase();
      if (!ALLOWED_IMAGEKIT_MIME_TYPES.includes(mime)) {
        return res.status(400).json({
          error: `Invalid file MIME type '${mime}'. Allowed formats: PNG, JPG, JPEG, WEBP, SVG, GIF.`,
        });
      }
    }
  }

  // Enforce folder hierarchy: /clinics/{clinicId}/{folderType}/
  const targetFolder = `/clinics/${cleanClinicId}/${cleanFolderType}`;
  const rawFileName = fileName || 'upload.png';
  const sanitizedName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueFileName = `${cleanFolderType}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}_${sanitizedName}`;

  const ik = getImageKit();

  if (!ik) {
    // Graceful fallback for sandboxed development if ImageKit credentials not configured in env
    console.info(`[ImageKit Server] Emulating secure storage for folder ${targetFolder}/${uniqueFileName}`);
    const simulatedFileId = `ik_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const returnUrl = typeof file === 'string' && file.startsWith('data:') 
      ? file 
      : `https://ik.imagekit.io/mediqueue_demo${targetFolder}/${uniqueFileName}`;

    return res.json({
      success: true,
      fileId: simulatedFileId,
      url: returnUrl,
      name: uniqueFileName,
      folder: targetFolder,
      size: typeof file === 'string' ? Math.round(file.length * 0.75) : 1024,
      thumbnailUrl: returnUrl,
      uploadedAt: new Date().toISOString(),
      isConfigured: false,
      notice: 'Operating in secure resilient fallback mode until live IMAGEKIT_PRIVATE_KEY is supplied.',
    });
  }

  try {
    const uploadResponse = await ik.upload({
      file, // can be base64 string, URL, or buffer
      fileName: uniqueFileName,
      folder: targetFolder,
      useUniqueFileName: true,
      tags: [cleanClinicId, cleanFolderType, 'mediqueue'],
    });

    return res.json({
      success: true,
      fileId: uploadResponse.fileId,
      url: uploadResponse.url,
      name: uploadResponse.name,
      folder: uploadResponse.filePath || targetFolder,
      size: uploadResponse.size,
      thumbnailUrl: uploadResponse.thumbnailUrl || uploadResponse.url,
      uploadedAt: new Date().toISOString(),
      isConfigured: true,
    });
  } catch (uploadError: any) {
    console.error('ImageKit upload exception:', uploadError);
    const errorMessage = uploadError?.message || uploadError?.help || 'ImageKit upload failed.';
    return res.status(500).json({
      error: errorMessage,
      details: uploadError,
    });
  }
});

// 8. ImageKit Secure Delete Endpoint
app.post('/api/imagekit/delete', async (req: Request, res: Response) => {
  const { fileId, clinicId, folderType } = req.body;

  if (!fileId || typeof fileId !== 'string' || !fileId.trim()) {
    return res.status(400).json({ error: 'fileId is required for deletion.' });
  }

  const cleanClinicId = (clinicId || '').trim();
  const cleanFolderType = (folderType || 'media').trim();

  // Multi-tenant authorization guard
  const authCheck = verifyImageKitAuthorization(req, cleanClinicId, cleanFolderType);
  if (!authCheck.authorized) {
    return res.status(403).json({
      error: authCheck.reason || 'Forbidden: Unauthorized to delete media for this clinic.',
    });
  }

  // If simulated mock ID, simply return success
  if (fileId.startsWith('ik_sim_') || fileId.startsWith('ik_mock_')) {
    return res.json({ success: true, fileId, simulated: true });
  }

  const ik = getImageKit();
  if (!ik) {
    return res.json({ success: true, fileId, isConfigured: false });
  }

  try {
    await ik.deleteFile(fileId);
    return res.json({ success: true, fileId, deletedAt: new Date().toISOString() });
  } catch (err: any) {
    console.warn(`[ImageKit] File delete notice for ${fileId}:`, err.message || err);
    // Return success to avoid blocking UI if file was already removed
    return res.json({ success: true, fileId, warning: err.message });
  }
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
