import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { AuthService } from '../auth/auth.service.js';

/**
 * Creates the first admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Idempotent: does nothing when the user already exists. Two-factor authentication is enrolled
 * on the first login. The password is never printed.
 */
async function main(): Promise<void> {
  const email = process.env['SEED_ADMIN_EMAIL'];
  const password = process.env['SEED_ADMIN_PASSWORD'];
  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const { created } = await app.get(AuthService).createAdmin(email, password);
    console.log(created ? `Admin created: ${email}` : `Admin already exists: ${email}`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
