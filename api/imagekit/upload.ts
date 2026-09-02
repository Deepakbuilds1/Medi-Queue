import type { Request, Response } from 'express';
import crypto from 'crypto';
import { handleCors } from '../../src/server/corsHelper';
import {
  getImageKit,
  verifyImageKitAuthorization,
  ALLOWED_IMAGEKIT_MIME_TYPES,
} from '../../src/server/imagekitHelper';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: Request, res: Response) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST is required.' });
  }

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

  const authCheck = verifyImageKitAuthorization(req, cleanClinicId, cleanFolderType);
  if (!authCheck.authorized) {
    return res.status(403).json({
      error: authCheck.reason || 'Forbidden: Multi-tenant media isolation violation.',
    });
  }

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

    return res.status(200).json({
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

    return res.status(200).json({
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
    return res.status(500).json({
      error: uploadError?.message || uploadError?.help || 'ImageKit upload failed.',
      details: uploadError,
    });
  }
}
