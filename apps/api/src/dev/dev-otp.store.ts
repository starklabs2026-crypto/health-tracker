import { Injectable } from '@nestjs/common';

/**
 * DEV ONLY in-memory store of the last OTP per identifier. Lets the
 * GET /dev/otp/:identifier endpoint return a plaintext code (the DB only holds
 * bcrypt hashes). Never used in production.
 */
@Injectable()
export class DevOtpStore {
  private readonly codes = new Map<string, string>();

  set(identifier: string, code: string): void {
    this.codes.set(identifier, code);
  }

  get(identifier: string): string | undefined {
    return this.codes.get(identifier);
  }
}
