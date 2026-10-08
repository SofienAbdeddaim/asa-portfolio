import { randomBytes } from 'node:crypto';

/**
 * Settings shared by the servers Playwright starts, the global setup and the tests. Secrets are
 * generated per run and handed down through the environment (workers inherit it), so nothing
 * secret or default lives in the repository.
 */
const fresh = (name: string, make: () => string): string => (process.env[name] ??= make());

export const API_PORT = 3100;
export const WEB_PORT = 4300;
export const BASE_URL = `http://localhost:${WEB_PORT}`;

/** The database must end in `_e2e`: the reset script refuses to drop anything else. */
export const MONGODB_URI =
  process.env['E2E_MONGODB_URI'] ?? 'mongodb://127.0.0.1:27017/portfolio_e2e';

export const ADMIN_EMAIL = fresh('E2E_ADMIN_EMAIL', () => 'e2e-admin@example.test');
export const ADMIN_PASSWORD = fresh('E2E_ADMIN_PASSWORD', () =>
  randomBytes(18).toString('base64url'),
);

export const apiEnv = {
  NODE_ENV: 'production',
  PORT: String(API_PORT),
  MONGODB_URI,
  JWT_SECRET: fresh('E2E_JWT_SECRET', () => randomBytes(48).toString('base64url')),
  TOTP_ENCRYPTION_KEY: fresh('E2E_TOTP_KEY', () => randomBytes(32).toString('base64')),
  CORS_ORIGIN: BASE_URL,
  // Plain HTTP on localhost: Secure cookies would never be sent back.
  COOKIE_SECURE: 'false',
  SWAGGER_ENABLED: 'false',
  TRUST_PROXY_HOPS: '1',
  LOG_LEVEL: 'warn',
};
