import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from './token.service.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/** The refresh cookie is only sent to the auth routes, the access cookie to the whole API. */
const REFRESH_PATH = '/api/auth';
const ACCESS_PATH = '/api';

const base = (env: Pick<Env, 'COOKIE_SECURE'>): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict',
});

export function setSessionCookies(
  res: Response,
  env: Pick<Env, 'COOKIE_SECURE'>,
  tokens: { accessToken: string; refreshToken: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base(env),
    path: ACCESS_PATH,
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(env),
    path: REFRESH_PATH,
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookies(res: Response, env: Pick<Env, 'COOKIE_SECURE'>): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(env), path: ACCESS_PATH });
  res.clearCookie(REFRESH_COOKIE, { ...base(env), path: REFRESH_PATH });
}
