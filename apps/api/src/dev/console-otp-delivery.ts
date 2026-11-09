import { Injectable } from '@nestjs/common';

import type { OtpDelivery } from '../auth/otp-delivery.js';
import { isDevOtpEnabled } from './dev-otp-policy.js';
import { DevOtpStore } from './dev-otp.store.js';

/**
 * DEV ONLY OTP delivery. Prints the code to the console as the SMS/email
 * substitute and records it in DevOtpStore so /dev/otp/:identifier can return
 * it. This file lives under src/dev/ so the PHI-scan exempts its intentional
 * console use — it must never be wired up in production.
 */
@Injectable()
export class ConsoleOtpDelivery implements OtpDelivery {
  constructor(private readonly store: DevOtpStore) {}

  async send(identifier: string, code: string): Promise<void> {
    if (!isDevOtpEnabled()) {
      throw new Error('OTP delivery is not configured');
    }
    this.store.set(identifier, code);
    // eslint-disable-next-line no-console
    console.log(`[DEV ONLY] OTP for ${identifier}: ${code}`);
    return Promise.resolve();
  }
}
