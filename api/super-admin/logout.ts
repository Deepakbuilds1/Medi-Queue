import type { Request, Response } from 'express';
import { handleCors } from '../../src/server/corsHelper';

export default function handler(req: Request, res: Response) {
  if (handleCors(req, res)) return;

  return res.status(200).json({
    success: true,
    message: 'Super admin session terminated successfully.',
  });
}
