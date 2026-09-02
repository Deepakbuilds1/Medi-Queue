import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';
import { getImageKit, verifyImageKitAuthorization } from '../../src/server/imagekitHelper';

export default async function handler(req: Request, res: Response) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST is required.' });
  }

  const { fileId, clinicId, folderType } = req.body || {};

  if (!fileId || typeof fileId !== 'string' || !fileId.trim()) {
    return res.status(400).json({ error: 'fileId is required for deletion.' });
  }

  const cleanClinicId = (clinicId || '').trim();
  const cleanFolderType = (folderType || 'media').trim();

  const authCheck = verifyImageKitAuthorization(req, cleanClinicId, cleanFolderType);
  if (!authCheck.authorized) {
    return res.status(403).json({
      error: authCheck.reason || 'Forbidden: Unauthorized to delete media for this clinic.',
    });
  }

  if (fileId.startsWith('ik_sim_') || fileId.startsWith('ik_mock_')) {
    return res.status(200).json({ success: true, fileId, simulated: true });
  }

  const ik = getImageKit();
  if (!ik) {
    return res.status(200).json({ success: true, fileId, isConfigured: false });
  }

  try {
    await ik.deleteFile(fileId);
    return res.status(200).json({ success: true, fileId, deletedAt: new Date().toISOString() });
  } catch (err: any) {
    return res.status(200).json({ success: true, fileId, warning: err?.message });
  }
}
