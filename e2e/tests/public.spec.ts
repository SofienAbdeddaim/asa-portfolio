import { expect, test } from '@playwright/test';
import { watchBrowserProblems } from './helpers';

const LOCALES = [
  { code: 'en', dir: 'ltr', heading: 'Alex Placeholder', nav: 'Journey' },
  { code: 'fr', dir: 'ltr', heading: 'Alex Placeholder', nav: 'Parcours' },
  { code: 'ar', dir: 'rtl', heading: 'Alex Placeholder', nav: 'المسيرة' },
] as const;

for (const locale of LOCALES) {
  test(`the home page renders in ${locale.code} with the right language and direction`, async ({
    page,
  }) => {
    const problems = watchBrowserProblems(page);
    const response = await page.goto(`/${locale.code}`);
    expect(response?.status()).toBe(200);

    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', locale.code);
    await expect(html).toHaveAttribute('dir', locale.dir);
    // The name is drawn letter by letter; assistive technology reads it once, whole.
    await expect(page.locator('#hero-title .sr-only')).toHaveText(locale.heading);
    await expect(page.getByRole('link', { name: locale.nav }).first()).toBeVisible();
    for (const id of ['about', 'experience', 'skills', 'projects', 'play', 'kind', 'contact']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }

    // Search engines get everything in the static HTML.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/${locale.code}$`),
    );
    await expect(page.locator('link[rel="alternate"]')).toHaveCount(4);
    expect(await page.locator('script[type="application/ld+json"]').count()).toBe(1);

    // The page works with the API: it upgrades from the snapshot without errors.
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('status').filter({ hasText: /./ })).toHaveCount(0);
    expect(problems()).toEqual([]);
  });
}

test('the root sends visitors to their language, English by default', async ({
  request,
  browser,
}) => {
  for (const [accept, expected] of [
    ['ar-TN,ar;q=0.9', '/ar'],
    ['fr-FR,fr;q=0.9', '/fr'],
    ['de-DE,de;q=0.9', '/en'],
    ['', '/en'],
  ] as const) {
    const response = await request.get('/', {
      headers: { 'Accept-Language': accept },
      maxRedirects: 0,
    });
    expect(response.status(), accept).toBe(302);
    expect(response.headers()['location'], accept).toBe(expected);
  }

  // And in a real browser, whose language comes from its locale.
  const context = await browser.newContext({ locale: 'ar-TN' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/ar$/);
  await context.close();
});

test('unknown pages answer 404 with a localized message, and unknown languages fall back to English', async ({
  page,
}) => {
  const missing = await page.goto('/fr/does-not-exist');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();

  const unknown = await page.goto('/xx/anything');
  expect(unknown?.status()).toBe(404);
  await expect(page).toHaveURL(/\/en\/404$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('the blog lists posts and a post renders sanitized Markdown in the right direction', async ({
  page,
}) => {
  const problems = watchBrowserProblems(page);
  await page.goto('/en/blog');
  await expect(page.getByRole('heading', { name: 'Notes and writing', level: 1 })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(2);

  await page.getByRole('link', { name: 'Hello, world' }).click();
  await expect(page).toHaveURL(/\/en\/blog\/hello-world$/);
  await expect(page.locator('.markdown h1')).toHaveText('Hello');
  await expect(page.locator('.markdown strong')).toHaveText('markdown');
  expect(
    await page
      .locator('script')
      .evaluateAll((nodes) => nodes.filter((n) => n.closest('.markdown')).length),
  ).toBe(0);

  await page.goto('/ar/blog/hello-world');
  await expect(page.locator('.markdown')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.markdown h1')).toHaveText('مرحبا');

  // A post with no French text is shown in English, and says so.
  await page.goto('/fr/blog/building-for-rtl');
  await expect(page.getByRole('note')).toContainText('pas encore traduit');
  await expect(page.locator('.markdown')).toHaveAttribute('lang', 'en');
  expect(problems()).toEqual([]);
});

test('the CV is a clean single document in print', async ({ page }) => {
  await page.goto('/ar/cv');
  await expect(page.getByRole('heading', { name: 'Alex Placeholder', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الخبرة' })).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('app-site-header')).toBeHidden();
  await expect(page.locator('footer')).toBeHidden();
  await expect(page.getByRole('button', { name: /PDF/ })).toBeHidden();
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(255, 255, 255)');
  expect(
    await page.evaluate(() => getComputedStyle(document.querySelector('.cv')!).direction),
  ).toBe('rtl');
});

test('search engines are served sitemaps for every language, and kept out of the back-office', async ({
  request,
}) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);

  const index = await (await request.get('/sitemap.xml')).text();
  for (const code of ['fr', 'en', 'ar']) expect(index).toContain(`sitemap-${code}.xml`);
  const arabic = await (await request.get('/sitemap-ar.xml')).text();
  expect(arabic).toContain('/ar/blog/hello-world');
  expect(arabic).toContain('hreflang="x-default"');

  const admin = await request.get('/admin');
  expect(admin.headers()['x-robots-tag']).toContain('noindex');
});

test('every page carries the security headers', async ({ request }) => {
  for (const path of ['/en', '/ar/blog', '/admin/login']) {
    const headers = (await request.get(path)).headers();
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['x-frame-options'], path).toBe('DENY');
    expect(headers['strict-transport-security'], path).toContain('max-age=');
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
    const csp = headers['content-security-policy'] ?? '';
    expect(csp, path).toContain("frame-ancestors 'none'");
    expect(csp, path).toContain("object-src 'none'");
    expect(csp, path).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
  }
});

test('the API is only reachable through the same origin and answers its health check', async ({
  request,
}) => {
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: 'ok', database: 'up' });
  const content = await (await request.get('/api/content')).json();
  expect(content.profile.fullName).toBe('Alex Placeholder');
  expect(content.posts.length).toBeGreaterThanOrEqual(2);
});
