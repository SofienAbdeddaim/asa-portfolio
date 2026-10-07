import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ENV, type Env } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defense in depth next to SameSite=Strict cookies: state-changing requests that carry an
 * Origin header must come from the configured front-end origin.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    const origin = request.headers.origin;
    if (origin && origin !== new URL(this.env.CORS_ORIGIN).origin) {
      throw new ForbiddenException('Origin not allowed');
    }
    return true;
  }
}
