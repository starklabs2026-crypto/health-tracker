import { Module } from '@nestjs/common';

import { ConsoleOtpDelivery } from './console-otp-delivery.js';
import { DevOtpController } from './dev-otp.controller.js';
import { DevOtpStore } from './dev-otp.store.js';

/**
 * DEV substitutes (SMS-to-console + OTP retrieval endpoint). In production this
 * module is replaced by real delivery providers behind the OtpDelivery interface.
 */
@Module({
  controllers: [DevOtpController],
  providers: [DevOtpStore, ConsoleOtpDelivery],
  exports: [DevOtpStore, ConsoleOtpDelivery],
})
export class DevModule {}
