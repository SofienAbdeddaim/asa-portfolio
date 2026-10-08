import { expect, request as playwrightRequest, test } from '@playwright/test';
import { BASE_URL } from '../env';
import { TINY_PNG } from './helpers';

// Uploads from a signed-in admin. The server trusts nothing the file claims about itself: the
// bytes must decode as a real raster image, and what is stored is always a fresh WebP.

const upload = (
  request: import('@playwright/test').APIRequestContext,
  name: string,
  mimeType: string,
  buffer: Buffer,
) => request.post('/api/admin/media', { multipart: { file: { name, mimeType, buffer } } });

test('files that are not raster images are refused, whatever their name or type says', async ({
  request,
}) => {
  const hostile: [string, string, string][] = [
    [
      'logo.svg',
      'image/svg+xml',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>',
    ],
    ['photo.png', 'image/png', '<html><script>alert(1)</script></html>'],
    ['photo.jpg', 'image/jpeg', '#!/bin/sh\necho owned\n'],
    ['doc.pdf', 'application/pdf', '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n'],
    ['empty.png', 'image/png', ''],
    ['cut.png', 'image/png', TINY_PNG.subarray(0, 20).toString('latin1')],
  ];
  for (const [name, mimeType, body] of hostile) {
    const response = await upload(request, name, mimeType, Buffer.from(body, 'latin1'));
    expect(response.status(), name).toBe(400);
  }
});

test('an upload that is too large is stopped, and a valid one comes back as a WebP with a safe name', async ({
  request,
}) => {
  const tooBig = await upload(
    request,
    'big.png',
    'image/png',
    Buffer.concat([TINY_PNG, Buffer.alloc(6 * 1024 * 1024)]),
  );
  expect(tooBig.status()).toBe(413);

  const stored = await upload(request, '../../etc/<script>passwd.png', 'image/png', TINY_PNG);
  expect(stored.status()).toBe(201);
  const image = (await stored.json()) as { id: string; url: string };
  expect(image.url).toBe(`/api/media/${image.id}`);

  // Anyone can fetch it (it is public content), and only ever as an image that can be kept forever.
  const visitor = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const served = await visitor.get(image.url);
  const bytes = await served.body();
  await visitor.dispose();
  expect(served.headers()['content-type']).toBe('image/webp');
  expect(served.headers()['x-content-type-options']).toBe('nosniff');
  expect(served.headers()['cache-control']).toContain('immutable');
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');

  expect((await request.delete(`/api/admin/media/${image.id}`)).status()).toBe(204);
  expect((await request.get(image.url)).status()).toBe(404);
});

test('the session cookies are only sent where they are needed', async ({ context }) => {
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'access_token')?.path).toBe('/api');
  expect(cookies.find((c) => c.name === 'refresh_token')?.path).toBe('/api/auth');
});
