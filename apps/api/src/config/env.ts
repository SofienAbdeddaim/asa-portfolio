import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((value) => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /** 32 random bytes, base64 encoded. Encrypts TOTP secrets at rest. */
  TOTP_ENCRYPTION_KEY: z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
    message: 'TOTP_ENCRYPTION_KEY must be 32 bytes, base64 encoded',
  }),
  TOTP_ISSUER: z.string().min(1).default('ASA Portfolio'),
  CORS_ORIGIN: z.string().url(),
  /** Defaults to true in production; must stay true unless serving over plain HTTP locally. */
  COOKIE_SECURE: bool.optional(),
  SWAGGER_ENABLED: bool.optional(),
  /**
   * Reverse proxies in front of the API, used to find the real client IP for rate limiting.
   * 1 for a direct platform load balancer; 2 when another proxy sits in front of it (for example
   * the site host forwarding /api to the API host).
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  /** The deployed commit, shown by /api/health so a deployment can be verified. */
  GIT_COMMIT: z.string().optional(),
  /** Set by Render on every deploy; used when GIT_COMMIT is not. */
  RENDER_GIT_COMMIT: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = Omit<z.infer<typeof schema>, 'COOKIE_SECURE' | 'SWAGGER_ENABLED'> & {
  COOKIE_SECURE: boolean;
  SWAGGER_ENABLED: boolean;
};

export const ENV = Symbol('ENV');

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  const production = result.data.NODE_ENV === 'production';
  return {
    ...result.data,
    GIT_COMMIT: result.data.GIT_COMMIT ?? result.data.RENDER_GIT_COMMIT,
    COOKIE_SECURE: result.data.COOKIE_SECURE ?? production,
    SWAGGER_ENABLED: result.data.SWAGGER_ENABLED ?? !production,
  };
}
