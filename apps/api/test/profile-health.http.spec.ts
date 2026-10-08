import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { getConnectionToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { TokenService } from '../src/auth/token.service.js';
import { configureApp } from '../src/bootstrap.js';
import { ENV } from '../src/config/env.js';
import {
  AdminProfileController,
  ProfileController,
  SnapshotController,
} from '../src/content/profile.controller.js';
import { ProfileService } from '../src/content/profile.service.js';
import { SnapshotCache } from '../src/content/snapshot-cache.js';
import { RESOURCES } from '../src/content/resources.js';
import { HealthController } from '../src/health/health.controller.js';
import { TEST_ENV } from './auth-harness.js';

const profile = {
  fullName: 'X',
  headline: { en: 'h' },
  bio: { en: 'b' },
  email: 'a@example.com',
  availability: { status: 'open' },
  socials: [],
};

describe('profile, snapshot and health', () => {
  let app: INestApplication;
  let adminCookie: string[];
  const connection = { readyState: 1 };
  const profileService = {
    get: vi.fn(async () => profile),
    replace: vi.fn(async (data: object) => data),
  };
  const contentService = { listPublic: vi.fn(async () => [{ id: '1' }]) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [
        ProfileController,
        AdminProfileController,
        SnapshotController,
        HealthController,
      ],
      providers: [
        TokenService,
        JwtAuthGuard,
        SnapshotCache,
        { provide: ENV, useValue: TEST_ENV },
        { provide: ProfileService, useValue: profileService },
        { provide: 'CONTENT_SERVICES', useValue: RESOURCES.map(() => contentService) },
        { provide: getConnectionToken(), useValue: connection },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, TEST_ENV);
    await app.init();
    adminCookie = [
      `access_token=${await app.get(TokenService).signAccess('64b7f0c2a1b2c3d4e5f60718')}`,
    ];
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  it('serves the profile publicly and the whole published content in one snapshot', async () => {
    await http().get('/api/profile').expect(200);
    const res = await http().get('/api/content').expect(200);
    expect(res.body.profile.fullName).toBe('X');
    for (const { path } of RESOURCES) expect(res.body[path]).toEqual([{ id: '1' }]);
    expect(new Date(res.body.generatedAt).getTime()).not.toBeNaN();
  });

  it('only lets the admin replace the profile, with a validated body', async () => {
    await http().put('/api/admin/profile').send(profile).expect(401);
    await http().put('/api/admin/profile').set('Cookie', adminCookie).send(profile).expect(200);
    await http()
      .put('/api/admin/profile')
      .set('Cookie', adminCookie)
      .send({ ...profile, email: 'nope' })
      .expect(400);
  });

  it('serves the snapshot from memory for a few seconds, until something is changed', async () => {
    const cache = app.get(SnapshotCache);
    cache.invalidate();
    contentService.listPublic.mockClear();
    const first = await http().get('/api/content').expect(200);
    const second = await http().get('/api/content').expect(200);
    expect(second.body.generatedAt).toBe(first.body.generatedAt);
    expect(contentService.listPublic).toHaveBeenCalledTimes(RESOURCES.length);

    cache.invalidate(); // what every back-office write does
    await http().get('/api/content').expect(200);
    expect(contentService.listPublic).toHaveBeenCalledTimes(RESOURCES.length * 2);
  });

  it('does not let a stale build overwrite a change made while it ran', () => {
    const cache = new SnapshotCache();
    const generation = cache.begin();
    cache.invalidate();
    cache.set({ old: true }, generation);
    expect(cache.get()).toBeUndefined();
    cache.set({ fresh: true }, cache.begin());
    expect(cache.get()).toEqual({ fresh: true });
    expect(cache.get(Date.now() + 6_000)).toBeUndefined();
  });

  it('reports database health and degrades to 503', async () => {
    const ok = await http().get('/api/health').expect(200);
    expect(ok.body).toMatchObject({ status: 'ok', database: 'up', commit: null });
    connection.readyState = 0;
    await http().get('/api/health').expect(503);
    connection.readyState = 1;
  });
});
