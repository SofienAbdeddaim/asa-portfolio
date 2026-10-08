#!/usr/bin/env node
// Writes sitemap.xml, one sitemap per language and robots.txt into the built site.
// Runs after `ng build` (see apps/web/package.json). Reads src/site.config.json for the address.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRobots, buildSitemaps, normalizeSiteUrl, pagesFromSnapshot } from './seo-lib.mjs';

const web = fileURLToPath(new URL('../apps/web', import.meta.url));
const output = join(web, 'dist/web/browser');

const site = JSON.parse(await readFile(join(web, 'src/site.config.json'), 'utf8'));
const snapshot = JSON.parse(await readFile(join(web, 'public/content-snapshot.json'), 'utf8'));
const siteUrl = normalizeSiteUrl(site.url);

const files = buildSitemaps({ siteUrl, pages: pagesFromSnapshot(snapshot) });
files['robots.txt'] = buildRobots(siteUrl);
for (const [name, content] of Object.entries(files)) await writeFile(join(output, name), content);
console.log(`SEO files written for ${siteUrl}: ${Object.keys(files).join(', ')}`);
