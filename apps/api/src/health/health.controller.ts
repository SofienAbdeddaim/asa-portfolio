import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import type { Connection } from 'mongoose';
import { ENV, type Env } from '../config/env.js';

const CONNECTED = 1;

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  check() {
    const database = this.connection.readyState === CONNECTED ? 'up' : 'down';
    const body = {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
      commit: this.env.GIT_COMMIT ?? null,
    };
    if (database === 'down') throw new ServiceUnavailableException(body);
    return body;
  }
}
