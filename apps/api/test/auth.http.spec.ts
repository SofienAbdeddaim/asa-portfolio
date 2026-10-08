import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthApp, totpCode } from './auth-harness.js';

const EMAIL = 'admin@example.com';
const PASSWORD = 'correct horse battery staple';
const ORIGIN = 'http://localhost:4200';

const cookiesOf = (res: request.Response): string[] =>
  (res.headers['set-cookie'] as unknown as string[]) ?? [];
const cookieHeader = (res: request.Response): string[] =>
  cookiesOf(res).map((c) => c.split(';')[0] as string);

describe('auth over HTTP', () => {
  let app: INestApplication;
  let sessions: Awaited<ReturnType<typeof createAuthApp>>['sessions'];

  beforeEach(async () => {
    const harness = await createAuthApp();
    app = harness.app;
    sessions = harness.sessions;
    await harness.auth.createAdmin(EMAIL, PASSWORD);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function enroll() {
    const login = await http()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    expect(login.body.mfaEnrolled).toBe(false);
    const { challenge } = login.body as { challenge: string };
    const setup = await http().post('/api/auth/2fa/setup').send({ challenge }).expect(200);
    const secret = setup.body.secret as string;
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/');
    expect(setup.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const enable = await http()
      .post('/api/auth/2fa/enable')
      .send({ challenge, code: totpCode(secret) })
      .expect(200);
    return { secret, enable };
  }

  it('rejects wrong credentials without revealing whether the email exists', async () => {
    const wrongPassword = await http()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'nope-nope-nope' });
    const unknownUser = await http()
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'nope-nope-nope' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body.message).toBe(wrongPassword.body.message);
  });

  it('never lets a sign-in response be cached', async () => {
    const login = await http()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    expect(login.headers['cache-control']).toBe('no-store');
    const refused = await http().get('/api/auth/me').expect(401);
    expect(refused.headers['cache-control']).toBe('no-store');
  });

  it('validates the body strictly', async () => {
    await http().post('/api/auth/login').send({ email: 'not-an-email', password: 'x' }).expect(400);
    await http()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'x', admin: true })
      .expect(400);
  });

  it('does not let NoSQL operators through', async () => {
    await http()
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: 'x' })
      .expect(400);
  });

  it('enrolls 2FA on first login and sets httpOnly session cookies', async () => {
    const { enable } = await enroll();
    expect(enable.body.recoveryCodes).toHaveLength(10);
    expect(enable.body).not.toHaveProperty('accessToken');
    const cookies = cookiesOf(enable);
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
    }
    expect(cookies.find((c) => c.startsWith('refresh_token='))).toMatch(/Path=\/api\/auth/);

    const me = await http().get('/api/auth/me').set('Cookie', cookieHeader(enable)).expect(200);
    expect(me.body.email).toBe(EMAIL);
  });

  it('requires the second factor on later logins and rejects replayed codes', async () => {
    const { secret } = await enroll();
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 31_000 });

    const login = await http()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    expect(login.body.mfaEnrolled).toBe(true);
    const { challenge } = login.body as { challenge: string };

    await http().post('/api/auth/2fa/verify').send({ challenge, code: '000000' }).expect(401);
    const code = totpCode(secret);
    await http().post('/api/auth/2fa/verify').send({ challenge, code }).expect(200);
    await http().post('/api/auth/2fa/verify').send({ challenge, code }).expect(401);
  });

  it('accepts a recovery code exactly once', async () => {
    const { enable } = await enroll();
    const recoveryCode = (enable.body.recoveryCodes as string[])[0] as string;
    const { body } = await http()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    await http()
      .post('/api/auth/2fa/verify')
      .send({ challenge: body.challenge, recoveryCode })
      .expect(200);
    await http()
      .post('/api/auth/2fa/verify')
      .send({ challenge: body.challenge, recoveryCode })
      .expect(401);
  });

  it('does not accept a challenge token as an access token (or the reverse)', async () => {
    const login = await http()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    await http()
      .get('/api/auth/me')
      .set('Cookie', [`access_token=${login.body.challenge}`])
      .expect(401);

    const { enable } = await enroll();
    const access = cookieHeader(enable)
      .find((c) => c.startsWith('access_token='))
      ?.split('=')[1] as string;
    await http().post('/api/auth/2fa/setup').send({ challenge: access }).expect(401);
  });

  it('protects /me without a cookie', async () => {
    await http().get('/api/auth/me').expect(401);
  });

  it('rotates refresh tokens and revokes all sessions when an old one is replayed', async () => {
    const { enable } = await enroll();
    const refreshCookie = cookieHeader(enable).find((c) =>
      c.startsWith('refresh_token='),
    ) as string;

    const rotated = await http()
      .post('/api/auth/refresh')
      .set('Cookie', [refreshCookie])
      .expect(200);
    const newRefresh = cookieHeader(rotated).find((c) => c.startsWith('refresh_token=')) as string;
    expect(newRefresh).not.toBe(refreshCookie);

    await http().post('/api/auth/refresh').set('Cookie', [refreshCookie]).expect(401);
    expect(sessions.rows).toHaveLength(0);
    await http().post('/api/auth/refresh').set('Cookie', [newRefresh]).expect(401);
  });

  it('logs out by deleting the session and clearing cookies', async () => {
    const { enable } = await enroll();
    const res = await http()
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader(enable))
      .expect(204);
    expect(cookiesOf(res).every((c) => /Expires=Thu, 01 Jan 1970/.test(c))).toBe(true);
    expect(sessions.rows).toHaveLength(0);
  });

  it('rejects state-changing requests from a foreign origin', async () => {
    await http()
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(403);
    await http()
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
  });

  it('sends security headers and hides the framework', async () => {
    const res = await http().get('/api/auth/me');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
