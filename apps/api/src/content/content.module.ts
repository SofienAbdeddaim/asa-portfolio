import { Module, type Provider } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { ContentService, type ContentDoc } from './content.service.js';
import { createContentControllers } from './content.controllers.js';
import {
  AdminProfileController,
  ProfileController,
  SnapshotController,
} from './profile.controller.js';
import { PROFILE_MODEL, ProfileService } from './profile.service.js';
import { RESOURCES, serviceToken } from './resources.js';
import { SnapshotCache } from './snapshot-cache.js';
import { profileSchema } from './schemas.js';

const serviceProviders: Provider[] = RESOURCES.map((definition) => ({
  provide: serviceToken(definition),
  inject: [getModelToken(definition.modelName), SnapshotCache],
  useFactory: (model: Model<ContentDoc>, cache: SnapshotCache) =>
    new ContentService(model, definition, () => cache.invalidate()),
}));

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: PROFILE_MODEL, schema: profileSchema },
      ...RESOURCES.map((definition) => ({ name: definition.modelName, schema: definition.schema })),
    ]),
  ],
  controllers: [
    ProfileController,
    AdminProfileController,
    SnapshotController,
    ...RESOURCES.flatMap(createContentControllers),
  ],
  providers: [
    SnapshotCache,
    ProfileService,
    ...serviceProviders,
    {
      provide: 'CONTENT_SERVICES',
      inject: RESOURCES.map(serviceToken),
      useFactory: (...services: ContentService[]) => services,
    },
  ],
})
export class ContentModule {}
