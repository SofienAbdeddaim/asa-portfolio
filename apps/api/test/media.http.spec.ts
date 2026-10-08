import type { INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Readable, Writable } from 'node:stream';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { TokenService } from '../src/auth/token.service.js';
import { configureApp } from '../src/bootstrap.js';
import { ENV } from '../src/config/env.js';
import { MediaController } from '../src/media/media.controller.js';
import {
  MAX_DIMENSION,
  MAX_UPLOAD_BYTES,
  MEDIA_BUCKET,
  MediaService,
  safeName,
} from '../src/media/media.service.js';
import { TEST_ENV } from './auth-harness.js';

interface StoredFile {
  _id: Types.ObjectId;
  filename: string;
  length: number;
  metadata: Record<string, unknown>;
  data: Buffer;
}

/** In-memory stand-in for the parts of GridFSBucket the service uses. */
function fakeBucket() {
  const files = new Map<string, StoredFile>();
  return {
    files,
    openUploadStream(filename: string, options: { metadata: Record<string, unknown> }) {
      const id = new Types.ObjectId();
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
        final(callback) {
          const data = Buffer.concat(chunks);
          files.set(id.toString(), {
            _id: id,
            filename,
            length: data.length,
            metadata: options.metadata,
            data,
          });
          callback();
        },
      });
      return Object.assign(writable, { id });
    },
    find(filter: { _id: Types.ObjectId }) {
      return { toArray: async () => [files.get(String(filter._id))].filter(Boolean) };
    },
    openDownloadStream(id: Types.ObjectId) {
      return Readable.from(files.get(String(id))!.data);
    },
    async delete(id: Types.ObjectId) {
      if (!files.delete(String(id))) throw new Error(`FileNotFound: file ${id} was not found`);
    },
  };
}

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#ff5a36' } })
    .png()
    .toBuffer();

describe('media upload and delivery', () => {
  let app: INestApplication;
  let bucket: ReturnType<typeof fakeBucket>;
  let cookie: string[];

  beforeAll(async () => {
    bucket = fakeBucket();
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [MediaController],
      providers: [
        MediaService,
        TokenService,
        JwtAuthGuard,
        { provide: ENV, useValue: TEST_ENV },
        { provide: MEDIA_BUCKET, useValue: bucket },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, TEST_ENV);
    await app.init();
    cookie = [`access_token=${await app.get(TokenService).signAccess('64b7f0c2a1b2c3d4e5f60718')}`];
  });

  afterAll(() => app.close());
  beforeEach(() => bucket.files.clear());

  const http = () => request(app.getHttpServer());
  const upload = (data: Buffer, filename = 'photo.png', contentType = 'image/png') =>
    http()
      .post('/api/admin/media')
      .set('Cookie', cookie)
      .attach('file', data, { filename, contentType });

  it('requires authentication to upload or delete, but not to view', async () => {
    await http()
      .post('/api/admin/media')
      .attach('file', await png(10, 10), 'a.png')
      .expect(401);
    await http().delete(`/api/admin/media/${new Types.ObjectId()}`).expect(401);
    await http().get(`/api/media/${new Types.ObjectId()}`).expect(404);
  });

  it('stores a resized WebP and serves it publicly with an immutable cache header', async () => {
    const res = await upload(await png(2400, 1200)).expect(201);
    expect(res.body).toMatchObject({ width: MAX_DIMENSION, height: 800 });
    expect(res.body.url).toBe(`/api/media/${res.body.id}`);
    expect(res.body.bytes).toBeGreaterThan(0);

    const stored = bucket.files.get(res.body.id)!;
    expect(stored.data.subarray(0, 4).toString()).toBe('RIFF');
    expect(stored.data.subarray(8, 12).toString()).toBe('WEBP');

    const served = await http().get(res.body.url).expect(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(served.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(Number(served.headers['content-length'])).toBe(stored.length);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
  });

  it('never enlarges small images', async () => {
    const res = await upload(await png(120, 60)).expect(201);
    expect(res.body).toMatchObject({ width: 120, height: 60 });
  });

  it('applies the EXIF orientation and strips all metadata (including GPS and copyright)', async () => {
    const tagged = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#3ee0a5' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Copyright: 'secret-owner' } })
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();

    const res = await upload(tagged, 'photo.jpg', 'image/jpeg').expect(201);
    expect(res.body).toMatchObject({ width: 100, height: 200 });
    const output = bucket.files.get(res.body.id)!.data;
    expect((await sharp(output).metadata()).exif).toBeUndefined();
    expect(output.includes(Buffer.from('secret-owner'))).toBe(false);
  });

  it('checks the real content, not the declared type or the file name', async () => {
    await upload(Buffer.from('just some text'), 'photo.png', 'image/png').expect(400);
    await upload(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      'x.svg',
      'image/svg+xml',
    ).expect(400);
    await upload(Buffer.alloc(2048, 7), 'photo.jpg', 'image/jpeg').expect(400);
    const truncated = (await png(300, 300)).subarray(0, 200);
    await upload(truncated).expect(400);
    // A genuine image is accepted whatever it claims to be.
    await upload(await png(20, 20), 'photo.exe', 'application/x-msdownload').expect(201);
    expect(bucket.files.size).toBe(1);
  });

  it('refuses decompression bombs (too many pixels) before decoding them', async () => {
    const huge = await sharp({
      create: { width: 9000, height: 5000, channels: 3, background: '#000' },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(huge.length).toBeLessThan(MAX_UPLOAD_BYTES);
    await upload(huge).expect(400);
  });

  it('rejects a missing file, a wrongly named field and oversized uploads', async () => {
    await http().post('/api/admin/media').set('Cookie', cookie).expect(400);
    await http()
      .post('/api/admin/media')
      .set('Cookie', cookie)
      .attach('picture', await png(10, 10), 'a.png')
      .expect(400);
    await upload(Buffer.alloc(MAX_UPLOAD_BYTES + 1024, 1), 'big.png').expect(413);
    expect(bucket.files.size).toBe(0);
  });

  it('deletes an image once, then reports it as gone', async () => {
    const { body } = await upload(await png(30, 30)).expect(201);
    await http().delete(`/api/admin/media/${body.id}`).set('Cookie', cookie).expect(204);
    await http().get(body.url).expect(404);
    await http().delete(`/api/admin/media/${body.id}`).set('Cookie', cookie).expect(404);
  });

  it('rejects malformed ids', async () => {
    await http().get('/api/media/not-an-id').expect(400);
    await http().delete('/api/admin/media/%24gt').set('Cookie', cookie).expect(400);
  });
});

describe('safeName', () => {
  it('keeps a short harmless display name and always ends in .webp', () => {
    expect(safeName('My Holiday Photo.JPG')).toBe('My-Holiday-Photo.webp');
    expect(safeName('../../etc/passwd')).toBe('passwd.webp');
    expect(safeName('C:\\Users\\me\\pic.png')).toBe('pic.webp');
    expect(safeName('')).toBe('image.webp');
    expect(safeName('a'.repeat(200)).length).toBe(65);
  });
});
