#!/usr/bin/env node
// Writes `_redirects` and `_headers` into the built site. Runs after `ng build`.
//   API_ORIGIN=https://my-api.onrender.com pnpm --filter @asa/web build
// The Content-Security-Policy lists the hash of every inline script found in the built pages.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeaders, buildRedirects, inlineScriptHashes } from './netlify-lib.mjs';
import { normalizeSiteUrl } from './seo-lib.mjs';

const output = join(fileURLToPath(new URL('../apps/web', import.meta.url)), 'dist/web/browser');
const apiOrigin = normalizeSiteUrl(process.env['API_ORIGIN'] ?? 'http://localhost:3000');

async function* htmlFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith('.html')) yield path;
  }
}

const hashes = new Set();
let pages = 0;
for await (const file of htmlFiles(output)) {
  pages++;
  for (const hash of inlineScriptHashes(await readFile(file, 'utf8'))) hashes.add(hash);
}

await writeFile(join(output, '_redirects'), buildRedirects({ apiOrigin }));
await writeFile(join(output, '_headers'), buildHeaders({ scriptHashes: [...hashes] }));
console.log(
  `Netlify files written for API ${apiOrigin} (${hashes.size} inline script hash(es) from ${pages} pages).`,
);
