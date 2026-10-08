import type { NextFunction, Request, Response } from 'express';

/** Sign-in and back-office responses are private: no browser, proxy or CDN may keep a copy. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.set('Cache-Control', 'no-store');
  next();
}
