import { expect, test } from '@playwright/test';
import { BASE_URL } from '../env';

// Probes from the outside, through the site's own /api proxy, the way an attacker would reach the
// API. Sign-in is limited to 5 attempts a minute for the whole run, so these use endpoints the
// other tests barely touch (/auth/refresh allows 20 a minute, and a body that fails validation on
// /auth/2fa/setup costs one of its 5).

test('the interactive API documentation is not published', async ({ request }) => {
  for (const path of ['/api/docs', '/api/docs-json', '/api/openapi.json', '/api/swagger']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test('a write that comes from another site is refused, one from this site is not', async ({
  request,
}) => {
  const evil = await request.post('/api/auth/refresh', {
    headers: { Origin: 'https://evil.example' },
  });
  expect(evil.status()).toBe(403);
  expect((await evil.json()).message).toBe('Origin not allowed');

  // The same request from the real origin gets as far as the (missing) session.
  const home = await request.post('/api/auth/refresh', { headers: { Origin: BASE_URL } });
  expect(home.status()).toBe(401);

  // "null" is what sandboxed frames and some redirects send.
  const sandboxed = await request.post('/api/auth/refresh', { headers: { Origin: 'null' } });
  expect(sandboxed.status()).toBe(403);
});

test('input is validated strictly: operators, extra fields and huge bodies never reach the logic', async ({
  request,
}) => {
  const operator = await request.post('/api/auth/2fa/setup', {
    data: { challenge: { $ne: null } },
  });
  expect(operator.status()).toBe(400);

  const extra = await request.post('/api/auth/2fa/setup', {
    data: { challenge: 'x', isAdmin: true },
  });
  expect(extra.status()).toBe(400);

  const huge = await request.post('/api/auth/refresh', { data: { filler: 'x'.repeat(300_000) } });
  expect(huge.status()).toBe(413);

  const notJson = await request.post('/api/auth/refresh', {
    headers: { 'Content-Type': 'application/json' },
    data: '{"unterminated": ',
  });
  expect(notJson.status()).toBe(400);
});

test('errors say what went wrong without saying how the server works', async ({ request }) => {
  const responses = [
    await request.get('/api/nope'),
    await request.get('/api/projects/slug/%00'),
    await request.get('/api/projects/slug/' + 'a'.repeat(5000)),
    await request.post('/api/auth/2fa/setup', { data: [] }),
    await request.get('/api/media/not-an-object-id'),
  ];
  for (const response of responses) {
    expect([400, 404], response.url()).toContain(response.status());
    const text = await response.text();
    expect(text, response.url()).not.toMatch(
      /stack|node_modules|at .*\(.*:\d+:\d+\)|mongoose|express/i,
    );
    expect(response.headers()['x-powered-by']).toBeUndefined();
  }
});

test('nothing private can be cached, and every API response carries the security headers', async ({
  request,
}) => {
  for (const path of [
    '/api/auth/me',
    '/api/admin/projects',
    '/api/admin/profile',
    '/api/admin/posts',
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    expect(response.headers()['cache-control'], path).toBe('no-store');
  }
  const content = await request.get('/api/content');
  expect(content.headers()['cache-control'] ?? '').not.toContain('no-store');
  for (const response of [content, await request.get('/api/health')]) {
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['x-frame-options']).toBeDefined();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
  }
});
