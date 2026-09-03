import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { handleCors } from './src/server/corsHelper';
import {
  verifySuperAdminPinValue,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  signSuperAdminSessionToken,
  verifySuperAdminSessionToken,
  validateSuperAdminConfig,
} from './src/server/superAdminSecurity';
import {
  getImageKit,
  isImageKitProperlyConfigured,
  verifyImageKitAuthorization,
  ALLOWED_IMAGEKIT_MIME_TYPES,
  MAX_IMAGEKIT_FILE_SIZE_BYTES,
} from './src/server/imagekitHelper';

// Load environment configuration
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON requests with 10mb limit for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply CORS middleware to API routes
app.use('/api', (req: Request, res: Response, next) => {
  if (handleCors(req, res)) return;
  next();
});

// Helper to get client IP cleanly
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

// ----------------------------------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------------------------------

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
  });
});

// 2. Super Admin Login & PIN Verification Handler (Server-Side Only)
const handleSuperAdminLogin = (req: Request, res: Response) => {
  // Verify server environment configuration (fail closed in production if secret is missing)
  const configCheck = validateSuperAdminConfig();
  if (!configCheck.isConfigured) {
    console.error('[SECURITY AUDIT] Super Admin authentication failed closed due to configuration error:', configCheck.error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_CONFIGURATION_ERROR',
      error: 'Server configuration error: Super Admin authentication credentials are not configured.',
    });
  }

  const clientIp = getClientIp(req);

  // 1. Rate Limiting / Lockout Status
  const rateLimitStatus = checkRateLimit(clientIp);
  if (rateLimitStatus.isLocked) {
    return res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      error: `Too many failed attempts. Super Admin access is temporarily locked for security. Please try again in ${rateLimitStatus.remainingSeconds} seconds.`,
      locked: true,
      remainingSeconds: rateLimitStatus.remainingSeconds,
    });
  }

  const { pin } = req.body || {};

  // 2. Validate PIN input
  if (!pin || typeof pin !== 'string' || !pin.trim()) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_INPUT',
      error: 'Super Admin PIN is required.',
    });
  }

  const cleanPin = pin.trim();

  // 3. Timing-Safe Constant-Time Verification
  const isMatch = verifySuperAdminPinValue(cleanPin);

  if (!isMatch) {
    const failedResult = recordFailedAttempt(clientIp, rateLimitStatus.record);

    if (failedResult.isLocked) {
      console.warn(`[SECURITY AUDIT] Super Admin PIN lockout triggered for IP: ${clientIp}`);
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        error: 'Too many failed attempts. Super Admin access has been temporarily locked for 15 minutes.',
        locked: true,
        remainingSeconds: failedResult.remainingSeconds,
      });
    }

    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      error: 'Invalid Super Admin PIN.',
      remainingAttempts: failedResult.remainingAttempts,
    });
  }

  // 4. Successful Authentication: Reset failed attempts & issue signed session token
  clearFailedAttempts(clientIp);

  const { token, expiresIn, payload } = signSuperAdminSessionToken({
    email: 'superadmin@mediqueue.internal',
    name: 'Super Administrator',
  });

  return res.json({
    success: true,
    sessionToken: token,
    expiresIn,
    user: {
      role: payload.role,
      name: payload.name,
      email: payload.email,
    },
  });
};

app.post('/api/super-admin/login', handleSuperAdminLogin);
app.post('/api/super-admin/verify-pin', handleSuperAdminLogin);

// 3. Super Admin Session Verification Endpoint
app.post('/api/super-admin/verify-session', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Missing authorization header.' });
  }

  const token = authHeader.split(' ')[1];
  const verification = verifySuperAdminSessionToken(token);

  if (!verification.valid || !verification.payload) {
    return res.status(401).json({
      valid: false,
      error: verification.error || 'Session expired or invalid.',
    });
  }

  const remainingSeconds = Math.max(0, Math.ceil((verification.payload.exp - Date.now()) / 1000));

  return res.json({
    valid: true,
    expiresIn: remainingSeconds,
    user: {
      role: verification.payload.role,
      name: verification.payload.name,
      email: verification.payload.email,
    },
  });
});

// 4. Super Admin Logout Endpoint
app.post('/api/super-admin/logout', (_req: Request, res: Response) => {
  return res.json({ success: true, message: 'Super admin session terminated.' });
});

// 5. ImageKit Configuration Discovery Endpoint
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
      details: err?.message,
    });
  }
});

// 7. ImageKit Secure Server-Side Upload Endpoint
app.post('/api/imagekit/upload', async (req: Request, res: Response) => {
  const { file, fileName, clinicId, folderType } = req.body || {};

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
    const simulatedFileId = `ik_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const returnUrl =
      typeof file === 'string' && file.startsWith('data:')
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
    });
  }

  try {
    const uploadResponse = await ik.upload({
      file,
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
  const { fileId, clinicId, folderType } = req.body || {};

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
    console.warn(`[ImageKit] File delete notice for ${fileId}:`, err?.message || err);
    return res.json({ success: true, fileId, warning: err?.message });
  }
});

export { app };

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

// Only start the standalone server when executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
