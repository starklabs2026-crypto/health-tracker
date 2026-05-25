import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { Public } from '../common/public.decorator.js';
import { DevOtpStore } from './dev-otp.store.js';

/**
 * DEV ONLY. Returns the most recent OTP for an identifier in plaintext so a
 * developer can complete the signup flow without real SMS. Returns 404 in
 * production (playbook §1.1.2).
 */
@Controller('dev/otp')
export class DevOtpController {
  constructor(private readonly store: DevOtpStore) {}

  @Public()
  @Get(':identifier')
  getOtp(@Param('identifier') identifier: string): { identifier: string; code: string } {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    const code = this.store.get(identifier);
    if (!code) throw new NotFoundException('No OTP issued for this identifier');
    return { identifier, code };
  }
}
