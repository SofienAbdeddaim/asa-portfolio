import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { OriginGuard } from './common/origin.guard.js';
import { AppThrottlerGuard } from './common/throttler.guard.js';
import { ConfigModule } from './config/config.module.js';
import { ENV, type Env } from './config/env.js';
import { ContentModule } from './content/content.module.js';
import { HealthController } from './health/health.controller.js';
import { MediaModule } from './media/media.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          redact: {
            paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
            censor: '[redacted]',
          },
          autoLogging: { ignore: (req) => req.url?.endsWith('/health') ?? false },
        },
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ uri: env.MONGODB_URI }),
    }),
    // Global default: 100 requests per minute per IP. Auth routes override this with a stricter limit.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    ContentModule,
    MediaModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AppModule {}
