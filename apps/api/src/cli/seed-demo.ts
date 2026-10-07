import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module.js';
import { ContentService, type ContentDoc } from '../content/content.service.js';
import { ProfileService } from '../content/profile.service.js';
import { RESOURCES } from '../content/resources.js';
import { DEMO_CONTENT, DEMO_PROFILE } from '../content/seed-data.js';

/** Loads clearly fake demo content into empty collections. Pass `--reset` to wipe them first. */
async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const profile = app.get(ProfileService);
    if (reset || !(await profile.get())) await profile.replace({ ...DEMO_PROFILE });

    for (const definition of RESOURCES) {
      const model = app.get<Model<ContentDoc>>(getModelToken(definition.modelName), {
        strict: false,
      });
      if (reset) await model.deleteMany({});
      if ((await model.estimatedDocumentCount()) > 0) continue;
      const service = new ContentService(model, definition);
      for (const item of DEMO_CONTENT[definition.path] ?? []) await service.create(item);
    }
    console.log('Demo content loaded.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
