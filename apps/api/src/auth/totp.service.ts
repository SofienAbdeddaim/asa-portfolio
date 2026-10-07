import { Inject, Injectable } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { ENV, type Env } from '../config/env.js';

const PERIOD = 30;

@Injectable()
export class TotpService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  generateSecret(): string {
    return new OTPAuth.Secret({ size: 20 }).base32;
  }

  private totp(secret: string, label = 'admin'): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      issuer: this.env.TOTP_ISSUER,
      label,
      algorithm: 'SHA1',
      digits: 6,
      period: PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
  }

  async enrollmentPayload(secret: string, label: string) {
    const otpauthUrl = this.totp(secret, label).toString();
    return { otpauthUrl, qrDataUrl: await QRCode.toDataURL(otpauthUrl), secret };
  }

  /** Returns the matched time step, or null when the code is invalid. */
  verify(secret: string, code: string, now = Date.now()): number | null {
    const delta = this.totp(secret).validate({ token: code, window: 1, timestamp: now });
    if (delta === null) return null;
    return Math.floor(now / 1000 / PERIOD) + delta;
  }
}
