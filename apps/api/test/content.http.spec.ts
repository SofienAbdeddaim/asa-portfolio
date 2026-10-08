import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { TokenService } from '../src/auth/token.service.js';
import { configureApp } from '../src/bootstrap.js';
import { createContentControllers } from '../src/content/content.controllers.js';
import { RESOURCES, serviceToken } from '../src/content/resources.js';
import { ENV } from '../src/config/env.js';
import { TEST_ENV } from './auth-harness.js';

const ID = '64b7f0c2a1b2c3d4e5f60718';
const projects = RESOURCES.find((r) => r.path === 'projects')!;
const experiences = RESOURCES.find((r) => r.path === 'experiences')!;

const service = {
  listPublic: vi.fn(async () => [{ id: ID }]),
  listAll: vi.fn(async () => [{ id: ID, published: false }]),
  findPublicBySlug: vi.fn(async (slug: string) => ({ slug })),
  findOne: vi.fn(async (id: string) => ({ id })),
  create: vi.fn(async (data: object) => ({ id: ID, ...data })),
  update: vi.fn(async (id: string, data: object) => ({ id, ...data })),
  remove: vi.fn(async () => undefined),
  reorder: vi.fn(async () => undefined),
};

describe('content controllers', () => {
  let app: INestApplication;
  let adminCookie: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [
        ...createContentControllers(projects),
        ...createContentControllers(experiences),
      ],
      providers: [
        TokenService,
        JwtAuthGuard,
        { provide: ENV, useValue: TEST_ENV },
        { provide: serviceToken(projects), useValue: service },
        { provide: serviceToken(experiences), useValue: service },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, TEST_ENV);
    await app.init();
    const token = await app.get(TokenService).signAccess(ID);
    adminCookie = [`access_token=${token}`];
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  it('serves published content publicly', async () => {
    const res = await http().get('/api/projects').expect(200);
    expect(res.body).toEqual([{ id: ID }]);
    expect(service.listPublic).toHaveBeenCalled();
  });

  it('serves a published entry by slug and refuses invalid or unsupported slugs', async () => {
    await http().get('/api/projects/slug/my-project').expect(200);
    await http().get('/api/projects/slug/Not%20A%20Slug').expect(404);
    await http().get('/api/experiences/slug/anything').expect(404);
  });

  it('requires authentication for every admin route', async () => {
    await http().get('/api/admin/projects').expect(401);
    await http().post('/api/admin/projects').send({}).expect(401);
    await http().patch(`/api/admin/projects/${ID}`).send({}).expect(401);
    await http().delete(`/api/admin/projects/${ID}`).expect(401);
    await http().put('/api/admin/projects/reorder').send({ ids: [] }).expect(401);
  });

  it('rejects a forged access cookie', async () => {
    await http()
      .get('/api/admin/projects')
      .set('Cookie', ['access_token=forged.jwt.token'])
      .expect(401);
  });

  it('forbids caching of everything private, and leaves public content cacheable', async () => {
    const admin = await http().get('/api/admin/projects').set('Cookie', adminCookie).expect(200);
    expect(admin.headers['cache-control']).toBe('no-store');
    const refused = await http().get('/api/admin/projects').expect(401);
    expect(refused.headers['cache-control']).toBe('no-store');
    const publicList = await http().get('/api/projects').expect(200);
    expect(publicList.headers['cache-control']).not.toBe('no-store');
  });

  it('lists everything for the admin, including drafts', async () => {
    const res = await http().get('/api/admin/projects').set('Cookie', adminCookie).expect(200);
    expect(res.body[0].published).toBe(false);
  });

  it('validates create payloads and strips nothing silently (unknown fields are rejected)', async () => {
    const valid = { slug: 'p', title: { en: 'T' }, summary: { en: 'S' } };
    await http().post('/api/admin/projects').set('Cookie', adminCookie).send(valid).expect(201);
    await http()
      .post('/api/admin/projects')
      .set('Cookie', adminCookie)
      .send({ ...valid, role: 'admin' })
      .expect(400);
    await http()
      .post('/api/admin/projects')
      .set('Cookie', adminCookie)
      .send({ ...valid, title: { fr: 'x' } })
      .expect(400);
  });

  it('allows partial updates but still validates what is sent', async () => {
    await http()
      .patch(`/api/admin/projects/${ID}`)
      .set('Cookie', adminCookie)
      .send({ published: true })
      .expect(200);
    await http()
      .patch(`/api/admin/projects/${ID}`)
      .set('Cookie', adminCookie)
      .send({ slug: 'BAD SLUG' })
      .expect(400);
  });

  it('rejects malformed ids before touching the service', async () => {
    service.findOne.mockClear();
    await http().get('/api/admin/projects/not-an-id').set('Cookie', adminCookie).expect(400);
    await http().get('/api/admin/projects/$gt').set('Cookie', adminCookie).expect(400);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('reorders and deletes', async () => {
    await http()
      .put('/api/admin/projects/reorder')
      .set('Cookie', adminCookie)
      .send({ ids: [ID] })
      .expect(204);
    await http()
      .put('/api/admin/projects/reorder')
      .set('Cookie', adminCookie)
      .send({ ids: ['x'] })
      .expect(400);
    await http().delete(`/api/admin/projects/${ID}`).set('Cookie', adminCookie).expect(204);
  });
});
