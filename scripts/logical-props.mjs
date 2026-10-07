#!/usr/bin/env node
// Fails when layout code uses physical left/right properties instead of logical ones, so the
// site mirrors correctly in RTL. Add `rtl-ok` on the same line to allow a justified exception.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES = [
  // Tailwind utilities (optionally behind variants such as `md:` or `hover:` and `-` negation).
  [
    /(?:^|[\s"'`:])-?(?:m|p|scroll-m|scroll-p)[lr]-(?:[\d[(]|px\b|auto\b)/,
    'use ms-/me-/ps-/pe- instead of ml-/mr-/pl-/pr-',
  ],
  [
    /(?:^|[\s"'`:])-?(?:left|right)-(?:[\d[(]|px\b|full\b|auto\b)/,
    'use start-/end- instead of left-/right-',
  ],
  [/(?:^|[\s"'`:])-?inset-[lr]-/, 'use inset-s-/inset-e- (or start-/end-)'],
  [/(?:^|[\s"'`:])text-(?:left|right)(?=[\s"'`]|$)/, 'use text-start/text-end'],
  [/(?:^|[\s"'`:])float-(?:left|right)(?=[\s"'`]|$)/, 'use float-start/float-end'],
  [
    /(?:^|[\s"'`:])(?:border|rounded)-(?:l|r|tl|tr|bl|br)(?:-|(?=[\s"'`]|$))/,
    'use border-s/e and rounded-s/e/ss/se/es/ee',
  ],
  // Plain CSS properties and values.
  [
    /\b(?:margin|padding|border|scroll-margin|scroll-padding)-(?:left|right)\b/,
    'use the *-inline-start/end property',
  ],
  [/\bborder-(?:top|bottom)-(?:left|right)-radius\b/, 'use border-start-start-radius etc.'],
  [/(?:^|[;{\s])(?:left|right)\s*:/, 'use inset-inline-start/end'],
  [/\btext-align\s*:\s*(?:left|right)\b/, 'use text-align: start/end'],
  [/\b(?:float|clear)\s*:\s*(?:left|right)\b/, 'use inline-start/inline-end'],
];

const EXTENSIONS = new Set(['.html', '.css', '.ts']);
const SKIP = new Set(['node_modules', 'dist', '.angular', 'coverage']);

export function findViolations(text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    if (line.includes('rtl-ok')) return;
    for (const [pattern, hint] of RULES) {
      if (pattern.test(line)) found.push({ line: index + 1, text: line.trim(), hint });
    }
  });
  return found;
}

function* walk(directory) {
  for (const name of readdirSync(directory)) {
    if (SKIP.has(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(name)) && !name.endsWith('.spec.ts')) yield path;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? 'apps/web/src';
  let failures = 0;
  for (const file of walk(root)) {
    for (const violation of findViolations(readFileSync(file, 'utf8'))) {
      failures++;
      console.error(
        `${relative('.', file)}:${violation.line}  ${violation.hint}\n    ${violation.text}`,
      );
    }
  }
  if (failures > 0) {
    console.error(
      `\n${failures} hardcoded left/right usage(s). Use logical properties (see AGENTS.md).`,
    );
    process.exit(1);
  }
  console.log('No hardcoded left/right layout found.');
}
