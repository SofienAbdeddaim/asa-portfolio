import type { NextFunction, Request, Response } from 'express';

/** Keys that would let input reach an object's prototype. */
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Removes keys that could be interpreted as Mongo operators (`$...`) or paths (`a.b`), or that
 * target an object's prototype.
 */
export function sanitizeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => sanitizeValue(item));
    return value;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key.startsWith('$') || key.includes('.') || PROTOTYPE_KEYS.has(key)) {
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
