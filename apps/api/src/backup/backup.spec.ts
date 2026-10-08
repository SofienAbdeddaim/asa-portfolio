import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { mongo } from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  exportBackup,
  importBackup,
  type BackupSource,
  type CollectionLike,
  type StoredFile,
} from './backup.js';

type Doc = Record<string, unknown>;

function fakeCollection(initial: Doc[] = []): CollectionLike & { docs: Doc[] } {
  const docs = [...initial];
  return {
    docs,
    find: () => ({ toArray: async () => [...docs] }),
    countDocuments: async () => docs.length,
    insertMany: async (more) => void docs.push(...more),
    deleteMany: async () => void docs.splice(0, docs.length),
  };
}

function fakeBucket(initial: { file: StoredFile; bytes: Buffer }[] = []) {
  const stored = new Map(initial.map(({ file, bytes }) => [String(file._id), { file, bytes }]));
  return {
    stored,
    find: () => ({ toArray: async () => [...stored.values()].map((entry) => entry.file) }),
    openDownloadStream: (id: unknown) =>
      (async function* () {
        yield stored.get(String(id))!.bytes.subarray(0, 3);
        yield stored.get(String(id))!.bytes.subarray(3);
      })(),
    openUploadStreamWithId: (id: unknown, filename: string, options: { metadata?: Doc }) => {
      const stream = new PassThrough();
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        stored.set(String(id), {
          file: { _id: id, filename, ...options },
          bytes: Buffer.concat(chunks),
        });
      });
      return stream;
    },
    delete: async (id: unknown) => void stored.delete(String(id)),
  };
}

const POST_ID = new mongo.ObjectId();
const IMAGE_ID = new mongo.ObjectId();
const PUBLISHED_AT = new Date('2026-03-04T05:06:07.000Z');
const IMAGE = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0xff, 0x00]);

const draft = {
  _id: POST_ID,
  slug: 'unfinished',
  published: false,
  publishedAt: PUBLISHED_AT,
  title: { en: 'Unfinished', ar: 'غير مكتمل' },
  order: 3,
};

function populated(): BackupSource & {
  posts: ReturnType<typeof fakeCollection>;
  bucket: ReturnType<typeof fakeBucket>;
} {
  const posts = fakeCollection([draft]);
  const bucket = fakeBucket([
    {
      file: { _id: IMAGE_ID, filename: 'cover.webp', metadata: { width: 2, height: 1 } },
      bytes: IMAGE,
    },
  ]);
  return {
    collections: {
      profile: fakeCollection([{ _id: new mongo.ObjectId(), fullName: 'Alex' }]),
      posts,
      skills: fakeCollection(),
    },
    bucket,
    posts,
  };
}

describe('backup', () => {
  const folders: string[] = [];
  afterEach(async () => {
    await Promise.all(folders.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });
  const folder = async () => {
    const dir = await mkdtemp(join(tmpdir(), 'asa-backup-'));
    folders.push(dir);
    return dir;
  };

  it('writes every document, drafts included, and every image, with a manifest', async () => {
    const dir = await folder();
    const manifest = await exportBackup(populated(), dir, new Date('2026-10-08T10:00:00Z'));

    expect(manifest).toEqual({
      format: BACKUP_FORMAT,
      version: 1,
      createdAt: '2026-10-08T10:00:00.000Z',
      counts: { profile: 1, posts: 1, skills: 0 },
      media: 1,
    });
    expect((await readdir(dir)).sort()).toEqual([
      'content.json',
      'manifest.json',
      'media',
      'media.json',
    ]);
    expect(await readFile(join(dir, 'media', IMAGE_ID.toString()))).toEqual(IMAGE);
    expect(await readFile(join(dir, 'content.json'), 'utf8')).toContain('"unfinished"');
  });

  it('gives back the same documents, with their ids and dates intact, and the same image bytes', async () => {
    const dir = await folder();
    await exportBackup(populated(), dir);

    const empty = {
      collections: { profile: fakeCollection(), posts: fakeCollection(), skills: fakeCollection() },
      bucket: fakeBucket(),
    };
    const manifest = await importBackup(empty, dir);

    expect(manifest.counts['posts']).toBe(1);
    const restored = (empty.collections['posts'] as ReturnType<typeof fakeCollection>).docs[0]!;
    expect(restored).toEqual(draft);
    expect(restored['_id']).toBeInstanceOf(mongo.ObjectId);
    expect(restored['publishedAt']).toBeInstanceOf(Date);
    const image = empty.bucket.stored.get(IMAGE_ID.toString())!;
    expect(image.bytes).toEqual(IMAGE);
    expect(image.file.filename).toBe('cover.webp');
    expect(image.file.metadata).toEqual({ width: 2, height: 1 });
  });

  it('refuses to restore into a database that already has content, unless told to replace it', async () => {
    const dir = await folder();
    await exportBackup(populated(), dir);

    const occupied = populated();
    await expect(importBackup(occupied, dir)).rejects.toThrow(
      /already has content \(profile, posts, media\)/,
    );
    expect(occupied.posts.docs).toHaveLength(1);

    const extra = populated();
    extra.posts.docs.push({ _id: new mongo.ObjectId(), slug: 'other' });
    await importBackup(extra, dir, { replace: true });
    expect(extra.posts.docs.map((doc) => doc['slug'])).toEqual(['unfinished']);

    const withImageOnly = {
      collections: { profile: fakeCollection(), posts: fakeCollection(), skills: fakeCollection() },
      bucket: fakeBucket([
        { file: { _id: new mongo.ObjectId(), filename: 'x.webp' }, bytes: IMAGE },
      ]),
    };
    await expect(importBackup(withImageOnly, dir)).rejects.toThrow(/\(media\)/);
  });

  it('refuses a folder that is not a backup of this version, or has content it does not know', async () => {
    const dir = await folder();
    await exportBackup(populated(), dir);
    const unknown = { collections: { profile: fakeCollection() }, bucket: fakeBucket() };
    await expect(importBackup(unknown, dir)).rejects.toThrow(/"posts".*does not know/);

    const other = await folder();
    await expect(importBackup(populated(), other)).rejects.toThrow(/manifest\.json/);
  });
});
