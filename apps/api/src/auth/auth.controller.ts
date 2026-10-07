import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ValidBody } from '../common/validation.js';
import { ENV, type Env } from '../config/env.js';
import { ChallengeDto, EnableTotpDto, LoginDto, VerifyMfaDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from './cookies.js';
import { JwtAuthGuard, type AuthedRequest } from './jwt-auth.guard.js';

/** Credential endpoints: 5 attempts per minute per IP. */
const STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT)
  login(@ValidBody(LoginDto) dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @Throttle(STRICT)
  setup(@ValidBody(ChallengeDto) dto: ChallengeDto) {
    return this.auth.beginTotpEnrollment(dto.challenge);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @Throttle(STRICT)
  async enable(
    @ValidBody(EnableTotpDto) dto: EnableTotpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { recoveryCodes, tokens } = await this.auth.enableTotp(dto.challenge, dto.code);
    setSessionCookies(res, this.env, tokens);
    return { recoveryCodes };
  }

  @Post('2fa/verify')
  @HttpCode(200)
  @Throttle(STRICT)
  async verify(
    @ValidBody(VerifyMfaDto) dto: VerifyMfaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input: { code?: string; recoveryCode?: string } = {};
    if (dto.code !== undefined) input.code = dto.code;
    if (dto.recoveryCode !== undefined) input.recoveryCode = dto.recoveryCode;
    setSessionCookies(res, this.env, await this.auth.verifyMfa(dto.challenge, input));
    return { ok: true };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      setSessionCookies(res, this.env, await this.auth.refresh(token));
      return { ok: true };
    } catch (error) {
      if (error instanceof UnauthorizedException) clearSessionCookies(res, this.env);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    clearSessionCookies(res, this.env);
  }

  @Get('me')
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user?.id ?? '');
  }
}
