import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { SESSION_MODEL, SessionSchema } from './session.schema.js';
import { TokenService } from './token.service.js';
import { TotpService } from './totp.service.js';
import { USER_MODEL, UserSchema } from './user.schema.js';

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: USER_MODEL, schema: UserSchema },
      { name: SESSION_MODEL, schema: SessionSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, TotpService, JwtAuthGuard],
  exports: [AuthService, TokenService, JwtAuthGuard],
})
export class AuthModule {}
