#!/usr/bin/env node
// Pulls the published content (and the images it uses) from the API into the static site.
//   API_URL=https://my-api.onrender.com pnpm snapshot
// The free-tier API may be asleep: the script retries for about a minute before giving up.
import { fileURLToPath } from 'node:url';
import { runSnapshot } from './snapshot-lib.mjs';

const webDir = fileURLToPath(new URL('../apps/web', import.meta.url));
const apiUrl = process.env['API_URL'] ?? 'http://localhost:3000';

try {
  await runSnapshot({ apiUrl, webDir });
} catch (error) {
  console.error(`\nSnapshot failed: ${error.message}`);
  console.error('The existing snapshot was left untouched.');
  process.exit(1);
}
