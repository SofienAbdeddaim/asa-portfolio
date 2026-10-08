#!/usr/bin/env node
// Sets the public address of the site (used for canonical URLs, hreflang and sitemaps).
//   node scripts/set-site-url.mjs https://my-site.netlify.app
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalizeSiteUrl } from './seo-lib.mjs';

const file = fileURLToPath(new URL('../apps/web/src/site.config.json', import.meta.url));
try {
  const url = normalizeSiteUrl(process.argv[2] ?? '');
  const config = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, `${JSON.stringify({ ...config, url }, null, 2)}\n`);
  console.log(`Site URL set to ${url}`);
} catch (error) {
  console.error(error.message);
  console.error('Usage: node scripts/set-site-url.mjs https://your-site.example');
  process.exit(1);
}
