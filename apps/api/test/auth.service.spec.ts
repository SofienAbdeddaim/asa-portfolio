import { HttpException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { hmacHex, sha256Hex } from '../src/common/crypto.js';
import { TEST_ENV, createAuthApp, totpCode } from './auth-harness.js';

const EMAIL = 'a@example.com';
const PASSWORD = 'long enough password';
const DAY = 24 * 60 * 60 * 1000;

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

  /** An admin who has signed in once and set up two-factor authentication. */
  async function enrolled() {
    const harness = await setup();
    const { auth } = harness;
    await auth.createAdmin(EMAIL, PASSWORD);
    const { challenge } = await auth.login(EMAIL, PASSWORD);
    const { secret } = await auth.beginTotpEnrollment(challenge);
    const { recoveryCodes, tokens } = await auth.enableTotp(challenge, totpCode(secret));
    return { ...harness, secret, recoveryCodes, tokens };
  }

  const statusOf = (error: unknown) => (error as HttpException).getStatus();

  it('refuses short admin passwords and is idempotent', async () => {
    const { auth, users } = await setup();
    await expect(auth.createAdmin('a@example.com', 'short')).rejects.toThrow(/at least 12/);
    expect(await auth.createAdmin('A@Example.com', PASSWORD)).toEqual({ created: true });
    expect(await auth.createAdmin('a@example.com', 'another long password')).toEqual({
      created: false,
    });
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0]!['email']).toBe('a@example.com');
    expect(String(users.rows[0]!['passwordHash'])).toMatch(/^\$argon2id\$/);
  });

  it('locks the account for 15 minutes after 5 failed passwords', async () => {
    const { auth } = await setup();
    await auth.createAdmin(EMAIL, PASSWORD);
    for (let i = 0; i < 5; i++) {
      await expect(auth.login(EMAIL, 'wrong password!')).rejects.toThrow('Invalid credentials');
    }
    const locked = await auth.login(EMAIL, PASSWORD).catch((e: unknown) => e);
    expect(locked).toBeInstanceOf(HttpException);
    expect(statusOf(locked)).toBe(429);
  });

  it('never stores TOTP secrets or recovery codes in clear text', async () => {
    const { auth, users } = await setup();
    await auth.createAdmin(EMAIL, PASSWORD);
    const { challenge } = await auth.login(EMAIL, PASSWORD);
    const { secret } = await auth.beginTotpEnrollment(challenge);
    const row = users.rows[0]!;
    expect(String(row['totpPendingSecretEnc'])).not.toContain(secret);
    expect(String(row['totpPendingSecretEnc'])).toMatch(/^v1\./);
  });

  describe('second factor', () => {
    it('locks the account after 5 wrong codes, even for someone who knows the password', async () => {
      const { auth, secret } = await enrolled();
      const { challenge } = await auth.login(EMAIL, PASSWORD);
      for (let i = 0; i < 5; i++) {
        await expect(auth.verifyMfa(challenge, { code: '000000' })).rejects.toThrow('Invalid code');
      }
      // Even the right code is refused now, and so is signing in again.
      const next = totpCode(secret, Date.now() + 30_000);
      expect(
        statusOf(await auth.verifyMfa(challenge, { code: next }).catch((e: unknown) => e)),
      ).toBe(429);
      expect(statusOf(await auth.login(EMAIL, PASSWORD).catch((e: unknown) => e))).toBe(429);
    });

    it('counts wrong codes across sign-ins, and a good code starts the count over', async () => {
      const { auth, users, secret } = await enrolled();
      // A correct password does not reset the second-factor count.
      for (let i = 0; i < 4; i++) {
        const { challenge } = await auth.login(EMAIL, PASSWORD);
        await expect(auth.verifyMfa(challenge, { code: '000000' })).rejects.toThrow('Invalid code');
      }
      expect(users.rows[0]!['failedMfa']).toBe(4);

      const { challenge } = await auth.login(EMAIL, PASSWORD);
      await auth.verifyMfa(challenge, { code: totpCode(secret, Date.now() + 30_000) });
      expect(users.rows[0]!['failedMfa']).toBe(0);
    });

    it('counts wrong recovery codes the same way', async () => {
      const { auth, users } = await enrolled();
      const { challenge } = await auth.login(EMAIL, PASSWORD);
      for (let i = 0; i < 5; i++) {
        await expect(auth.verifyMfa(challenge, { recoveryCode: '00000-00000' })).rejects.toThrow(
          'Invalid recovery code',
        );
      }
      expect(users.rows[0]!['lockedUntil']).toBeInstanceOf(Date);
    });

    it('stores recovery codes as keyed hashes that cannot be checked without the server key', async () => {
      const { auth, users, recoveryCodes } = await enrolled();
      const stored = users.rows[0]!['recoveryCodeHashes'] as string[];
      expect(stored).toHaveLength(10);
      for (const code of recoveryCodes) {
        expect(stored).not.toContain(sha256Hex(code)); // a plain hash would be guessable offline
        expect(stored).toContain(hmacHex(code, TEST_ENV.TOTP_ENCRYPTION_KEY));
      }
      expect(hmacHex('a1b2c-3d4e5', TEST_ENV.TOTP_ENCRYPTION_KEY)).not.toBe(
        hmacHex('a1b2c-3d4e5', Buffer.alloc(32, 9).toString('base64')),
      );

      const { challenge } = await auth.login(EMAIL, PASSWORD);
      const [first] = recoveryCodes;
      await expect(
        auth.verifyMfa(challenge, { recoveryCode: first!.toUpperCase() }),
      ).resolves.toBeTruthy();
      await expect(auth.verifyMfa(challenge, { recoveryCode: first! })).rejects.toThrow(
        'Invalid recovery code',
      );
    });
  });

  describe('sessions', () => {
    it('signing out needs the session secret, not just its id', async () => {
      const { auth, sessions, tokens } = await enrolled();
      const [id] = tokens.refreshToken.split('.');
      await auth.logout(id);
      await auth.logout(`${id}.not-the-secret`);
      await auth.logout(undefined);
      expect(sessions.rows).toHaveLength(1);

      await auth.logout(tokens.refreshToken);
      expect(sessions.rows).toHaveLength(0);
    });

    it('ends a session 30 days after sign-in however often it was renewed', async () => {
      const { auth, sessions, tokens } = await enrolled();
      const renewed = await auth.refresh(tokens.refreshToken);
      sessions.rows[0]!['createdAt'] = new Date(Date.now() - 29 * DAY);
      const stillValid = await auth.refresh(renewed.refreshToken);

      sessions.rows[0]!['createdAt'] = new Date(Date.now() - 31 * DAY);
      await expect(auth.refresh(stillValid.refreshToken)).rejects.toThrow('Invalid session');
      expect(sessions.rows).toHaveLength(0);
    });

    it('treats a replayed refresh token as theft and ends every session', async () => {
      const { auth, sessions, tokens } = await enrolled();
      await auth.refresh(tokens.refreshToken);
      await expect(auth.refresh(tokens.refreshToken)).rejects.toThrow('Invalid session');
      expect(sessions.rows).toHaveLength(0);
    });
  });

  describe('account recovery (admin CLI)', () => {
    it('unlocks an account after failed attempts', async () => {
      const { auth } = await setup();
      await auth.createAdmin(EMAIL, PASSWORD);
      for (let i = 0; i < 5; i++) await auth.login(EMAIL, 'wrong password!').catch(() => undefined);
      expect(statusOf(await auth.login(EMAIL, PASSWORD).catch((e: unknown) => e))).toBe(429);

      expect(await auth.unlock(EMAIL.toUpperCase())).toBe(true);
      await expect(auth.login(EMAIL, PASSWORD)).resolves.toHaveProperty('challenge');
      expect(await auth.unlock('nobody@example.com')).toBe(false);
    });

    it('resets a lost second factor: sessions end and the next sign-in enrolls a new one', async () => {
      const { auth, users, sessions } = await enrolled();
      expect(await auth.resetTwoFactor(EMAIL)).toBe(true);

      expect(sessions.rows).toHaveLength(0);
      const row = users.rows[0]!;
      expect(row['totpEnabled']).toBe(false);
      expect(row['totpSecretEnc']).toBeUndefined();
      expect(row['recoveryCodeHashes']).toEqual([]);

      // The password is still required, and enrollment works again from scratch.
      await expect(auth.login(EMAIL, 'wrong password!')).rejects.toThrow('Invalid credentials');
      const { challenge, mfaEnrolled } = await auth.login(EMAIL, PASSWORD);
      expect(mfaEnrolled).toBe(false);
      const { secret } = await auth.beginTotpEnrollment(challenge);
      await expect(auth.enableTotp(challenge, totpCode(secret))).resolves.toHaveProperty('tokens');
      expect(await auth.resetTwoFactor('nobody@example.com')).toBe(false);
    });

    it('sets a new password, signs everyone out and clears any lockout', async () => {
      const { auth, sessions } = await enrolled();
      await expect(auth.setPassword(EMAIL, 'short')).rejects.toThrow(/at least 12/);
      expect(sessions.rows).toHaveLength(1);

      expect(await auth.setPassword(EMAIL, 'a brand new password')).toBe(true);
      expect(sessions.rows).toHaveLength(0);
      await expect(auth.login(EMAIL, PASSWORD)).rejects.toThrow('Invalid credentials');
      await expect(auth.login(EMAIL, 'a brand new password')).resolves.toHaveProperty('challenge');
      expect(await auth.setPassword('nobody@example.com', 'a brand new password')).toBe(false);
    });

    it('signs the admin out everywhere', async () => {
      const { auth, sessions } = await enrolled();
      expect(await auth.revokeSessions(EMAIL)).toBe(true);
      expect(sessions.rows).toHaveLength(0);
      expect(await auth.revokeSessions('nobody@example.com')).toBe(false);
    });
  });
});
