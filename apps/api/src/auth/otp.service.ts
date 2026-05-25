import { randomInt } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service.js';
import { OTP_DELIVERY, type OtpDelivery } from './otp-delivery.js';

const BCRYPT_COST = 12; // R.2
const MAX_ATTEMPTS = 3; // 3 strikes invalidates (playbook §1.1.1)

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(OTP_DELIVERY) private readonly delivery: OtpDelivery,
  ) {}

  private get length(): number {
    return Number(this.config.get('OTP_LENGTH') ?? 6);
  }

  private get ttlSeconds(): number {
    return Number(this.config.get('OTP_EXPIRY_SECONDS') ?? 300);
  }

  private generateCode(): string {
    const max = 10 ** this.length;
    return randomInt(0, max).toString().padStart(this.length, '0');
  }

  /** Issue a fresh OTP for an identifier (email/phone). Returns TTL seconds. */
  async requestOtp(identifier: string): Promise<{ expiresIn: number }> {
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_COST);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    await this.prisma.otpCode.create({
      data: { identifier, codeHash, expiresAt, attemptsRemaining: MAX_ATTEMPTS },
    });

    await this.delivery.send(identifier, code);
    return { expiresIn: this.ttlSeconds };
  }

  /**
   * Verify an OTP. Consumes it on success; decrements attempts on failure and
   * invalidates after 3 strikes. Returns whether verification succeeded.
   */
  async verifyOtp(identifier: string, code: string): Promise<boolean> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { identifier, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attemptsRemaining <= 0) return false;

    const matches = await bcrypt.compare(code, otp.codeHash);
    if (matches) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      return true;
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { attemptsRemaining: { decrement: 1 } },
    });
    return false;
  }
}
