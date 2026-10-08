import { expect, test } from '@playwright/test';
import { expectAccessible } from './a11y';

// The back-office with a signed-in session (from the setup project). Read-only: nothing is saved.
test.use({ reducedMotion: 'reduce' });

const SECTIONS = [
  'profile',
  'experiences',
  'skills',
  'projects',
  'education',
  'certificates',
  'testimonials',
  'posts',
];

for (const section of SECTIONS) {
  test(`the ${section} page is accessible`, async ({ page }) => {
    await page.goto(`/admin/${section}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expectAccessible(page, `/admin/${section}`);
  });
}

test('the editor form, with validation errors showing, is accessible', async ({ page }) => {
  await page.goto('/admin/posts');
  await page.getByRole('link', { name: 'New blog post' }).first().click();
  await expect(page.getByRole('heading', { name: 'New blog post' })).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Some fields need attention')).toBeVisible();
  await expectAccessible(page, 'blog post form with errors');
});

test('the delete confirmation dialog is accessible', async ({ page }) => {
  await page.goto('/admin/testimonials');
  await page
    .locator('ol > li')
    .first()
    .getByRole('button', { name: /^Delete/ })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectAccessible(page, 'confirm dialog');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
});
