import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './a11y';

// Content is fully visible with reduced motion, so contrast is measured on the final colours.
test.use({ reducedMotion: 'reduce' });

const LOCALES = ['en', 'fr', 'ar'] as const;
const PAGES = ['', '/blog', '/blog/hello-world', '/cv'] as const;

async function open(page: Page, path: string, theme: 'light' | 'dark'): Promise<void> {
  await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('main, [role="main"]').first()).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  for (const locale of LOCALES) {
    for (const path of PAGES) {
      test(`${locale}${path || ' home'} has no accessibility violations (${theme})`, async ({
        page,
      }) => {
        await open(page, `/${locale}${path}`, theme);
        await expectAccessible(page, `/${locale}${path} ${theme}`);
      });
    }
  }
}

test('the localized not-found page is accessible', async ({ page }) => {
  await open(page, '/ar/nothing-here', 'light');
  await expectAccessible(page, '404 in Arabic');
});

test('open overlays are accessible: the command palette and the mobile menu', async ({ page }) => {
  await open(page, '/en', 'light');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
  await expectAccessible(page, 'command palette');
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /menu/i }).click();
  await expect(page.getByRole('navigation', { name: 'Language' })).toBeVisible();
  await expectAccessible(page, 'mobile menu');
});

test('the audit itself catches problems (so a green run means something)', async ({ page }) => {
  await page.goto('/en');
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<img src="/favicon.ico"><button></button><p style="color:#bbb;background:#fff">Pale text</p>',
    );
  });
  await expect(expectAccessible(page, 'a page with known problems')).rejects.toThrow(
    /image-alt|button-name|color-contrast/,
  );
});

test('the sign-in page is accessible', async ({ page }) => {
  await open(page, '/admin/login', 'light');
  await expectAccessible(page, 'sign-in');
});
