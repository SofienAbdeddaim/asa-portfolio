import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import { configureApp } from '../src/bootstrap.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { SESSION_MODEL } from '../src/auth/session.schema.js';
import { TokenService } from '../src/auth/token.service.js';
import { TotpService } from '../src/auth/totp.service.js';
import { USER_MODEL } from '../src/auth/user.schema.js';
import { OriginGuard } from '../src/common/origin.guard.js';
import { AppThrottlerGuard } from '../src/common/throttler.guard.js';
import { ENV, type Env } from '../src/config/env.js';
import { createFakeModel } from './fake-model.js';

export const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  MONGODB_URI: 'mongodb://unused',
  JWT_SECRET: 'x'.repeat(48),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  TOTP_ISSUER: 'Test',
  CORS_ORIGIN: 'http://localhost:4200',
  COOKIE_SECURE: false,
  SWAGGER_ENABLED: false,
  TRUST_PROXY_HOPS: 1,
  LOG_LEVEL: 'silent',
};

export const userDefaults = {
  totpEnabled: false,
  lastTotpStep: 0,
  recoveryCodeHashes: [],
  failedLogins: 0,
  failedMfa: 0,
};

/** Builds a Nest app around the real auth stack with in-memory models (no database). */
export async function createAuthApp(throttleLimit = 1000): Promise<{
  app: INestApplication;
  users: ReturnType<typeof createFakeModel>;
  sessions: ReturnType<typeof createFakeModel>;
  auth: AuthService;
}> {
  const users = createFakeModel(userDefaults);
  const sessions = createFakeModel();
  const moduleRef = await Test.createTestingModule({
    imports: [
      JwtModule.register({}),
      // The strict per-route limits on auth routes still apply on top of this default.
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: throttleLimit }]),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      TokenService,
      TotpService,
      JwtAuthGuard,
      { provide: ENV, useValue: TEST_ENV },
      { provide: getModelToken(USER_MODEL), useValue: users },
      { provide: getModelToken(SESSION_MODEL), useValue: sessions },
      { provide: APP_GUARD, useClass: AppThrottlerGuard },
      { provide: APP_GUARD, useClass: OriginGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, TEST_ENV);
  await app.init();
  return { app, users, sessions, auth: app.get(AuthService) };
}

export const totpCode = (secret: string, timestamp = Date.now()): string =>
  new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate({
    timestamp,
  });
