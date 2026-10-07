import type { NextFunction, Request, Response } from 'express';

/** Removes keys that could be interpreted as Mongo operators (`$...`) or paths (`a.b`). */
export function sanitizeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => sanitizeValue(item));
    return value;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete record[key];
      } else {
        sanitizeValue(record[key]);
      }
    }
  }
  return value;
}

export function mongoSanitizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  sanitizeValue(req.body);
  sanitizeValue(req.params);
  // `req.query` is a getter in Express 5, so it is replaced rather than mutated.
  Object.defineProperty(req, 'query', {
    value: sanitizeValue({ ...req.query }),
    writable: true,
    configurable: true,
  });
  next();
}
