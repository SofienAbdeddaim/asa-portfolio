import { expect, test as setup } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../env';
import { AUTH_DIR, codeForStep, currentStep, saveSecrets, signInWithPassword } from './helpers';

setup(
  'the first sign-in enrolls two-factor authentication and shows one-time recovery codes',
  async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);

    await signInWithPassword(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page.getByRole('heading', { name: 'Set up two-factor' })).toBeVisible();
    await expect(page.getByAltText(/QR code/)).toBeVisible();
    const secret = (await page.getByTestId('secret').innerText()).trim();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);

    // A wrong code is refused and does not enroll anything.
    await page.getByLabel('6-digit code').fill('000000');
    await page.getByRole('button', { name: 'Turn on two-factor authentication' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'not accepted' })).toBeVisible();

    const step = currentStep();
    await page.getByLabel('6-digit code').fill(codeForStep(secret, step));
    await page.getByRole('button', { name: 'Turn on two-factor authentication' }).click();

    await expect(page.getByRole('heading', { name: 'Save your recovery codes' })).toBeVisible();
    const codes = await page.getByTestId('recovery-codes').locator('li').allInnerTexts();
    expect(codes).toHaveLength(10);
    for (const code of codes) expect(code.trim()).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    expect(new Set(codes).size).toBe(10);

    // The next step is gated on confirming the codes were saved.
    const open = page.getByRole('button', { name: 'Open the back-office' });
    await expect(open).toBeDisabled();
    await page.getByRole('checkbox', { name: /saved these recovery codes/ }).check();
    await open.click();
    await expect(page).toHaveURL(/\/admin\/profile$/);
    await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();

    saveSecrets({
      totpSecret: secret,
      recoveryCodes: codes.map((code) => code.trim()),
      lastStep: step,
    });
    await page.context().storageState({ path: `${AUTH_DIR}state.json` });
  },
);
