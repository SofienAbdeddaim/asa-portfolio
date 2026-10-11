import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module.js';
import { ContentService, type ContentDoc } from '../content/content.service.js';
import { validateContentFile } from '../content/import.js';
import { ProfileService } from '../content/profile.service.js';
import { RESOURCES } from '../content/resources.js';

const USAGE = `Loads real content from a JSON file: the profile and any content kinds it lists
(experiences, skills, projects, education, certificates, testimonials, posts). Every entry is
checked against the back-office rules before anything is written. Kinds left out of the file are
not touched; accounts, sessions and images never are.

  pnpm --filter @asa/api content:import <file.json> [--replace]

The database comes from MONGODB_URI (.env). An existing profile, or a kind that already has entries,
is refused unless --replace is given, which overwrites the profile and deletes that kind's
entries first. Run \`backup export\` before.`;

async function main(): Promise<void> {
  const [path, flag] = process.argv.slice(2);
  if (!path || path === '--help') {
    console.error(USAGE);
    process.exit(path ? 0 : 1);
  }
  const replace = flag === '--replace';
  // pnpm runs scripts from the package folder; paths are meant relative to where it was invoked.
  const base = process.env['INIT_CWD'] ?? process.cwd();
  const file = isAbsolute(path) ? path : resolve(base, path);
  const content = await validateContentFile(JSON.parse(await readFile(file, 'utf8')));

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const models = RESOURCES.filter((definition) => content.resources[definition.path]).map(
      (definition) => ({
        definition,
        model: app.get<Model<ContentDoc>>(getModelToken(definition.modelName), { strict: false }),
      }),
    );
    const profile = app.get(ProfileService);
    if (!replace) {
      if (content.profile && (await profile.get())) {
        throw new Error('A profile already exists: add --replace to overwrite it');
      }
      for (const { definition, model } of models) {
        if ((await model.countDocuments()) > 0) {
          throw new Error(
            `${definition.path} already has entries: add --replace to overwrite them`,
          );
        }
      }
    }

    if (content.profile) await profile.replace(content.profile);
    for (const { definition, model } of models) {
      if (replace) await model.deleteMany({});
      const service = new ContentService(model, definition);
      for (const entry of content.resources[definition.path] ?? []) await service.create(entry);
      console.log(`${definition.path}: ${content.resources[definition.path]?.length ?? 0}`);
    }
    console.log(content.profile ? 'Profile replaced. Content imported.' : 'Content imported.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
