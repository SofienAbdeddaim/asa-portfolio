// Pure helpers and the runner for `pnpm snapshot`: pulls the published content from the API into
// the static site (a JSON snapshot plus the images it uses), so the site never depends on the
// API being awake at view time. Kept free of top-level side effects so it can be tested.
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MEDIA_REF = /\/api\/media\/([a-f0-9]{24})/g;
const REQUIRED_LISTS = [
  'experiences',
  'skills',
  'projects',
  'education',
  'certificates',
  'testimonials',
  'posts',
];
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** Every media id the content refers to: photo, screenshots, covers and images inside Markdown. */
export function collectMediaIds(snapshotJson) {
  return [...new Set([...snapshotJson.matchAll(MEDIA_REF)].map((match) => match[1]))];
}

/** Points `/api/media/<id>` at the static copy `/media/<id>.webp`. */
export function rewriteMediaUrls(snapshotJson) {
  return snapshotJson.replace(MEDIA_REF, '/media/$1.webp');
}

export function validateSnapshot(value) {
  if (!value || typeof value !== 'object') throw new Error('The API did not return a JSON object');
  for (const key of REQUIRED_LISTS) {
    if (!Array.isArray(value[key])) throw new Error(`Snapshot is missing the "${key}" list`);
  }
  if (typeof value.generatedAt !== 'string') throw new Error('Snapshot is missing "generatedAt"');
  if (value.profile === null)
    throw new Error('The profile is empty: fill it in the back-office first');
  return value;
}

/**
 * Fetches `url`, retrying while the server wakes up (free-tier APIs can take a minute to boot).
 * `sleep` and `fetchImpl` are injectable for tests.
 */
export async function fetchWithRetry(
  url,
  {
    fetchImpl = fetch,
    attempts = 12,
    delayMs = 5000,
    timeoutMs = 25000,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log = () => {},
  } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let retryable = true;
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) return response;
      lastError = new Error(`${url} answered ${response.status}`);
      // 5xx (including a gateway answering while the app boots), 408 and 429 are worth retrying;
      // any other 4xx is a real answer and retrying will not change it.
      retryable = response.status >= 500 || response.status === 408 || response.status === 429;
    } catch (error) {
      lastError = error; // network failure or timeout
    }
    if (!retryable) throw lastError;
    if (attempt < attempts) {
      log(
        `Attempt ${attempt}/${attempts} failed (${lastError.message}); retrying in ${delayMs / 1000}s…`,
      );
      await sleep(delayMs);
    }
  }
  throw new Error(`Could not reach ${url} after ${attempts} attempts: ${lastError?.message}`);
}

export async function runSnapshot({
  apiUrl,
  webDir,
  fetchImpl = fetch,
  sleep,
  attempts,
  delayMs,
  log = console.log,
}) {
  const base = apiUrl.replace(/\/$/, '');
  const publicDir = join(webDir, 'public');
  const mediaDir = join(publicDir, 'media');
  const retry = { fetchImpl, sleep, attempts, delayMs, log };

  log(`Fetching content from ${base}/api/content`);
  const response = await fetchWithRetry(`${base}/api/content`, retry);
  const original = await response.text();
  validateSnapshot(JSON.parse(original));

  const ids = collectMediaIds(original);
  await mkdir(mediaDir, { recursive: true });
  for (const id of ids) {
    const image = await fetchWithRetry(`${base}/api/media/${id}`, {
      ...retry,
      attempts: 3,
      delayMs: 2000,
    });
    const type = image.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) throw new Error(`Media ${id} is not an image (${type})`);
    const bytes = Buffer.from(await image.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES)
      throw new Error(`Media ${id} is too large (${bytes.length} bytes)`);
    await writeFile(join(mediaDir, `${id}.webp`), bytes);
  }

  // Drop images that no content refers to any more.
  const keep = new Set(ids.map((id) => `${id}.webp`));
  for (const file of await readdir(mediaDir)) {
    if (!keep.has(file)) await rm(join(mediaDir, file), { force: true });
  }

  // Write the snapshot last and atomically: a failed run never leaves a half-written file.
  const rewritten = JSON.stringify(JSON.parse(rewriteMediaUrls(original)), null, 2) + '\n';
  const target = join(publicDir, 'content-snapshot.json');
  await writeFile(`${target}.tmp`, rewritten);
  await rename(`${target}.tmp`, target);

  log(`Snapshot written (${ids.length} image${ids.length === 1 ? '' : 's'}).`);
  return { images: ids.length, bytes: rewritten.length };
}
