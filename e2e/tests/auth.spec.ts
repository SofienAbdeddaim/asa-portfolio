import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../env';
import {
  expectSignedOut,
  freshCode,
  readSecrets,
  saveSecrets,
  signInWithPassword,
} from './helpers';

// Sign-in is limited to 5 attempts a minute, so each test signs in at most once or twice.
test.describe.configure({ mode: 'serial' });

test('the back-office is closed to visitors who are not signed in', async ({ page, request }) => {
  await expectSignedOut(page);
  expect((await request.get('/api/admin/projects')).status()).toBe(401);
  expect((await request.get('/api/auth/me')).status()).toBe(401);
});

test('a wrong code is refused, the right one signs in, and signing out ends the session', async ({
  page,
  request,
}) => {
  await signInWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page.getByRole('heading', { name: 'Two-factor check' })).toBeVisible();
  await expect(page.getByLabel('6-digit code')).toHaveAttribute('autocomplete', 'one-time-code');

  await page.getByLabel('6-digit code').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'not accepted' })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/);

  await page.getByLabel('6-digit code').fill(await freshCode());
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/profile$/);

  // The session cookies are httpOnly and nothing is kept in web storage.
  const cookies = await page.context().cookies();
  for (const name of ['access_token', 'refresh_token']) {
    const cookie = cookies.find((c) => c.name === name);
    expect(cookie, name).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
  }
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toMatch(/token|eyJ/i);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await page.context().request.get('/api/auth/me')).status()).toBe(401);
  await expectSignedOut(page);
  void request;
});

test('a recovery code signs in once and then stops working', async ({ page }) => {
  const [code] = readSecrets().recoveryCodes;
  expect(code).toBeTruthy();

  await signInWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Use a recovery code' }).click();
  await page.getByLabel('Recovery code').fill(code!.toUpperCase());
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/profile$/);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);

  await signInWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Use a recovery code' }).click();
  await page.getByLabel('Recovery code').fill(code!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'not accepted' })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/);

  saveSecrets({ ...readSecrets(), recoveryCodes: readSecrets().recoveryCodes.slice(1) });
});
