import { expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as OTPAuth from 'otpauth';

const here = fileURLToPath(new URL('.', import.meta.url));
export const AUTH_DIR = fileURLToPath(new URL('../.auth/', import.meta.url));
const SECRETS_FILE = `${AUTH_DIR}secrets.json`;
const STEP_MS = 30_000;

interface Secrets {
  totpSecret: string;
  recoveryCodes: string[];
  /** Last time step used to sign in. The API refuses to accept a step twice. */
  lastStep: number;
}

export function saveSecrets(secrets: Secrets): void {
  writeFileSync(SECRETS_FILE, JSON.stringify(secrets));
}

export function readSecrets(): Secrets {
  if (!existsSync(SECRETS_FILE))
    throw new Error(`Run the setup project first (${SECRETS_FILE} is missing)`);
  return JSON.parse(readFileSync(SECRETS_FILE, 'utf8')) as Secrets;
}

const totp = (secret: string) =>
  new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });

export const currentStep = (): number => Math.floor(Date.now() / STEP_MS);

/** The code for a given 30 second step. */
export function codeForStep(secret: string, step: number): string {
  return totp(secret).generate({ timestamp: step * STEP_MS });
}

/**
 * A code the API will accept now and has not seen before. A step is only usable once, and the API
 * accepts one step either side of its clock, so this waits for the clock only when it has to.
 */
export async function freshCode(): Promise<string> {
  const secrets = readSecrets();
  const step = Math.max(currentStep(), secrets.lastStep + 1);
  const wait = (step - 1) * STEP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 200));
  saveSecrets({ ...secrets, lastStep: step });
  return codeForStep(secrets.totpSecret, step);
}

/** Collects what a visitor's browser would complain about: console errors and CSP violations. */
export function watchBrowserProblems(page: Page): () => string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
  void page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP violation: ${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
  return () => problems;
}

export async function signInWithPassword(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
}

export async function expectSignedOut(page: Page): Promise<void> {
  await page.goto('/admin/profile');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
}

export { here };

/** A valid 1x1 PNG, for upload tests. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
