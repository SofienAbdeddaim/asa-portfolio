import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ENV, type Env } from '../config/env.js';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
export const CHALLENGE_TTL_SECONDS = 5 * 60;

type Purpose = 'access' | 'mfa';

@Injectable()
export class TokenService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private sign(userId: string, purpose: Purpose, expiresIn: number): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId },
      { secret: this.env.JWT_SECRET, audience: purpose, expiresIn, issuer: 'asa-portfolio' },
    );
  }

  signAccess(userId: string): Promise<string> {
    return this.sign(userId, 'access', ACCESS_TTL_SECONDS);
  }

  signChallenge(userId: string): Promise<string> {
    return this.sign(userId, 'mfa', CHALLENGE_TTL_SECONDS);
  }

  /** Returns the user id, or throws 401. The audience prevents using one token kind as another. */
  async verify(token: string, purpose: Purpose): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string }>(token, {
        secret: this.env.JWT_SECRET,
        audience: purpose,
        issuer: 'asa-portfolio',
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new Error('missing subject');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
