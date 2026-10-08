import { expect, test } from '@playwright/test';
import { TINY_PNG, watchBrowserProblems } from './helpers';

// One full content cycle in the real back-office: create a draft, translate it, publish it, see it
// on the public site, then delete it. The session comes from the setup project.
test.describe.configure({ mode: 'serial' });

const slug = `e2e-post-${Date.now().toString(36)}`;
const title = `E2E post ${slug.slice(-4)}`;

test('a signed-in admin lands on the profile and sees every section', async ({ page }) => {
  const problems = watchBrowserProblems(page);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/profile$/);
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveValue('Alex Placeholder');
  const links = await page
    .getByRole('navigation', { name: 'Content' })
    .getByRole('link')
    .allInnerTexts();
  expect(links).toEqual([
    'Profile',
    'Experience',
    'Skills',
    'Projects',
    'Education',
    'Certificates',
    'Testimonials',
    'Blog posts',
  ]);
  // The public header and the command palette do not exist in here.
  await expect(page.locator('app-site-header')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expect(problems()).toEqual([]);
});

test('creating a post validates, previews sanitized Markdown and uploads a cover image', async ({
  page,
  request,
}) => {
  await page.goto('/admin/posts');
  await page.getByRole('link', { name: 'New blog post' }).first().click();
  await expect(page.getByRole('heading', { name: 'New blog post' })).toBeVisible();

  // Nothing is saved while required fields are empty; focus goes to the first problem.
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Some fields need attention')).toBeVisible();
  await expect(page.getByLabel('Slug')).toBeFocused();
  await page.getByLabel('Slug').fill('Not A Valid Slug');
  await expect(page.getByText('Use lowercase letters, numbers and single hyphens.')).toBeVisible();

  await page.getByLabel('Slug').fill(slug);
  await page.locator('#f-title-en').fill(title);
  await page.locator('#f-excerpt-en').fill('Written by the end-to-end suite.');

  const body = page.locator('#f-body-input');
  await body.fill(
    '## Heading\n\nSome **bold** text <script>window.__pwned = true</script><img src=x onerror="window.__pwned = true">\n\n- one\n- two',
  );
  const preview = page.locator('.markdown').first();
  await expect(preview.locator('h2')).toHaveText('Heading');
  await expect(preview.locator('strong')).toHaveText('bold');
  await expect(preview.locator('li')).toHaveCount(2);
  expect(await preview.innerHTML()).not.toMatch(/<script|onerror/);
  expect(
    await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned),
  ).toBeUndefined();

  // The toolbar acts on the selection.
  await body.fill('make this strong');
  await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 9));
  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(body).toHaveValue('make **this** strong');
  await body.fill('## Heading\n\nSome **bold** text.\n\n- one\n- two');

  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'Cover Photo.png', mimeType: 'image/png', buffer: TINY_PNG });
  const cover = page.locator('app-image-input input[type="text"]');
  await expect(cover).toHaveValue(/^\/api\/media\/[a-f0-9]{24}$/);
  const media = await request.get(await cover.inputValue());
  expect(media.status()).toBe(200);
  expect(media.headers()['content-type']).toBe('image/webp');
  expect(media.headers()['cache-control']).toContain('immutable');

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  const row = page.locator('ol > li').filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row.getByText('Draft')).toBeVisible();
});

test('a draft is private; translating and publishing it makes it public', async ({
  page,
  request,
}) => {
  const publicPosts = async () =>
    (await (await request.get('/api/posts')).json()) as { slug: string }[];
  expect((await publicPosts()).some((p) => p.slug === slug)).toBe(false);

  await page.goto('/admin/posts');
  const row = () => page.locator('ol > li').filter({ hasText: title });
  await row().getByRole('link', { name: /^Edit/ }).click();
  await expect(page.getByRole('heading', { name: `Edit blog post: ${title}` })).toBeVisible();

  // Translations are typed by hand; French is left empty on purpose and Arabic is right-to-left.
  const arabic = page.locator('#f-title-ar');
  await expect(arabic).toHaveAttribute('dir', 'rtl');
  await arabic.fill('مقال تجريبي');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(`Saved “${title}”.`)).toBeVisible();

  await page.goto('/admin/posts');
  await expect(
    row()
      .getByText('AR Arabic translation partly done')
      .or(row().getByText('AR Arabic translation complete')),
  ).toBeAttached();
  await expect(row().getByText('FR French translation missing')).toBeAttached();

  await row()
    .getByRole('button', { name: /^Publish/ })
    .click();
  await expect(row().getByText('Published', { exact: true })).toBeVisible();
  await expect.poll(async () => (await publicPosts()).some((p) => p.slug === slug)).toBe(true);
});

test('the published post appears on the public site and renders safely', async ({ page }) => {
  const problems = watchBrowserProblems(page);
  await page.goto('/en/blog');
  // The static page predates this post: it arrives with the live refresh from the API.
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  await page.getByRole('link', { name: title }).click();
  await expect(page.locator('.markdown h2')).toHaveText('Heading');
  await expect(page.locator('img[src^="/api/media/"]').first()).toBeVisible();
  expect(problems()).toEqual([]);

  await page.goto(`/ar/blog/${slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مقال تجريبي');
});

test('entries are reordered with the keyboard-friendly buttons and the order sticks', async ({
  page,
  request,
}) => {
  const order = async () =>
    ((await (await request.get('/api/projects')).json()) as { slug: string }[]).map((p) => p.slug);
  const before = await order();
  expect(before.length).toBeGreaterThanOrEqual(3);

  await page.goto('/admin/projects');
  await expect(page.locator('ol > li')).toHaveCount(before.length);
  await page.locator('ol > li').first().getByRole('button', { name: /down$/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /moved to position 2/ })).toBeAttached();
  await expect.poll(order).toEqual([before[1], before[0], ...before.slice(2)]);

  await page.reload();
  await page.locator('ol > li').first().getByRole('button', { name: /down$/ }).click();
  await expect.poll(order).toEqual(before);
});

test('leaving a form with unsaved changes asks first', async ({ page }) => {
  await page.goto('/admin/profile');
  await page.getByLabel('Full name').fill('Someone Else');
  const dialogs: string[] = [];
  page.once('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page
    .getByRole('navigation', { name: 'Content' })
    .getByRole('link', { name: 'Skills' })
    .click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toContain('unsaved changes');
  await expect(page).toHaveURL(/\/admin\/profile$/);
  await expect(page.getByLabel('Full name')).toHaveValue('Someone Else');
});

test('deleting asks for confirmation and removes the post everywhere', async ({
  page,
  request,
}) => {
  await page.goto('/admin/posts');
  const row = () => page.locator('ol > li').filter({ hasText: title });
  await row()
    .getByRole('button', { name: /^Delete/ })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Delete blog post?');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(row()).toBeVisible();

  await row()
    .getByRole('button', { name: /^Delete/ })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(row()).toHaveCount(0);
  await expect
    .poll(async () =>
      ((await (await request.get('/api/posts')).json()) as { slug: string }[]).some(
        (p) => p.slug === slug,
      ),
    )
    .toBe(false);
  expect((await request.get(`/api/posts/slug/${slug}`)).status()).toBe(404);
});
