import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../config/env.js';
import { BlogPostDto, ProfileDto, SkillDto } from '../content/dto.js';
import {
  decrypt,
  encrypt,
  generateRecoveryCodes,
  hmacHex,
  normalizeRecoveryCode,
  safeEqual,
  sha256Hex,
} from './crypto.js';
import { isLocalizedValue } from './localized.js';
import { mongoSanitizeMiddleware, sanitizeValue } from './mongo-sanitize.js';

const KEY = Buffer.alloc(32, 1).toString('base64');

describe('crypto', () => {
  it('round-trips AES-GCM and uses a fresh IV each time', () => {
    const a = encrypt('JBSWY3DPEHPK3PXP', KEY);
    expect(a).not.toContain('JBSWY3DP');
    expect(decrypt(a, KEY)).toBe('JBSWY3DPEHPK3PXP');
    expect(encrypt('JBSWY3DPEHPK3PXP', KEY)).not.toBe(a);
  });

  it('detects tampering and wrong keys', () => {
    const payload = encrypt('secret', KEY);
    const parts = payload.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'), KEY)).toThrow();
    expect(() => decrypt(payload, Buffer.alloc(32, 2).toString('base64'))).toThrow();
    expect(() => decrypt('garbage', KEY)).toThrow('Malformed');
  });

  it('compares in constant time and hashes deterministically', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(sha256Hex('a')).toBe(sha256Hex('a'));
  });

  it('keys the hash of recovery codes: same input and key agree, another key does not', () => {
    expect(hmacHex('a1b2c-3d4e5', KEY)).toBe(hmacHex('a1b2c-3d4e5', KEY));
    expect(hmacHex('a1b2c-3d4e5', KEY)).not.toBe(sha256Hex('a1b2c-3d4e5'));
    expect(hmacHex('a1b2c-3d4e5', KEY)).not.toBe(
      hmacHex('a1b2c-3d4e5', Buffer.alloc(32, 2).toString('base64')),
    );
    expect(hmacHex('a1b2c-3d4e5', KEY)).not.toBe(hmacHex('a1b2c-3d4e6', KEY));
  });

  it('generates unique, normalizable recovery codes', () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    expect(normalizeRecoveryCode('  A1B2C-3D4E5 ')).toBe('a1b2c-3d4e5');
  });
});

describe('mongo sanitize', () => {
  it('strips operator and dotted keys recursively', () => {
    const input = { email: { $gt: '' }, nested: [{ 'a.b': 1, ok: { $where: 'x', fine: true } }] };
    expect(sanitizeValue(input)).toEqual({ email: {}, nested: [{ ok: { fine: true } }] });
  });

  it('also drops keys that reach for an object prototype', () => {
    const input = JSON.parse(
      '{"a":1,"__proto__":{"admin":true},"b":{"constructor":{"x":1},"prototype":2,"c":3}}',
    );
    expect(sanitizeValue(input)).toEqual({ a: 1, b: { c: 3 } });
    expect(({} as Record<string, unknown>)['admin']).toBeUndefined();
  });

  it('sanitizes body, params and query in the middleware', () => {
    const req = { body: { $set: 1, a: 1 }, params: { 'x.y': 1 }, query: { $ne: '1', q: 'ok' } };
    const next = vi.fn();
    mongoSanitizeMiddleware(req as never, {} as never, next);
    expect(req.body).toEqual({ a: 1 });
    expect(req.params).toEqual({});
    expect(req.query).toEqual({ q: 'ok' });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('env', () => {
  const valid = {
    MONGODB_URI: 'mongodb://localhost/x',
    JWT_SECRET: 'x'.repeat(32),
    TOTP_ENCRYPTION_KEY: KEY,
    CORS_ORIGIN: 'http://localhost:4200',
  };

  it('applies secure defaults in production', () => {
    const env = loadEnv({ ...valid, NODE_ENV: 'production' });
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('is permissive in development', () => {
    const env = loadEnv(valid);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.PORT).toBe(3000);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
  });

  it('reads the number of trusted proxies and rejects nonsense', () => {
    expect(loadEnv({ ...valid, TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS).toBe(2);
    expect(() => loadEnv({ ...valid, TRUST_PROXY_HOPS: '-1' })).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => loadEnv({ ...valid, TRUST_PROXY_HOPS: 'many' })).toThrow(/TRUST_PROXY_HOPS/);
  });

  it('knows the deployed commit from GIT_COMMIT or what Render sets', () => {
    expect(loadEnv(valid).GIT_COMMIT).toBeUndefined();
    expect(loadEnv({ ...valid, RENDER_GIT_COMMIT: 'abc1234' }).GIT_COMMIT).toBe('abc1234');
    expect(
      loadEnv({ ...valid, GIT_COMMIT: 'def5678', RENDER_GIT_COMMIT: 'abc1234' }).GIT_COMMIT,
    ).toBe('def5678');
  });

  it('rejects weak or missing secrets', () => {
    expect(() => loadEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...valid, TOTP_ENCRYPTION_KEY: 'AAAA' })).toThrow(/TOTP_ENCRYPTION_KEY/);
    expect(() => loadEnv({})).toThrow(/Invalid environment/);
  });
});

describe('localized values', () => {
  it('requires a non-empty English value and known locales only', () => {
    expect(isLocalizedValue({ en: 'x' }, 10)).toBe(true);
    expect(isLocalizedValue({ en: 'x', fr: '', ar: 'y' }, 10)).toBe(true);
    expect(isLocalizedValue({ fr: 'x' }, 10)).toBe(false);
    expect(isLocalizedValue({ en: '  ' }, 10)).toBe(false);
    expect(isLocalizedValue({ en: 'x', de: 'y' }, 10)).toBe(false);
    expect(isLocalizedValue({ en: 'x'.repeat(11) }, 10)).toBe(false);
    expect(isLocalizedValue({ en: 1 }, 10)).toBe(false);
    expect(isLocalizedValue('x', 10)).toBe(false);
    expect(isLocalizedValue(['x'], 10)).toBe(false);
    expect(isLocalizedValue(null, 10)).toBe(false);
  });
});

describe('content DTO validation', () => {
  const errorsFor = async <T extends object>(dto: new () => T, plain: object) =>
    validate(plainToInstance(dto, plain), { whitelist: true, forbidNonWhitelisted: true });

  it('accepts a valid blog post and rejects bad slugs and missing English', async () => {
    const post = {
      slug: 'hello-world',
      title: { en: 'Hi' },
      excerpt: { en: 'e' },
      body: { en: '# b' },
    };
    expect(await errorsFor(BlogPostDto, post)).toHaveLength(0);
    expect(await errorsFor(BlogPostDto, { ...post, slug: 'Hello World' })).not.toHaveLength(0);
    expect(await errorsFor(BlogPostDto, { ...post, title: { fr: 'Salut' } })).not.toHaveLength(0);
    expect(await errorsFor(BlogPostDto, { ...post, isAdmin: true })).not.toHaveLength(0);
  });

  it('validates nested skill items', async () => {
    const skill = { category: { en: 'Frontend' }, items: [{ name: 'Angular', level: 5 }] };
    expect(await errorsFor(SkillDto, skill)).toHaveLength(0);
    expect(
      await errorsFor(SkillDto, { ...skill, items: [{ name: 'Angular', level: 9 }] }),
    ).not.toHaveLength(0);
  });

  it('only allows http(s) links in the profile', async () => {
    const profile = {
      fullName: 'X',
      headline: { en: 'h' },
      bio: { en: 'b' },
      email: 'a@example.com',
      availability: { status: 'open' },
      socials: [{ kind: 'github', url: 'javascript:alert(1)' }],
    };
    expect(await errorsFor(ProfileDto, profile)).not.toHaveLength(0);
    profile.socials[0]!.url = 'https://github.com/example';
    expect(await errorsFor(ProfileDto, profile)).toHaveLength(0);
  });
});
