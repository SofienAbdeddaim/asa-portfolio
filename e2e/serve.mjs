#!/usr/bin/env node
// A static server that behaves like the production host: it applies the generated `_redirects`
// (language detection, /api proxy, 404 shell) and `_headers` (CSP and friends) of the built site.
// Used by the end-to-end tests and Lighthouse so they see what visitors see.
//
//   node e2e/serve.mjs [--root apps/web/dist/web/browser] [--port 4300] [--mock-api]
//
// --mock-api answers GET /api/content with the built snapshot and nothing else, so performance
// runs need no database. Without it, /api is forwarded to the origin written in `_redirects`.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';
import {
  headersFor,
  parseHeaders,
  parseRedirects,
  resolveRedirect,
} from '../scripts/netlify-lib.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const root = resolve(
  option('--root', fileURLToPath(new URL('../apps/web/dist/web/browser', import.meta.url))),
);
const port = Number(option('--port', process.env['PORT'] ?? 4300));
const mockApi = args.includes('--mock-api');
/**
 * Milliseconds to wait before answering. A CDN is never 0 ms away; on localhost a font or script
 * can finish before the browser has even painted, which no real visitor sees and which makes
 * Lighthouse's simulation count it against the first paint. Performance runs use a few tens.
 */
const latency = Number(option('--latency', 0));
/** Forward /api to this origin instead of the one written in _redirects (tests run the API on its own port). */
const apiOverride = option('--api', null);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const redirects = parseRedirects(await readFile(join(root, '_redirects'), 'utf8').catch(() => ''));
if (apiOverride) {
  for (const rule of redirects) {
    if (/^https?:\/\//.test(rule.to)) {
      rule.to = `${apiOverride.replace(/\/$/, '')}${new URL(rule.to).pathname}`;
    }
  }
}
const headerBlocks = parseHeaders(await readFile(join(root, '_headers'), 'utf8').catch(() => ''));

/** The file a path maps to, or null. Directories serve their index.html. */
async function fileFor(pathname) {
  const target = join(root, normalize(pathname).replace(/^([/\\]?\.\.)+/, ''));
  if (!target.startsWith(root)) return null;
  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const index = join(target, 'index.html');
      return (await stat(index)).isFile() ? index : null;
    }
    return info.isFile() ? target : null;
  } catch {
    return null;
  }
}

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.xml', '.txt', '.svg']);

/** Brotli or gzip for text, like the CDN, so size-sensitive measurements match production. */
function encodingFor(req, file) {
  if (!COMPRESSIBLE.has(extname(file))) return null;
  const accepted = String(req.headers['accept-encoding'] ?? '');
  if (/\bbr\b/.test(accepted)) return 'br';
  if (/\bgzip\b/.test(accepted)) return 'gzip';
  return null;
}

async function sendFile(req, res, file, status, pathname) {
  const headers = {
    ...headersFor(headerBlocks, pathname),
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
  };
  const encoding = encodingFor(req, file);
  const stream = createReadStream(file);
  if (!encoding) {
    res.writeHead(status, headers);
    return void stream.pipe(res);
  }
  res.writeHead(status, { ...headers, 'Content-Encoding': encoding, Vary: 'Accept-Encoding' });
  const compress =
    encoding === 'br'
      ? createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      : createGzip();
  stream.pipe(compress).pipe(res);
}

async function proxy(req, res, target) {
  const body = ['GET', 'HEAD'].includes(req.method)
    ? undefined
    : Buffer.concat(await req.toArray());
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  headers['x-forwarded-for'] = req.socket.remoteAddress ?? '';
  try {
    const upstream = await fetch(target, { method: req.method, headers, body, redirect: 'manual' });
    const out = {};
    for (const [name, value] of upstream.headers)
      if (
        ![
          'content-encoding',
          'content-length',
          'transfer-encoding',
          'connection',
          'set-cookie',
        ].includes(name)
      )
        out[name] = value;
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) out['set-cookie'] = cookies;
    res.writeHead(upstream.status, out);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad gateway');
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));

  if (mockApi && pathname.startsWith('/api/')) {
    if (pathname === '/api/content')
      return sendFile(req, res, join(root, 'content-snapshot.json'), 200, '/api/content');
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end('{"message":"Not found"}');
  }

  const file = await fileFor(pathname);
  if (file) return sendFile(req, res, file, 200, pathname);

  const rule = resolveRedirect(redirects, pathname, {
    acceptLanguage: String(req.headers['accept-language'] ?? ''),
  });
  if (!rule) {
    res.writeHead(404);
    return res.end('Not found');
  }
  if (/^https?:\/\//.test(rule.to)) return proxy(req, res, `${rule.to}${url.search}`);
  if (rule.status >= 300 && rule.status < 400) {
    res.writeHead(rule.status, { Location: rule.to, 'Cache-Control': 'no-store' });
    return res.end();
  }
  const shell = await fileFor(rule.to);
  if (!shell) {
    res.writeHead(404);
    return res.end('Not found');
  }
  // Header rules are matched against the requested path, not the rewritten one (as on Netlify).
  return sendFile(req, res, shell, rule.status, pathname);
}).listen(port, () =>
  console.log(`Serving ${root} on http://localhost:${port}${mockApi ? ' (mock API)' : ''}`),
);
