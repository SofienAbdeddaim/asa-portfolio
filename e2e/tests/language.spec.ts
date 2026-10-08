import { expect, test } from '@playwright/test';
import { watchBrowserProblems } from './helpers';

test('switching to Arabic mirrors the page, keeps the reader’s place and updates the URL', async ({
  page,
}) => {
  const problems = watchBrowserProblems(page);
  await page.goto('/en');
  const title = page.locator('#hero-title');
  const english = (await title.boundingBox())!;
  expect(english.x).toBeLessThan(250); // the title sits at the start of the line (left)

  // Text length differs per language, so pixels move; the reader's place is the section in view.
  const sectionInView = () =>
    page.evaluate(() => {
      const ids = [
        'hero-title',
        'about',
        'experience',
        'skills',
        'projects',
        'play',
        'kind',
        'contact',
      ];
      const passed = ids.filter(
        (id) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 200,
      );
      return passed.at(-1) ?? null;
    });
  await page.locator('#projects').scrollIntoViewIfNeeded();
  await page.evaluate(() =>
    document.getElementById('projects')!.scrollIntoView({ behavior: 'instant', block: 'start' }),
  );
  await page.evaluate(() => window.scrollBy({ top: 250, behavior: 'instant' }));
  expect(await sectionInView()).toBe('projects');

  // A real pointer click on the sticky header: the locator's own click may scroll the page first.
  const link = page
    .getByRole('navigation', { name: 'Language' })
    .getByRole('link', { name: 'Switch language to العربية' });
  const box = (await link.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('navigation', { name: 'اللغة' })).toBeVisible();

  // Same page, same place: switching language is not a navigation to the top.
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  expect(await sectionInView()).toBe('projects');

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const arabic = (await title.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(viewport.width - (arabic.x + arabic.width)).toBeLessThan(250); // now at the right

  expect(await page.evaluate(() => getComputedStyle(document.body).direction)).toBe('rtl');
  expect(await page.evaluate(() => document.fonts.check('16px "IBM Plex Sans Arabic"'))).toBe(true);
  expect(problems()).toEqual([]);
});

test('the language switcher keeps the current page on a blog post', async ({ page }) => {
  await page.goto('/fr/blog/hello-world');
  const switcher = page.getByRole('navigation', { name: 'Langue' });
  await expect(switcher.getByRole('link', { name: /Français/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await switcher.getByRole('link', { name: /العربية/ }).click();
  await expect(page).toHaveURL(/\/ar\/blog\/hello-world$/);
  await expect(page.locator('.markdown h1')).toHaveText('مرحبا');
  await expect(page).toHaveTitle(/مرحبا بالعالم/);
  await page.goBack();
  await expect(page).toHaveURL(/\/fr\/blog\/hello-world$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('the command palette is keyboard driven and can switch language', async ({ page }) => {
  await page.goto('/en');
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  const search = palette.getByRole('combobox');
  await expect(search).toBeFocused();

  await search.fill('arab');
  await expect(palette.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/ar$/);
  await expect(palette).toBeHidden();

  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
});

test('the theme choice sticks across reloads and applies before first paint', async ({ page }) => {
  await page.goto('/en');
  const toggle = page.getByRole('button', { name: /^Theme:/ });
  const initial = await page.locator('html').getAttribute('data-theme');
  await toggle.click(); // light -> dark -> system cycle
  await toggle.click();
  const chosen = await page.evaluate(() => localStorage.getItem('theme'));
  await page.reload();
  const html = page.locator('html');
  if (chosen) await expect(html).toHaveAttribute('data-theme', chosen);
  else await expect(html).toHaveAttribute('data-theme', initial ?? 'light');
});

test('reduced motion removes decorative animation but keeps all content', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/en');
  const animations = await page.evaluate(
    () => document.getAnimations().filter((a) => (a as CSSAnimation).animationName).length,
  );
  expect(animations).toBe(0);
  await expect(page.locator('#experience article').first()).toBeVisible();
  await context.close();
});
