import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import { mongo } from 'mongoose';

const { EJSON } = mongo.BSON;

export const BACKUP_FORMAT = 'asa-portfolio-backup';
export const BACKUP_VERSION = 1;

type Doc = Record<string, unknown>;

/** The part of a MongoDB collection the backup needs (a real one, or a fake in tests). */
export interface CollectionLike {
  find(): { toArray(): Promise<Doc[]> };
  countDocuments(): Promise<number>;
  insertMany(docs: Doc[]): Promise<unknown>;
  deleteMany(filter: Doc): Promise<unknown>;
}

export interface StoredFile {
  _id: unknown;
  filename: string;
  metadata?: Doc;
}

/** The part of a GridFS bucket the backup needs. */
export interface BucketLike {
  find(): { toArray(): Promise<StoredFile[]> };
  openDownloadStream(id: unknown): AsyncIterable<Buffer | string>;
  openUploadStreamWithId(id: unknown, filename: string, options: { metadata?: Doc }): Writable;
  delete(id: unknown): Promise<void>;
}

export interface BackupSource {
  /** Content collections by a stable name. Users and sessions are deliberately not among them. */
  collections: Record<string, CollectionLike>;
  bucket: BucketLike;
}

export interface Manifest {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  counts: Record<string, number>;
  media: number;
}

const idOf = (value: unknown): string => String(value);

async function readAll(stream: AsyncIterable<Buffer | string>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * Writes everything the back-office holds into `dir`: every content document, drafts included,
 * and every uploaded image. Dates and ids keep their types (Extended JSON), so a restore gives the
 * same documents back. Accounts and sessions are not content and never leave the database.
 */
export async function exportBackup(
  source: BackupSource,
  dir: string,
  now = new Date(),
): Promise<Manifest> {
  await mkdir(join(dir, 'media'), { recursive: true });

  const content: Record<string, Doc[]> = {};
  for (const [name, collection] of Object.entries(source.collections)) {
    content[name] = await collection.find().toArray();
  }

  const files = await source.bucket.find().toArray();
  for (const file of files) {
    const bytes = await readAll(source.bucket.openDownloadStream(file._id));
    await writeFile(join(dir, 'media', idOf(file._id)), bytes);
  }

  const manifest: Manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    counts: Object.fromEntries(Object.entries(content).map(([name, docs]) => [name, docs.length])),
    media: files.length,
  };
  await writeFile(
    join(dir, 'content.json'),
    EJSON.stringify(content, undefined, 2, { relaxed: false }),
  );
  await writeFile(
    join(dir, 'media.json'),
    EJSON.stringify(files, undefined, 2, { relaxed: false }),
  );
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/**
 * Puts a backup back. It refuses to write into a database that already has content, so a restore
 * can never silently merge into or overwrite something; `replace` clears the content first.
 */
export async function importBackup(
  target: BackupSource,
  dir: string,
  options: { replace?: boolean } = {},
): Promise<Manifest> {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as Manifest;
  if (manifest.format !== BACKUP_FORMAT || manifest.version !== BACKUP_VERSION) {
    throw new Error(`Not a backup this version can read (${manifest.format} v${manifest.version})`);
  }
  const content = EJSON.parse(await readFile(join(dir, 'content.json'), 'utf8')) as Record<
    string,
    Doc[]
  >;
  const files = EJSON.parse(await readFile(join(dir, 'media.json'), 'utf8')) as StoredFile[];

  for (const name of Object.keys(content)) {
    if (!target.collections[name])
      throw new Error(`The backup has "${name}", which this version does not know`);
  }
  if (!options.replace) {
    const occupied: string[] = [];
    for (const [name, collection] of Object.entries(target.collections)) {
      if ((await collection.countDocuments()) > 0) occupied.push(name);
    }
    if ((await target.bucket.find().toArray()).length > 0) occupied.push('media');
    if (occupied.length > 0) {
      throw new Error(
        `The database already has content (${occupied.join(', ')}). Restore into an empty one, or pass --replace to clear it first.`,
      );
    }
  } else {
    for (const collection of Object.values(target.collections)) await collection.deleteMany({});
    for (const file of await target.bucket.find().toArray()) await target.bucket.delete(file._id);
  }

  for (const [name, docs] of Object.entries(content)) {
    if (docs.length > 0) await target.collections[name]!.insertMany(docs);
  }
  for (const file of files) {
    const bytes = await readFile(join(dir, 'media', idOf(file._id)));
    await new Promise<void>((resolve, reject) => {
      const upload = target.bucket.openUploadStreamWithId(file._id, file.filename, {
        ...(file.metadata ? { metadata: file.metadata } : {}),
      });
      upload.once('finish', () => resolve());
      upload.once('error', reject);
      upload.end(bytes);
    });
  }
  return manifest;
}
