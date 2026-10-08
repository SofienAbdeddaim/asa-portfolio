#!/usr/bin/env node
// Lighthouse against the built site, served the way production serves it (compression, headers,
// redirects) with the API mocked from the content snapshot. Each page is measured several times
// and the median is compared with the budgets in lighthouse-budgets.json; a miss fails the run.
//
//   pnpm build && pnpm lighthouse            (reports are written to .lighthouseci/)
//   pnpm lighthouse --pages en,ar --runs 1   (a quicker look at some pages)
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const budgets = JSON.parse(await readFile(here('lighthouse-budgets.json'), 'utf8'));
const option = (name) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined;
// The leading slash is optional: Git Bash on Windows rewrites arguments that start with one.
if (option('--pages'))
  budgets.pages = option('--pages')
    .split(',')
    .map((page) => (page.startsWith('/') ? page : `/${page}`));
if (option('--runs')) budgets.runs = Number(option('--runs'));
const port = 4310;
const outDir = here('../.lighthouseci/');

/** Median of the runs that produced a value (a run can miss a metric, for example when Chrome reports no LCP). */
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return Number.NaN;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

async function startServer() {
  const child = spawn(process.execPath, [here('serve.mjs'), '--port', String(port), '--mock-api'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      reject(new Error(`The test server exited early (${code}). Did you run the build?`)),
    );
    child.stdout.on('data', (chunk) => String(chunk).includes('Serving') && resolve());
  });
  return child;
}

const server = await startServer();
const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--disable-gpu', ...(process.env['CI'] ? ['--no-sandbox'] : [])],
});

const rows = [];
const failures = [];
try {
  await mkdir(outDir, { recursive: true });
  for (const path of budgets.pages) {
    const url = `http://localhost:${port}${path}`;
    // Chrome sometimes fails to record a trace (NO_NAVSTART). That says nothing about the page, so a
    // failed run is repeated, up to twice in total, and left out of the median.
    const runs = [];
    for (let attempt = 0; runs.length < budgets.runs && attempt < budgets.runs + 2; attempt += 1) {
      const result = await lighthouse(url, {
        port: chrome.port,
        output: 'html',
        logLevel: 'error',
      });
      if (!result) throw new Error(`Lighthouse returned nothing for ${url}`);
      if (result.lhr.runtimeError) {
        console.warn(
          `  ${path}: run ${attempt + 1} failed (${result.lhr.runtimeError.code}), trying again`,
        );
        continue;
      }
      runs.push(result);
    }
    if (!runs.length) throw new Error(`Lighthouse could not measure ${url}`);
    const score = (run, id) => run.lhr.categories[id]?.score ?? 0;
    const metric = (run, id) => run.lhr.audits[id]?.numericValue ?? Number.NaN;

    const categories = Object.fromEntries(
      Object.keys(budgets.scores).map((id) => [id, median(runs.map((run) => score(run, id)))]),
    );
    const metrics = Object.fromEntries(
      Object.keys(budgets.metrics).map((id) => [id, median(runs.map((run) => metric(run, id)))]),
    );

    // Keep the report of the run closest to the median performance, for humans to open.
    const typical = [...runs].sort(
      (a, b) =>
        Math.abs(score(a, 'performance') - categories['performance']) -
        Math.abs(score(b, 'performance') - categories['performance']),
    )[0];
    await writeFile(
      `${outDir}${path.replace(/^\//, '').replaceAll('/', '_') || 'index'}.html`,
      String(typical.report),
    );

    for (const [id, minimum] of Object.entries({
      ...budgets.scores,
      ...budgets.overrides?.[path]?.scores,
    })) {
      if (categories[id] < minimum)
        failures.push(
          `${path}: ${id} score ${Math.round(categories[id] * 100)} is below ${Math.round(minimum * 100)}`,
        );
    }
    for (const [id, maximum] of Object.entries({
      ...budgets.metrics,
      ...budgets.overrides?.[path]?.metrics,
    })) {
      if (!(metrics[id] <= maximum))
        failures.push(
          `${path}: ${id} is ${Math.round(metrics[id] * 1000) / 1000}, over the budget of ${maximum}`,
        );
    }
    rows.push({ path, categories, metrics });
  }
} finally {
  await chrome.kill();
  server.removeAllListeners('exit');
  server.kill();
}

const pct = (value) => String(Math.round(value * 100));
const header = ['Page', ...Object.keys(budgets.scores), 'LCP (ms)', 'CLS', 'TBT (ms)'];
const table = [
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map(
    ({ path, categories, metrics }) =>
      `| ${[
        path,
        ...Object.keys(budgets.scores).map((id) => pct(categories[id])),
        Math.round(metrics['largest-contentful-paint']),
        (Math.round(metrics['cumulative-layout-shift'] * 1000) / 1000).toString(),
        Math.round(metrics['total-blocking-time']),
      ].join(' | ')} |`,
  ),
].join('\n');

console.log(`\nLighthouse (mobile, median of ${budgets.runs} runs)\n\n${table}\n`);
if (process.env['GITHUB_STEP_SUMMARY']) {
  await appendFile(
    process.env['GITHUB_STEP_SUMMARY'],
    `## Lighthouse (mobile, median of ${budgets.runs} runs)\n\n${table}\n\n${failures.length ? failures.map((f) => `- ❌ ${f}`).join('\n') : '✅ Every budget is met.'}\n`,
  );
}
if (failures.length) {
  console.error(`Budgets missed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Every budget is met.');
}
