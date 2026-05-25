import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import {
  type LogoutRequest,
  logoutSchema,
  type OtpRequest,
  type OtpRequestResponse,
  type OtpVerify,
  type OtpVerifyResponse,
  otpRequestSchema,
  otpVerifySchema,
  type RefreshRequest,
  type RefreshResponse,
  refreshSchema,
} from '@medical-tracker/shared-types';

import { AuditLog } from '../common/audit-log.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthUser } from '../common/current-user.decorator.js';
import { mapUser } from '../common/mappers.js';
import { Public } from '../common/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  async requestOtp(
    @Body(new ZodValidationPipe(otpRequestSchema)) body: OtpRequest,
  ): Promise<OtpRequestResponse> {
    const { expiresIn } = await this.otp.requestOtp(body.identifier);
    return { ok: true, expiresIn };
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(
    @Body(new ZodValidationPipe(otpVerifySchema)) body: OtpVerify,
  ): Promise<OtpVerifyResponse> {
    const ok = await this.otp.verifyOtp(body.identifier, body.code);
    if (!ok) throw new UnauthorizedException('Invalid or expired code');

    const { tokens, user, isNewUser } = await this.auth.signupOrLogin(
      body.identifier,
      body.deviceId,
      body.platform,
    );
    return { ...tokens, user: mapUser(user), isNewUser };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshRequest,
  ): Promise<RefreshResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutRequest,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Post('biometric/pair')
  @HttpCode(204)
  @AuditLog('biometric_pair', 'device')
  async pairBiometric(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.pairBiometric(user.id);
  }
}
