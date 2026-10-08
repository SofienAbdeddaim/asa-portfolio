#!/usr/bin/env node
/* global document, window -- used inside page.evaluate callbacks, which run in the browser */
// Regenerates the README screenshots from the built site (demo content, API mocked from the
// snapshot): `pnpm build && pnpm screenshots`. Output: docs/screenshots/*.jpg
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const outDir = here('../docs/screenshots/');
const port = 4320;
const base = `http://localhost:${port}`;

const server = spawn(process.execPath, [here('serve.mjs'), '--port', String(port), '--mock-api'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  server.once('exit', (code) =>
    reject(new Error(`The server exited early (${code}). Did you run the build?`)),
  );
  server.stdout.on('data', (chunk) => String(chunk).includes('Serving') && resolve());
});

const browser = await chromium.launch({ channel: process.env['CI'] ? undefined : 'chrome' });
const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

/** Opens a page and waits until the entrance animations and fonts have settled. */
async function open({ path, viewport = desktop, colorScheme = 'light', locale = 'en-US' }) {
  const context = await browser.newContext({
    viewport,
    colorScheme,
    locale,
    deviceScaleFactor: 1,
    isMobile: viewport === phone,
    hasTouch: viewport === phone,
  });
  const page = await context.newPage();
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1800);
  return { page, close: () => context.close() };
}

async function capture(name, options, action) {
  const { page, close } = await open(options);
  try {
    await (action
      ? action(page, name)
      : page.screenshot({ path: `${outDir}${name}.jpg`, type: 'jpeg', quality: 82 }));
    console.log(`docs/screenshots/${name}.jpg`);
  } finally {
    await close();
  }
}

/** A section, scrolled to the top of the viewport below the sticky header. */
const section = (id) => async (page, name) => {
  await page.evaluate(
    (target) =>
      document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: 'instant' }),
    id,
  );
  await page.evaluate(() => window.scrollBy({ top: -90, behavior: 'instant' }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}${name}.jpg`, type: 'jpeg', quality: 82 });
};

try {
  await mkdir(outDir, { recursive: true });
  await capture('home-en', { path: '/en' });
  await capture('home-ar', { path: '/ar', locale: 'ar-TN' });
  await capture('home-dark', { path: '/en', colorScheme: 'dark' });
  await capture('timeline', { path: '/en' }, section('experience'));
  await capture('projects', { path: '/en' }, section('projects'));
  await capture('playground', { path: '/en' }, section('play'));
  await capture('blog-post', { path: '/en/blog/hello-world' });
  await capture('home-mobile', { path: '/en', viewport: phone });
  await capture('home-mobile-ar', { path: '/ar', viewport: phone, locale: 'ar-TN' });
} finally {
  await browser.close();
  server.kill();
}
