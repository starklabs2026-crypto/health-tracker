import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { ConsoleOtpDelivery } from '../dev/console-otp-delivery.js';
import { DevModule } from '../dev/dev.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OTP_DELIVERY } from './otp-delivery.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    DevModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-insecure-secret',
        signOptions: { expiresIn: Number(config.get('JWT_ACCESS_TTL') ?? 3600) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    OtpService,
    AuthService,
    TokenService,
    // Prototype OTP delivery = console (swap for Twilio/SES in prod).
    { provide: OTP_DELIVERY, useExisting: ConsoleOtpDelivery },
  ],
  exports: [TokenService],
})
export class AuthModule {}
