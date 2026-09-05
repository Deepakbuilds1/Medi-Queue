import type { Request, Response } from 'express';
import crypto from 'crypto';
import { handleCors } from '../_lib/cors.ts';
import { getImageKit, verifyImageKitAuthorization } from '../../src/server/imagekitHelper.ts';

export default function handler(req: Request, res: Response) {
  if (handleCors(req, res)) return;

  const clinicId = (req.query?.clinicId as string) || '';
  const folderType = (req.query?.folderType as string) || 'media';

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
    return res.status(200).json({
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
    return res.status(200).json({
      ...authParams,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      isConfigured: true,
      folder: `/clinics/${clinicId}/${folderType}`,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Failed to generate ImageKit authentication parameters.',
      details: err?.message,
    });
  }
}
