import { defineConfig } from '@playwright/test';
import { API_PORT, BASE_URL, WEB_PORT, apiEnv } from './env';

const CI = !!process.env['CI'];

/**
 * End-to-end tests against the real stack: the built static site (served like production, with the
 * generated redirects and security headers), the real API and a throwaway MongoDB database.
 *
 * Locally this uses the installed Google Chrome; in CI, the Chromium that Playwright installs.
 * Order matters: `setup` enrolls the admin (a real sign-in with 2FA) and saves the session for the
 * projects that need one. One worker and no retries keep the sign-in rate limit predictable.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: BASE_URL,
    channel: CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'public', testMatch: /(public|language|a11y|keyboard|security)\.spec\.ts/ },
    { name: 'auth', testMatch: /auth\.spec\.ts/, dependencies: ['setup'] },
    {
      name: 'admin',
      testMatch: /(admin|backup)\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: '.auth/state.json' },
    },
  ],
  webServer: [
    {
      command: 'node ../apps/api/dist/main.js',
      url: `http://localhost:${API_PORT}/api/health`,
      env: apiEnv,
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: `node serve.mjs --port ${WEB_PORT} --api http://localhost:${API_PORT}`,
      url: `${BASE_URL}/en`,
      timeout: 30_000,
      reuseExistingServer: !CI,
    },
  ],
});
