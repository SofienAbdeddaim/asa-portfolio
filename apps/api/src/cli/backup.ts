import 'reflect-metadata';
import { isAbsolute, join, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module.js';
import {
  exportBackup,
  importBackup,
  type BackupSource,
  type BucketLike,
} from '../backup/backup.js';
import { PROFILE_MODEL } from '../content/profile.service.js';
import { RESOURCES } from '../content/resources.js';
import { MEDIA_BUCKET } from '../media/media.service.js';

const USAGE = `Backup and restore of everything the back-office holds: the profile, every kind of content
(drafts included) and the uploaded images. Atlas's free tier has no backups of its own, so run this
now and then and keep the folder somewhere private: drafts are in it. Accounts and sessions are not.

  pnpm --filter @asa/api backup export [folder]            default: backups/<date and time>
  pnpm --filter @asa/api backup import <folder> [--replace]

The database comes from MONGODB_URI (.env). Import refuses a database that already has content;
--replace clears the content first. Restore into a fresh database for a rehearsal.`;

async function main(): Promise<void> {
  const [command, folder, flag] = process.argv.slice(2);
  if (command !== 'export' && command !== 'import') {
    console.error(USAGE);
    process.exit(command === undefined ? 0 : 1);
  }
  // pnpm runs scripts from the package folder; paths are meant relative to where it was invoked.
  const base = process.env['INIT_CWD'] ?? process.cwd();
  const where = (path: string) => (isAbsolute(path) ? path : resolve(base, path));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const source: BackupSource = {
      collections: {
        profile: app.get<Model<never>>(getModelToken(PROFILE_MODEL)).collection as never,
        ...Object.fromEntries(
          RESOURCES.map((definition) => [
            definition.path,
            app.get<Model<never>>(getModelToken(definition.modelName)).collection,
          ]),
        ),
      },
      bucket: app.get<BucketLike>(MEDIA_BUCKET),
    };

    if (command === 'export') {
      const dir = where(folder ?? join('backups', new Date().toISOString().replace(/[:.]/g, '-')));
      const manifest = await exportBackup(source, dir);
      const total = Object.values(manifest.counts).reduce((sum, count) => sum + count, 0);
      console.log(`Saved ${total} documents and ${manifest.media} images to ${dir}`);
    } else {
      if (!folder) throw new Error('Say which folder to import: backup import <folder>');
      const manifest = await importBackup(source, where(folder), { replace: flag === '--replace' });
      const total = Object.values(manifest.counts).reduce((sum, count) => sum + count, 0);
      console.log(`Restored ${total} documents and ${manifest.media} images from ${folder}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
