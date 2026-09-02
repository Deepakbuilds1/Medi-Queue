import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';
import {
  isImageKitProperlyConfigured,
  ALLOWED_IMAGEKIT_MIME_TYPES,
  MAX_IMAGEKIT_FILE_SIZE_BYTES,
} from '../../src/server/imagekitHelper';

export default function handler(req: Request, res: Response) {
  if (handleCors(req, res)) return;

  const isConfigured = isImageKitProperlyConfigured();
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || '';
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || '';

  return res.status(200).json({
    isConfigured,
    publicKey: isConfigured ? publicKey : '',
    urlEndpoint: isConfigured ? urlEndpoint : '',
    allowedMimeTypes: ALLOWED_IMAGEKIT_MIME_TYPES,
    maxFileSizeBytes: MAX_IMAGEKIT_FILE_SIZE_BYTES,
  });
}
