import { expect, test, type Page } from '@playwright/test';

// What axe cannot judge: that the site can really be used without a mouse, on a narrow screen, and
// with a screen reader's expectations about focus. Reduced motion keeps the page still.
test.use({ reducedMotion: 'reduce' });

interface Stop {
  label: string;
  visible: boolean;
  ring: boolean;
}

/** The element that has focus: what it is, whether it is on screen, and whether focus shows. */
function describeFocus(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const label =
      element.getAttribute('aria-label') ?? (element.textContent ?? '').trim().slice(0, 40);
    return {
      label: `${element.tagName.toLowerCase()} "${label}"`,
      visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
      ring:
        (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2) ||
        style.boxShadow !== 'none',
    };
  });
}

test('the skip link is the first stop and lands on the main content', async ({ page }) => {
  await page.goto('/en');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

for (const locale of ['en', 'ar'] as const) {
  test(`every control is reachable by Tab, visibly focused, and nothing traps focus (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await page.evaluate(() => document.fonts.ready);
    const stops: string[] = [];
    let reachedFooter = false;
    for (let press = 0; press < 160 && !reachedFooter; press += 1) {
      await page.keyboard.press('Tab');
      const stop = await describeFocus(page);
      expect(stop, `focus was lost after ${stops.at(-1) ?? 'the start'}`).not.toBeNull();
      expect(stop!.visible, `${stop!.label} is focused but off screen`).toBe(true);
      expect(stop!.ring, `${stop!.label} shows no focus indicator`).toBe(true);
      stops.push(stop!.label);
      reachedFooter = await page.evaluate(() => !!document.activeElement?.closest('footer'));
    }
    expect(
      reachedFooter,
      `never reached the footer; last stops: ${stops.slice(-5).join(', ')}`,
    ).toBe(true);
    // Skip link, header, CTAs, projects, stickers, contact: a page with this much has many stops.
    expect(stops.length).toBeGreaterThan(25);

    // And Shift+Tab walks back out without being stuck.
    for (let press = 0; press < 5; press += 1) await page.keyboard.press('Shift+Tab');
    expect(await describeFocus(page)).not.toBeNull();
  });
}

test('stickers move with the arrow keys', async ({ page }) => {
  await page.goto('/en');
  await page.locator('#play').scrollIntoViewIfNeeded(); // the stickers are drawn when the section is reached
  const sticker = page.getByRole('button', { name: /^Move the .* sticker$/ }).first();
  await expect(sticker).toBeVisible();
  await sticker.focus();
  const before = await sticker.boundingBox();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+ArrowRight');
  await expect
    .poll(async () => (await sticker.boundingBox())?.x ?? 0)
    .toBeGreaterThan((before?.x ?? 0) + 20);
  expect((await sticker.boundingBox())!.y).toBeGreaterThan(before!.y);
});

test('the command palette gives focus back to where it was opened from', async ({ page }) => {
  await page.goto('/en');
  const trigger = page.getByRole('button', { name: 'Open command palette' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole('combobox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('after a page change focus moves to the new heading, and the next Tab starts below it', async ({
  page,
}) => {
  await page.goto('/en');
  await page.getByRole('link', { name: 'Blog' }).first().click();
  await expect(page).toHaveURL(/\/en\/blog$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await describeFocus(page)).not.toBeNull();
  expect(await page.evaluate(() => !!document.activeElement?.closest('header'))).toBe(false);

  // Reached from the palette (a dialog that restores focus when it closes) as well.
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByRole('combobox').fill('cv');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en\/cv$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('a language switch keeps focus where it was and announces the new language', async ({
  page,
}) => {
  await page.goto('/en');
  const arabic = page
    .getByRole('navigation', { name: 'Language' })
    .getByRole('link', { name: 'Switch language to العربية' });
  await arabic.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/ar$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'تم تغيير اللغة إلى العربية' }),
  ).toBeAttached();
  expect(await page.evaluate(() => !!document.activeElement?.closest('header'))).toBe(true);
});

const NARROW_PAGES = [
  '/en',
  '/ar',
  '/fr/blog',
  '/en/blog/hello-world',
  '/ar/cv',
  '/en/not-a-page',
  '/admin/login',
];

for (const path of NARROW_PAGES) {
  test(`${path} reflows at 320px without horizontal scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => {
      const wide = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter(
          (element) =>
            element.getBoundingClientRect().right > innerWidth + 1 &&
            getComputedStyle(element).position !== 'fixed',
        )
        .filter((element) => !element.closest('.marquee, [aria-hidden="true"]'))
        .slice(0, 5)
        .map(
          (element) =>
            `${element.tagName.toLowerCase()}.${element.className.toString().slice(0, 40)}`,
        );
      return { scroll: document.documentElement.scrollWidth - innerWidth, wide };
    });
    expect(overflow.scroll, `wide elements: ${overflow.wide.join(', ')}`).toBeLessThanOrEqual(1);
  });
}

test('text can be spaced out and resized without losing content', async ({ page }) => {
  await page.goto('/en');
  // WCAG 1.4.12 text spacing, then a larger base size: nothing should be cut off or overlap into
  // unreadable text; here: the headline, the actions and the section links must all stay visible.
  await page.addStyleTag({
    content:
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } html { font-size: 125%; }',
  });
  await expect(page.locator('#hero-title')).toBeVisible();
  await expect(page.getByRole('button', { name: 'See my work' })).toBeVisible();
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('h1, h2, h3, button, a.btn, .chip')]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          style.overflow === 'hidden' &&
          element.scrollHeight > element.clientHeight + 2 &&
          !element.closest('.marquee')
        );
      })
      .map((element) => element.textContent?.trim().slice(0, 30)),
  );
  expect(clipped).toEqual([]);
});

test('with forced colours (high contrast) controls keep their borders and focus shows', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/en');
  const borderless = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a.btn')]
      .filter((element) => element.getBoundingClientRect().width > 0)
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.borderTopStyle === 'none' || Number.parseFloat(style.borderTopWidth) < 1;
      })
      .map(
        (element) => element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30),
      ),
  );
  expect(borderless).toEqual([]);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  expect((await describeFocus(page))?.ring).toBe(true);
});
