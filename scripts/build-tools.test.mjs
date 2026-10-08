import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildRobots, buildSitemaps, normalizeSiteUrl, pagesFromSnapshot } from './seo-lib.mjs';
import {
  collectMediaIds,
  fetchWithRetry,
  rewriteMediaUrls,
  runSnapshot,
  validateSnapshot,
} from './snapshot-lib.mjs';

const ID_A = 'a'.repeat(24);
const ID_B = 'b'.repeat(24);

const snapshot = (overrides = {}) => ({
  generatedAt: '2026-03-01T00:00:00.000Z',
  profile: { fullName: 'Alex', photoUrl: `/api/media/${ID_A}` },
  experiences: [],
  skills: [],
  projects: [{ images: [{ url: `/api/media/${ID_B}` }] }],
  education: [],
  certificates: [],
  testimonials: [],
  posts: [
    {
      slug: 'hello',
      updatedAt: '2026-02-01T10:00:00.000Z',
      body: { en: `![x](/api/media/${ID_A}) and /api/media/not-an-id` },
    },
  ],
  ...overrides,
});

const response = (body, { status = 200, type = 'application/json' } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name.toLowerCase() === 'content-type' ? type : null) },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  arrayBuffer: async () => Buffer.from(body),
});

test('collects each media id once, including images inside Markdown, and ignores lookalikes', () => {
  const ids = collectMediaIds(JSON.stringify(snapshot()));
  assert.deepEqual(ids.sort(), [ID_A, ID_B].sort());
  assert.deepEqual(collectMediaIds('{"x":"/api/media/ZZZZ"}'), []);
});

test('rewrites media addresses to the static copies', () => {
  const rewritten = rewriteMediaUrls(JSON.stringify(snapshot()));
  assert.ok(rewritten.includes(`/media/${ID_A}.webp`));
  assert.ok(!rewritten.includes('/api/media/' + ID_A));
  assert.ok(rewritten.includes('/api/media/not-an-id'));
});

test('validates the shape of the snapshot', () => {
  assert.doesNotThrow(() => validateSnapshot(snapshot()));
  assert.throws(() => validateSnapshot(null), /JSON object/);
  assert.throws(() => validateSnapshot(snapshot({ posts: undefined })), /"posts"/);
  assert.throws(() => validateSnapshot(snapshot({ generatedAt: 3 })), /generatedAt/);
  assert.throws(() => validateSnapshot(snapshot({ profile: null })), /profile is empty/);
});

test('retries while the API wakes up, but not on a real client error', async () => {
  const sleeps = [];
  const answers = [response('', { status: 503 }), response('', { status: 502 }), response('ok')];
  const fetchImpl = async () => answers.shift();
  const result = await fetchWithRetry('http://x', {
    fetchImpl,
    sleep: async (ms) => sleeps.push(ms),
    delayMs: 10,
  });
  assert.equal(await result.text(), 'ok');
  assert.deepEqual(sleeps, [10, 10]);

  let calls = 0;
  await assert.rejects(
    fetchWithRetry('http://x', {
      fetchImpl: async () => (calls++, response('', { status: 404 })),
      sleep: async () => {},
    }),
    /answered 404/,
  );
  assert.equal(calls, 1);

  await assert.rejects(
    fetchWithRetry('http://x', {
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
      sleep: async () => {},
      attempts: 3,
    }),
    /after 3 attempts: ECONNREFUSED/,
  );
});

test('writes the snapshot, downloads images, rewrites addresses and removes stale images', async () => {
  const webDir = await mkdtemp(join(tmpdir(), 'asa-snapshot-'));
  try {
    await mkdir(join(webDir, 'public/media'), { recursive: true });
    await writeFile(join(webDir, 'public/media/stale.webp'), 'old');
    const requested = [];
    const fetchImpl = async (url) => {
      requested.push(url);
      if (url.endsWith('/api/content')) return response(snapshot());
      return response('IMAGE-BYTES', { type: 'image/webp' });
    };
    const result = await runSnapshot({
      apiUrl: 'http://api.test/',
      webDir,
      fetchImpl,
      sleep: async () => {},
      log: () => {},
    });

    assert.equal(result.images, 2);
    assert.deepEqual((await readdir(join(webDir, 'public/media'))).sort(), [
      `${ID_A}.webp`,
      `${ID_B}.webp`,
    ]);
    assert.equal(await readFile(join(webDir, `public/media/${ID_A}.webp`), 'utf8'), 'IMAGE-BYTES');
    const written = JSON.parse(
      await readFile(join(webDir, 'public/content-snapshot.json'), 'utf8'),
    );
    assert.equal(written.profile.photoUrl, `/media/${ID_A}.webp`);
    assert.equal(written.projects[0].images[0].url, `/media/${ID_B}.webp`);
    assert.ok(requested.includes('http://api.test/api/content'));
  } finally {
    await rm(webDir, { recursive: true, force: true });
  }
});

test('leaves the existing snapshot untouched when anything fails', async () => {
  const webDir = await mkdtemp(join(tmpdir(), 'asa-snapshot-'));
  try {
    await mkdir(join(webDir, 'public'), { recursive: true });
    await writeFile(join(webDir, 'public/content-snapshot.json'), '{"keep":"me"}');
    const notImage = async (url) =>
      url.endsWith('/api/content')
        ? response(snapshot())
        : response('<html>', { type: 'text/html' });
    await assert.rejects(
      runSnapshot({
        apiUrl: 'http://api.test',
        webDir,
        fetchImpl: notImage,
        sleep: async () => {},
        log: () => {},
      }),
      /not an image/,
    );
    assert.equal(
      await readFile(join(webDir, 'public/content-snapshot.json'), 'utf8'),
      '{"keep":"me"}',
    );

    const invalid = async () => response({ generatedAt: 'x' });
    await assert.rejects(
      runSnapshot({
        apiUrl: 'http://api.test',
        webDir,
        fetchImpl: invalid,
        sleep: async () => {},
        log: () => {},
      }),
      /missing/,
    );
    assert.equal(
      await readFile(join(webDir, 'public/content-snapshot.json'), 'utf8'),
      '{"keep":"me"}',
    );
  } finally {
    await rm(webDir, { recursive: true, force: true });
  }
});

test('lists every page and post for the sitemaps', () => {
  const pages = pagesFromSnapshot(snapshot());
  assert.deepEqual(
    pages.map((p) => p.path),
    ['', '/blog', '/cv', '/blog/hello'],
  );
  assert.equal(pages[3].lastmod, '2026-02-01');
  assert.equal(pages[0].lastmod, '2026-03-01');
});

test('builds one sitemap per language with hreflang alternates, plus an index', () => {
  const files = buildSitemaps({
    siteUrl: 'https://site.example/',
    pages: pagesFromSnapshot(snapshot()),
  });
  assert.deepEqual(Object.keys(files).sort(), [
    'sitemap-ar.xml',
    'sitemap-en.xml',
    'sitemap-fr.xml',
    'sitemap.xml',
  ]);
  const arabic = files['sitemap-ar.xml'];
  assert.ok(arabic.includes('<loc>https://site.example/ar/blog/hello</loc>'));
  assert.ok(arabic.includes('hreflang="fr" href="https://site.example/fr/blog/hello"'));
  assert.ok(arabic.includes('hreflang="x-default" href="https://site.example/en/blog/hello"'));
  assert.ok(arabic.includes('<lastmod>2026-02-01</lastmod>'));
  assert.ok(!arabic.includes('/en/blog/hello</loc>'));
  assert.ok(files['sitemap.xml'].includes('<loc>https://site.example/sitemap-fr.xml</loc>'));
  assert.ok(!arabic.includes('example//'));
});

test('escapes XML special characters in slugs', () => {
  const files = buildSitemaps({ siteUrl: 'https://site.example', pages: [{ path: '/blog/a&b' }] });
  assert.ok(files['sitemap-en.xml'].includes('/en/blog/a&amp;b'));
});

test('robots.txt hides the back-office and points to the sitemap', () => {
  assert.equal(
    buildRobots('https://site.example/'),
    'User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: https://site.example/sitemap.xml\n',
  );
});

test('accepts only safe site addresses', () => {
  assert.equal(normalizeSiteUrl('https://me.netlify.app/'), 'https://me.netlify.app');
  assert.equal(normalizeSiteUrl('http://localhost:4200'), 'http://localhost:4200');
  assert.throws(() => normalizeSiteUrl('http://example.com'), /https/);
  assert.throws(() => normalizeSiteUrl('https://example.com/portfolio'), /without a path/);
  assert.throws(() => normalizeSiteUrl('javascript:alert(1)'), /https/);
  assert.throws(() => normalizeSiteUrl('not a url'), /not a valid URL/);
  assert.throws(() => normalizeSiteUrl(''), /not a valid URL/);
});
