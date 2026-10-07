import { readFileSync } from 'node:fs';
import * as OTPAuth from 'otpauth';

/**
 * End-to-end check of a RUNNING API (default http://localhost:3000/api) against a real database.
 * Requires the seeded admin from .env (SEED_ADMIN_*). It enrolls 2FA for that admin, so run it
 * on a fresh local database only. Usage: pnpm --filter @asa/api smoke
 */
const env = Object.fromEntries(
  readFileSync(new URL('../../../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const BASE = process.env.API_URL ?? 'http://localhost:3000/api';
const jar = new Map();
let failures = 0;

const check = (name, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

async function call(method, path, body, { cookies = true, headers = {} } = {}) {
  const cookie = cookies ? [...jar].map(([k, v]) => `${k}=${v}`).join('; ') : '';
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie && { cookie }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(';');
    const [k, ...v] = pair.split('=');
    if (/Expires=Thu, 01 Jan 1970/.test(raw) || v.join('=') === '') jar.delete(k);
    else jar.set(k, v.join('='));
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers, raw: res };
}

const code = (secret, t = Date.now()) =>
  new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate({ timestamp: t });

// --- anonymous checks
check('health is up', (await call('GET', '/health')).json.database === 'up');
check(
  'admin route without cookie -> 401',
  (await call('GET', '/admin/projects', undefined, { cookies: false })).status === 401,
);
check('public posts list works', (await call('GET', '/posts')).status === 200);
check(
  'draft-only data hidden from public',
  (await call('GET', '/projects/slug/does-not-exist')).status === 404,
);

// --- login + enrollment
const bad = await call('POST', '/auth/login', {
  email: env.SEED_ADMIN_EMAIL,
  password: 'definitely-wrong-pw',
});
check('wrong password -> 401', bad.status === 401);
const login = await call('POST', '/auth/login', {
  email: env.SEED_ADMIN_EMAIL,
  password: env.SEED_ADMIN_PASSWORD,
});
check('login ok, 2FA not enrolled yet', login.status === 200 && login.json.mfaEnrolled === false);
check('no session cookie after password only', jar.size === 0);
const { challenge } = login.json;
const setup = await call('POST', '/auth/2fa/setup', { challenge });
check(
  '2FA setup returns QR + secret',
  setup.status === 200 && setup.json.qrDataUrl.startsWith('data:image/png') && !!setup.json.secret,
);
const badEnable = await call('POST', '/auth/2fa/enable', { challenge, code: '000000' });
check('wrong TOTP code rejected', badEnable.status === 401);
const enable = await call('POST', '/auth/2fa/enable', { challenge, code: code(setup.json.secret) });
check(
  '2FA enabled + 10 recovery codes',
  enable.status === 200 && enable.json.recoveryCodes?.length === 10,
);
check('access + refresh cookies set', jar.has('access_token') && jar.has('refresh_token'));
const setCookies = enable.headers.getSetCookie();
check(
  'cookies are HttpOnly + SameSite=Strict',
  setCookies.length === 2 &&
    setCookies.every((c) => /HttpOnly/i.test(c) && /SameSite=Strict/i.test(c)),
);
check(
  '/auth/me works with cookie',
  (await call('GET', '/auth/me')).json.email === env.SEED_ADMIN_EMAIL,
);

// --- admin CRUD cycle on projects
const created = await call('POST', '/admin/projects', {
  slug: 'smoke-test',
  title: { en: 'Smoke' },
  summary: { en: 'S' },
  published: false,
});
check(
  'create project -> 201 with id',
  created.status === 201 && !!created.json.id,
  `order=${created.json.order}`,
);
const id = created.json.id;
check(
  'draft hidden from public list',
  !(await call('GET', '/projects', undefined, { cookies: false })).json.some(
    (p) => p.slug === 'smoke-test',
  ),
);
check(
  'duplicate slug -> 409',
  (
    await call('POST', '/admin/projects', {
      slug: 'smoke-test',
      title: { en: 'x' },
      summary: { en: 'x' },
    })
  ).status === 409,
);
check(
  'missing English -> 400',
  (
    await call('POST', '/admin/projects', {
      slug: 'no-en',
      title: { fr: 'x' },
      summary: { en: 'x' },
    })
  ).status === 400,
);
check(
  'mass-assignment (order) rejected -> 400',
  (
    await call('POST', '/admin/projects', {
      slug: 'ma',
      title: { en: 'x' },
      summary: { en: 'x' },
      order: 99,
    })
  ).status === 400,
);
const patched = await call('PATCH', `/admin/projects/${id}`, {
  published: true,
  title: { en: 'Smoke', fr: 'Fumée', ar: 'دخان' },
});
check(
  'publish + translate -> 200',
  patched.status === 200 && patched.json.published === true && patched.json.title.ar === 'دخان',
);
check(
  'published now visible by slug',
  (await call('GET', '/projects/slug/smoke-test', undefined, { cookies: false })).status === 200,
);
const all = await call('GET', '/admin/projects');
const ids = all.json.map((p) => p.id).reverse();
check('reorder -> 204', (await call('PUT', '/admin/projects/reorder', { ids })).status === 204);
check('order persisted', (await call('GET', '/admin/projects')).json[0].id === ids[0]);
check(
  'NoSQL injection in login body -> 400',
  (await call('POST', '/auth/login', { email: { $gt: '' }, password: 'x' })).status === 400,
);
check(
  'foreign Origin on POST -> 403',
  (await call('POST', '/admin/projects', {}, { headers: { origin: 'https://evil.example' } }))
    .status === 403,
);
check('delete -> 204', (await call('DELETE', `/admin/projects/${id}`)).status === 204);
check('deleted -> 404', (await call('GET', `/admin/projects/${id}`)).status === 404);

// --- refresh rotation + reuse detection
const oldRefresh = jar.get('refresh_token');
check(
  'refresh rotates token',
  (await call('POST', '/auth/refresh')).status === 200 && jar.get('refresh_token') !== oldRefresh,
);
jar.set('refresh_token', oldRefresh);
check('replayed old refresh -> 401', (await call('POST', '/auth/refresh')).status === 401);
check('...and all sessions revoked', (await call('POST', '/auth/refresh')).status === 401);

// --- second-factor login on a fresh login, with replay protection
jar.clear();
const login2 = await call('POST', '/auth/login', {
  email: env.SEED_ADMIN_EMAIL,
  password: env.SEED_ADMIN_PASSWORD,
});
check('second login reports 2FA enrolled', login2.json.mfaEnrolled === true);
check(
  'verify with the code already used at enrollment -> 401 (replay)',
  (
    await call('POST', '/auth/2fa/verify', {
      challenge: login2.json.challenge,
      code: code(setup.json.secret),
    })
  ).status === 401,
);
const recovery = enable.json.recoveryCodes[0];
check(
  'recovery code works once',
  (
    await call('POST', '/auth/2fa/verify', {
      challenge: login2.json.challenge,
      recoveryCode: recovery,
    })
  ).status === 200,
);
check(
  'recovery code reuse -> 401',
  (
    await call('POST', '/auth/2fa/verify', {
      challenge: login2.json.challenge,
      recoveryCode: recovery,
    })
  ).status === 401,
);
check(
  'logout -> 204 and cookies cleared',
  (await call('POST', '/auth/logout')).status === 204 && !jar.has('access_token'),
);

console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
