import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DEMO_CONTENT, DEMO_PROFILE } from '../content/seed-data.js';

/**
 * Writes the fake demo content as a `ContentSnapshot` JSON file, with no database involved.
 * Used to develop and test the front end offline. Usage: `pnpm --filter @asa/api snapshot:demo [out]`.
 * The default output is the web app's `public/content-snapshot.json`.
 */
const DEFAULT_OUT = '../web/public/content-snapshot.json';
const STAMP = '2026-01-01T00:00:00.000Z';

function withMeta(items: Record<string, unknown>[], prefix: string) {
  return items.map((item, index) => ({
    id: `${prefix}-${index + 1}`,
    order: index,
    published: true,
    createdAt: STAMP,
    updatedAt: STAMP,
    // The API fills defaults that the schema would add; mirror the ones the UI relies on.
    technologies: [],
    images: [],
    featured: false,
    tags: [],
    ...item,
  }));
}

async function main(): Promise<void> {
  const out = resolve(process.argv[2] ?? DEFAULT_OUT);
  const snapshot = {
    generatedAt: STAMP,
    profile: { id: 'profile', ...DEMO_PROFILE },
    experiences: withMeta(DEMO_CONTENT['experiences'] ?? [], 'exp'),
    skills: withMeta(DEMO_CONTENT['skills'] ?? [], 'skill'),
    projects: withMeta(DEMO_CONTENT['projects'] ?? [], 'proj'),
    education: withMeta(DEMO_CONTENT['education'] ?? [], 'edu'),
    certificates: withMeta(DEMO_CONTENT['certificates'] ?? [], 'cert'),
    testimonials: withMeta(DEMO_CONTENT['testimonials'] ?? [], 'quote'),
    posts: withMeta(DEMO_CONTENT['posts'] ?? [], 'post'),
  };
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${out}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
