import { Module } from '@nestjs/common';

import { ConsoleOtpDelivery } from './console-otp-delivery.js';
import { DevOtpController } from './dev-otp.controller.js';
import { isDevOtpEnabled } from './dev-otp-policy.js';
import { DevOtpStore } from './dev-otp.store.js';

/**
 * DEV substitutes (SMS-to-console + OTP retrieval endpoint). The plaintext
 * route is not registered unless the process is explicitly development or test.
 */
@Module({
  controllers: isDevOtpEnabled() ? [DevOtpController] : [],
  providers: [DevOtpStore, ConsoleOtpDelivery],
  exports: [DevOtpStore, ConsoleOtpDelivery],
})
export class DevModule {}
