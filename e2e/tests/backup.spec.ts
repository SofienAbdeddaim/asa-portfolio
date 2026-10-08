import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { MongoClient } from 'mongodb';
import { MONGODB_URI, apiEnv } from '../env';
import { TINY_PNG } from './helpers';

// The free database tier has no backups of its own, so the backup tool is the only safety net:
// this proves a real round trip, with a draft (which no public snapshot has) and an uploaded image.

const RESTORE_URI = MONGODB_URI.replace(/_e2e(\?.*)?$/, '_e2e_restore$1');
const slug = `backup-draft-${Date.now().toString(36)}`;

function backupTool(args: string[], uri: string): string {
  return execFileSync('pnpm', ['--filter', '@asa/api', 'backup', ...args], {
    env: { ...process.env, ...apiEnv, MONGODB_URI: uri },
    encoding: 'utf8',
    shell: process.platform === 'win32', // pnpm is a .cmd file there
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('everything, drafts and images included, can be exported and restored into a fresh database', async ({
  request,
}) => {
  const folder = mkdtempSync(join(tmpdir(), 'asa-e2e-backup-'));
  const client = new MongoClient(RESTORE_URI);
  let draftId = '';
  let imageId = '';
  try {
    const draft = await request.post('/api/admin/posts', {
      data: {
        slug,
        title: { en: 'A draft only the back-office knows' },
        excerpt: { en: 'x' },
        body: { en: 'Body' },
        published: false,
      },
    });
    expect(draft.status()).toBe(201);
    draftId = ((await draft.json()) as { id: string }).id;
    const upload = await request.post('/api/admin/media', {
      multipart: { file: { name: 'backup.png', mimeType: 'image/png', buffer: TINY_PNG } },
    });
    imageId = ((await upload.json()) as { id: string }).id;
    const original = await (await request.get(`/api/media/${imageId}`)).body();

    // Export from the e2e database.
    expect(backupTool(['export', folder], MONGODB_URI)).toMatch(
      /Saved \d+ documents and \d+ images/,
    );
    const manifest = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8')) as {
      counts: Record<string, number>;
      media: number;
    };
    expect(manifest.counts['posts']).toBeGreaterThanOrEqual(3); // the demo posts and the draft
    expect(manifest.media).toBeGreaterThanOrEqual(1);
    expect(readFileSync(join(folder, 'content.json'), 'utf8')).toContain(slug);
    expect(readFileSync(join(folder, 'content.json'), 'utf8')).not.toMatch(
      /passwordHash|totpSecret|recoveryCode/,
    );

    // Restore into a database that did not exist.
    await client.connect();
    await client.db().dropDatabase();
    expect(backupTool(['import', folder], RESTORE_URI)).toMatch(
      /Restored \d+ documents and \d+ images/,
    );

    const restored = client.db();
    const post = await restored.collection('blogposts').findOne({ slug });
    expect(post?.['published']).toBe(false);
    expect(post?.['_id'].toString()).toBe(draftId);
    expect(post?.['createdAt']).toBeInstanceOf(Date);
    expect(await restored.collection('profiles').countDocuments()).toBe(1);
    expect(await restored.collection('users').countDocuments()).toBe(0); // accounts never travel

    const bucket = restored.collection('media.files');
    const file = await bucket.findOne({ _id: { $exists: true }, filename: /backup/ });
    expect(file?.['_id'].toString()).toBe(imageId);
    const chunks = await restored
      .collection('media.chunks')
      .find({ files_id: file?.['_id'] })
      .sort({ n: 1 })
      .toArray();
    expect(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk['data'].buffer)))).toEqual(
      original,
    );

    // A second restore must not merge into what is there.
    expect(() => backupTool(['import', folder], RESTORE_URI)).toThrow(/already has content/);
  } finally {
    await client
      .db()
      .dropDatabase()
      .catch(() => undefined);
    await client.close();
    rmSync(folder, { recursive: true, force: true });
    if (draftId) await request.delete(`/api/admin/posts/${draftId}`);
    if (imageId) await request.delete(`/api/admin/media/${imageId}`);
  }
});
