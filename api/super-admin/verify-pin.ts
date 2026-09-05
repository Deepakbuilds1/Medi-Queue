import type { Request, Response } from 'express';
import loginHandler from './login.ts';

export default function handler(req: Request, res: Response) {
  return loginHandler(req, res);
}
