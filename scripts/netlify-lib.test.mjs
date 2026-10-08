import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  buildCsp,
  buildHeaders,
  buildRedirects,
  headersFor,
  inlineScriptHashes,
  matchPattern,
  parseHeaders,
  parseRedirects,
  resolveRedirect,
} from './netlify-lib.mjs';

const sha = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const rules = parseRedirects(buildRedirects({ apiOrigin: 'https://api.example.com/' }));

test('hashes inline scripts exactly, and only executable ones', () => {
  const theme = "(function(){document.documentElement.dataset.x='1'})();";
  const html = `<html><head>
    <script>${theme}</script>
    <script src="/main.js" type="module"></script>
    <script type="application/ld+json">{"@type":"Person"}</script>
    <script id="ng-state" type="application/json">{"a":1}</script>
    <script type="module">import('/x.js')</script>
    <script>   </script>
  </head></html>`;
  assert.deepEqual(inlineScriptHashes(html), [sha(theme), sha("import('/x.js')")]);
  assert.deepEqual(inlineScriptHashes('<p>no scripts</p>'), []);
});

test('builds a strict CSP and lists the script hashes', () => {
  const csp = buildCsp({ scriptHashes: ["'sha256-abc='"] });
  assert.ok(csp.includes("script-src 'self' 'sha256-abc='"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("default-src 'self'"));
  assert.ok(!/script-src[^;]*unsafe/.test(csp), 'scripts must never allow unsafe-inline or eval');
});

test('headers: security on everything, long cache for hashed assets, no-store for the admin', () => {
  const blocks = parseHeaders(buildHeaders({ scriptHashes: ["'sha256-abc='"] }));
  const page = headersFor(blocks, '/en/blog/index.html');
  assert.equal(page['X-Content-Type-Options'], 'nosniff');
  assert.equal(page['X-Frame-Options'], 'DENY');
  assert.match(page['Strict-Transport-Security'], /max-age=63072000/);
  assert.equal(page['Cache-Control'], 'public, max-age=0, must-revalidate');
  assert.ok(page['Content-Security-Policy'].includes("'sha256-abc='"));

  assert.equal(
    headersFor(blocks, '/main-ABC123.js')['Cache-Control'],
    'public, max-age=31536000, immutable',
  );
  assert.equal(
    headersFor(blocks, '/styles-XYZ.css')['Cache-Control'],
    'public, max-age=31536000, immutable',
  );
  assert.equal(
    headersFor(blocks, '/media/abc.webp')['Cache-Control'],
    'public, max-age=31536000, immutable',
  );
  for (const path of ['/admin', '/admin/projects']) {
    const admin = headersFor(blocks, path);
    assert.equal(admin['X-Robots-Tag'], 'noindex, nofollow', path);
    assert.equal(admin['Cache-Control'], 'no-store', path);
  }
  assert.equal(headersFor(blocks, '/en')['X-Robots-Tag'], undefined);
});

test('redirects: language detection on the root, English by default', () => {
  assert.deepEqual(resolveRedirect(rules, '/', { acceptLanguage: 'ar-TN,ar;q=0.9,en;q=0.5' }), {
    to: '/ar',
    status: 302,
  });
  assert.deepEqual(resolveRedirect(rules, '/', { acceptLanguage: 'fr-FR,fr;q=0.9' }), {
    to: '/fr',
    status: 302,
  });
  assert.deepEqual(resolveRedirect(rules, '/', { acceptLanguage: 'de-DE,de;q=0.9' }), {
    to: '/en',
    status: 302,
  });
  assert.deepEqual(resolveRedirect(rules, '/', { acceptLanguage: '' }), { to: '/en', status: 302 });
  assert.deepEqual(resolveRedirect(rules, '/', { acceptLanguage: 'en-GB,fr;q=0.8' }), {
    to: '/en',
    status: 302,
  });
});

test('redirects: /api is forwarded to the API host with the path intact', () => {
  assert.deepEqual(resolveRedirect(rules, '/api/health'), {
    to: 'https://api.example.com/api/health',
    status: 200,
  });
  assert.deepEqual(resolveRedirect(rules, '/api/admin/projects/1'), {
    to: 'https://api.example.com/api/admin/projects/1',
    status: 200,
  });
});

test('redirects: the admin uses the browser-rendered shell and unknown pages get a 404', () => {
  assert.deepEqual(resolveRedirect(rules, '/admin'), { to: '/index.csr.html', status: 200 });
  assert.deepEqual(resolveRedirect(rules, '/admin/posts/new'), {
    to: '/index.csr.html',
    status: 200,
  });
  assert.deepEqual(resolveRedirect(rules, '/nope/nothing'), { to: '/index.csr.html', status: 404 });
});

test('parses the rule and header formats', () => {
  assert.deepEqual(parseRedirects('/a /b 301\n# note\n/c /d'), [
    { from: '/a', to: '/b', status: 301, conditions: {} },
    { from: '/c', to: '/d', status: 301, conditions: {} },
  ]);
  assert.deepEqual(parseRedirects('/ /ar 302 Language=ar,fr')[0].conditions, {
    language: ['ar', 'fr'],
  });
  assert.deepEqual(parseHeaders('/*\n  A: b: c\n\n/x\n  D: e'), [
    { pattern: '/*', headers: [['A', 'b: c']] },
    { pattern: '/x', headers: [['D', 'e']] },
  ]);
});

test('matches Netlify path patterns', () => {
  assert.deepEqual(matchPattern('/api/*', '/api/a/b'), { splat: 'a/b' });
  assert.equal(matchPattern('/api/*', '/apix/a'), null);
  assert.deepEqual(matchPattern('/*.js', '/main-1.js'), { splat: 'main-1' });
  assert.equal(matchPattern('/*.js', '/main.json'), null);
  assert.deepEqual(matchPattern('/', '/'), { splat: '' });
  assert.equal(matchPattern('/', '/en'), null);
});
