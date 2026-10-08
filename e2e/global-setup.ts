import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_EMAIL, ADMIN_PASSWORD, apiEnv } from './env';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '..');

/** Starts every run from a known state: an empty database with one admin and the demo content. */
export default function globalSetup(): void {
  const env = {
    ...process.env,
    ...apiEnv,
    SEED_ADMIN_EMAIL: ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
  };
  const run = (command: string, args: string[]) =>
    execFileSync(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

  run('node', ['e2e/reset-db.mjs']);
  run('pnpm', ['--filter', '@asa/api', 'seed:admin']);
  run('pnpm', ['--filter', '@asa/api', 'seed:demo']);

  rmSync(resolve(here, '.auth'), { recursive: true, force: true });
  mkdirSync(resolve(here, '.auth'), { recursive: true });
}
