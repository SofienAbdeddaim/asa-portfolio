import { Controller, Get, Inject, Put, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ValidBody } from '../common/validation.js';
import { ProfileDto } from './dto.js';
import { ProfileService } from './profile.service.js';
import { RESOURCES } from './resources.js';
import type { ContentService } from './content.service.js';
import { SnapshotCache } from './snapshot-cache.js';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(@Inject(ProfileService) private readonly profile: ProfileService) {}

  @Get()
  get() {
    return this.profile.get();
  }
}

@ApiTags('admin/profile')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/profile')
export class AdminProfileController {
  constructor(@Inject(ProfileService) private readonly profile: ProfileService) {}

  @Get()
  get() {
    return this.profile.get();
  }

  @Put()
  @ApiBody({ type: ProfileDto })
  replace(@ValidBody(ProfileDto) dto: ProfileDto) {
    return this.profile.replace({ ...dto });
  }
}

/** One request with everything published: used for the build-time content snapshot. */
@ApiTags('content')
@Controller('content')
export class SnapshotController {
  private readonly services: Map<string, ContentService>;

  constructor(
    @Inject(ProfileService) private readonly profile: ProfileService,
    @Inject('CONTENT_SERVICES') services: ContentService[],
    @Inject(SnapshotCache) private readonly cache: SnapshotCache,
  ) {
    this.services = new Map(
      RESOURCES.map((definition, i) => [definition.path, services[i] as ContentService]),
    );
  }

  @Get()
  async snapshot() {
    const cached = this.cache.get();
    if (cached) return cached;
    const generation = this.cache.begin();
    const entries = await Promise.all(
      [...this.services].map(
        async ([path, service]) => [path, await service.listPublic()] as const,
      ),
    );
    const snapshot = {
      generatedAt: new Date().toISOString(),
      profile: await this.profile.get(),
      ...Object.fromEntries(entries),
    };
    this.cache.set(snapshot, generation);
    return snapshot;
  }
}
