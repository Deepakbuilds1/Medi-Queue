import type { Request, Response } from 'express';
import { handleSuperAdminAuth } from './auth';

export default async function handler(req: Request | any, res: Response | any) {
  return handleSuperAdminAuth(req, res);
}
