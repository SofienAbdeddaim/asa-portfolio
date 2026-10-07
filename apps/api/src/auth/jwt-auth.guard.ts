import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_COOKIE } from './cookies.js';
import { TokenService } from './token.service.js';

export type AuthedRequest = Request & { user?: { id: string } };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TokenService) private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = request.cookies?.[ACCESS_COOKIE] as unknown;
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException();
    }
    request.user = { id: await this.tokens.verify(token, 'access') };
    return true;
  }
}
