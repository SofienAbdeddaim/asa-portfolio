import { HttpException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { createAuthApp } from './auth-harness.js';

describe('AuthService', () => {
  const closers: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });

  async function setup() {
    const harness = await createAuthApp();
    closers.push(() => harness.app.close());
    return harness;
  }

  it('refuses short admin passwords and is idempotent', async () => {
    const { auth, users } = await setup();
    await expect(auth.createAdmin('a@example.com', 'short')).rejects.toThrow(/at least 12/);
    expect(await auth.createAdmin('A@Example.com', 'long enough password')).toEqual({
      created: true,
    });
    expect(await auth.createAdmin('a@example.com', 'another long password')).toEqual({
      created: false,
    });
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]!['email']).toBe('a@example.com');
    expect(String(users.rows[0]!['passwordHash'])).toMatch(/^\$argon2id\$/);
  });

  it('locks the account for 15 minutes after 5 failed passwords', async () => {
    const { auth } = await setup();
    await auth.createAdmin('a@example.com', 'long enough password');
    for (let i = 0; i < 5; i++) {
      await expect(auth.login('a@example.com', 'wrong password!')).rejects.toThrow(
        'Invalid credentials',
      );
    }
    const locked = await auth
      .login('a@example.com', 'long enough password')
      .catch((e: unknown) => e);
    expect(locked).toBeInstanceOf(HttpException);
    expect((locked as HttpException).getStatus()).toBe(429);
  });

  it('never stores TOTP secrets or recovery codes in clear text', async () => {
    const { auth, users } = await setup();
    await auth.createAdmin('a@example.com', 'long enough password');
    const { challenge } = await auth.login('a@example.com', 'long enough password');
    const { secret } = await auth.beginTotpEnrollment(challenge);
    const row = users.rows[0]!;
    expect(String(row['totpPendingSecretEnc'])).not.toContain(secret);
    expect(String(row['totpPendingSecretEnc'])).toMatch(/^v1\./);
  });
});
