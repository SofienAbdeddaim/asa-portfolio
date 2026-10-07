import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import argon2 from 'argon2';
import { Types, type Model } from 'mongoose';
import {
  decrypt,
  encrypt,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  randomToken,
  safeEqual,
  sha256Hex,
} from '../common/crypto.js';
import { ENV, type Env } from '../config/env.js';
import { SESSION_MODEL, type SessionDocument } from './session.schema.js';
import { REFRESH_TTL_SECONDS, TokenService } from './token.service.js';
import { TotpService } from './totp.service.js';
import { USER_MODEL, type UserDocument } from './user.schema.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 12;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  /** Spends the same hashing time when the email is unknown (no user enumeration). */
  private dummyHash?: Promise<string>;

  constructor(
    @InjectModel(USER_MODEL) private readonly users: Model<UserDocument>,
    @InjectModel(SESSION_MODEL) private readonly sessions: Model<SessionDocument>,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(TotpService) private readonly totp: TotpService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ---- admin bootstrap (used by the seed CLI) ----------------------------------------------

  async createAdmin(email: string, password: string): Promise<{ created: boolean }> {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const normalized = email.trim().toLowerCase();
    if (await this.users.exists({ email: normalized })) return { created: false };
    await this.users.create({
      email: normalized,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    });
    return { created: true };
  }

  // ---- step 1: password ---------------------------------------------------------------------

  async login(
    email: string,
    password: string,
  ): Promise<{ challenge: string; mfaEnrolled: boolean }> {
    const user = await this.users.findOne({ email: email.trim().toLowerCase() });
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        'Too many failed attempts, try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await argon2.verify(hash, password).catch(() => false);
    if (!user || !valid) {
      if (user) await this.recordFailure(user);
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.users.updateOne(
      { _id: user._id },
      { $set: { failedLogins: 0 }, $unset: { lockedUntil: 1 } },
    );
    return { challenge: await this.tokens.signChallenge(user.id), mfaEnrolled: user.totpEnabled };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash(randomToken(), { type: argon2.argon2id });
    return this.dummyHash;
  }

  private async recordFailure(user: UserDocument): Promise<void> {
    const failed = user.failedLogins + 1;
    if (failed >= MAX_FAILED_LOGINS) {
      await this.users.updateOne(
        { _id: user._id },
        { $set: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } },
      );
    } else {
      await this.users.updateOne({ _id: user._id }, { $set: { failedLogins: failed } });
    }
  }

  // ---- step 2a: 2FA enrollment (first login) ------------------------------------------------

  async beginTotpEnrollment(challenge: string) {
    const user = await this.userFromChallenge(challenge);
    if (user.totpEnabled) {
      throw new ConflictException('Two-factor authentication is already enabled');
    }
    const secret = this.totp.generateSecret();
    await this.users.updateOne(
      { _id: user._id },
      { $set: { totpPendingSecretEnc: encrypt(secret, this.env.TOTP_ENCRYPTION_KEY) } },
    );
    return this.totp.enrollmentPayload(secret, user.email);
  }

  async enableTotp(
    challenge: string,
    code: string,
  ): Promise<{ recoveryCodes: string[]; tokens: SessionTokens }> {
    const user = await this.userFromChallenge(challenge);
    if (user.totpEnabled) {
      throw new ConflictException('Two-factor authentication is already enabled');
    }
    if (!user.totpPendingSecretEnc) throw new BadRequestException('Start enrollment first');
    const secret = decrypt(user.totpPendingSecretEnc, this.env.TOTP_ENCRYPTION_KEY);
    const step = this.totp.verify(secret, code);
    if (step === null) throw new UnauthorizedException('Invalid code');
    const recoveryCodes = generateRecoveryCodes();
    await this.users.updateOne(
      { _id: user._id },
      {
        $set: {
          totpEnabled: true,
          totpSecretEnc: user.totpPendingSecretEnc,
          lastTotpStep: step,
          recoveryCodeHashes: recoveryCodes.map((c) => sha256Hex(normalizeRecoveryCode(c))),
        },
        $unset: { totpPendingSecretEnc: 1 },
      },
    );
    return { recoveryCodes, tokens: await this.issueSession(user.id) };
  }

  // ---- step 2b: 2FA verification (every later login) ----------------------------------------

  async verifyMfa(
    challenge: string,
    input: { code?: string; recoveryCode?: string },
  ): Promise<SessionTokens> {
    const user = await this.userFromChallenge(challenge);
    if (!user.totpEnabled || !user.totpSecretEnc) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    if (input.recoveryCode !== undefined) {
      const hash = sha256Hex(normalizeRecoveryCode(input.recoveryCode));
      const consumed = await this.users.updateOne(
        { _id: user._id, recoveryCodeHashes: hash },
        { $pull: { recoveryCodeHashes: hash } },
      );
      if (consumed.modifiedCount !== 1) throw new UnauthorizedException('Invalid recovery code');
      return this.issueSession(user.id);
    }

    const secret = decrypt(user.totpSecretEnc, this.env.TOTP_ENCRYPTION_KEY);
    const step = this.totp.verify(secret, input.code ?? '');
    if (step === null || step <= user.lastTotpStep) throw new UnauthorizedException('Invalid code');
    // The conditional update makes the replay check atomic across concurrent requests.
    const claimed = await this.users.updateOne(
      { _id: user._id, lastTotpStep: { $lt: step } },
      { $set: { lastTotpStep: step } },
    );
    if (claimed.modifiedCount !== 1) throw new UnauthorizedException('Invalid code');
    return this.issueSession(user.id);
  }

  private async userFromChallenge(challenge: string): Promise<UserDocument> {
    const userId = await this.tokens.verify(challenge, 'mfa');
    const user = Types.ObjectId.isValid(userId) ? await this.users.findById(userId) : null;
    if (!user) throw new UnauthorizedException('Invalid or expired token');
    return user;
  }

  // ---- sessions ------------------------------------------------------------------------------

  async issueSession(userId: string): Promise<SessionTokens> {
    const secret = randomToken();
    const session = await this.sessions.create({
      userId: new Types.ObjectId(userId),
      secretHash: sha256Hex(secret),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    });
    return {
      accessToken: await this.tokens.signAccess(userId),
      refreshToken: `${session.id}.${secret}`,
    };
  }

  /** Rotates the refresh token. Presenting an already-rotated token revokes every session. */
  async refresh(refreshToken: string | undefined): Promise<SessionTokens> {
    const [sessionId, secret] = (refreshToken ?? '').split('.');
    if (!sessionId || !secret || !Types.ObjectId.isValid(sessionId)) {
      throw new UnauthorizedException('Invalid session');
    }
    const session = await this.sessions.findById(sessionId);
    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid session');
    }
    if (!safeEqual(session.secretHash, sha256Hex(secret))) {
      await this.sessions.deleteMany({ userId: session.userId });
      throw new UnauthorizedException('Invalid session');
    }
    const next = randomToken();
    session.secretHash = sha256Hex(next);
    session.expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
    await session.save();
    return {
      accessToken: await this.tokens.signAccess(session.userId.toString()),
      refreshToken: `${session.id}.${next}`,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    const [sessionId] = (refreshToken ?? '').split('.');
    if (sessionId && Types.ObjectId.isValid(sessionId)) {
      await this.sessions.deleteOne({ _id: sessionId });
    }
  }

  async me(userId: string): Promise<{ id: string; email: string }> {
    const user = Types.ObjectId.isValid(userId) ? await this.users.findById(userId) : null;
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email };
  }
}
