import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { mongoSanitizeMiddleware } from './common/mongo-sanitize.js';
import type { Env } from './config/env.js';

/** Shared by `main.ts` and the HTTP tests so both run the same middleware stack. */
export function configureApp(app: INestApplication, env: Env): void {
  const server = app.getHttpAdapter().getInstance() as Express;
  // Behind platform proxies: use the forwarded client IP for rate limiting.
  server.set('trust proxy', env.TRUST_PROXY_HOPS);
  server.disable('x-powered-by');

  const swaggerCsp = env.SWAGGER_ENABLED
    ? {
        directives: {
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
        },
      }
    : undefined;
  app.use(helmet(swaggerCsp ? { contentSecurityPolicy: swaggerCsp } : {}));
  app.use(cookieParser());
  app.use(mongoSanitizeMiddleware);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: new URL(env.CORS_ORIGIN).origin, credentials: true });

  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('ASA Portfolio API')
      .setDescription('Public content and private back-office API.')
      .setVersion('0.1.0')
      .addCookieAuth('access_token')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }
}
