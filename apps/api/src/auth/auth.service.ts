import { randomBytes } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthTokens } from '@medical-tracker/shared-types';
import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';

import type { AuthUser } from '../common/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from './token.service.js';

const BCRYPT_COST = 12;

export interface SignupOrLoginResult {
  tokens: AuthTokens;
  user: User;
  isNewUser: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  private get refreshTtlSeconds(): number {
    return Number(this.config.get('JWT_REFRESH_TTL') ?? 2_592_000);
  }

  private isEmail(identifier: string): boolean {
    return identifier.includes('@');
  }

  /**
   * Called after a verified OTP. Find-or-create the user, register the device,
   * and issue an access + refresh token pair. New users get provisional profile
   * fields that the onboarding flow (PUT /me) immediately overwrites.
   */
  async signupOrLogin(
    identifier: string,
    deviceId: string,
    platform: string,
  ): Promise<SignupOrLoginResult> {
    const where = this.isEmail(identifier) ? { email: identifier } : { phone: identifier };
    let user = await this.prisma.user.findFirst({ where });
    const isNewUser = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          ...(this.isEmail(identifier) ? { email: identifier } : { phone: identifier }),
          name: '',
          dob: new Date(0),
          sex: 'other',
          unitsPreference: 'metric',
          residencyRegion: 'US',
        },
      });
    }

    await this.registerDevice(user.id, deviceId, platform);
    const tokens = await this.issueTokens(user, deviceId);
    return { tokens, user, isNewUser };
  }

  private async registerDevice(userId: string, deviceId: string, platform: string): Promise<void> {
    const existing = await this.prisma.device.findFirst({ where: { userId, deviceId } });
    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), revokedAt: null },
      });
    } else {
      await this.prisma.device.create({ data: { userId, deviceId, platform } });
    }
  }

  private toAuthUser(user: User): AuthUser {
    return { id: user.id, email: user.email, phone: user.phone };
  }

  /** Mint an access token + a hashed, rotatable refresh token (id.secret format). */
  private async issueTokens(user: User, deviceId: string): Promise<AuthTokens> {
    const accessToken = this.tokens.signAccessToken(this.toAuthUser(user));
    const secret = randomBytes(32).toString('base64url');
    const tokenHash = await bcrypt.hash(secret, BCRYPT_COST);
    const expiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000);

    const row = await this.prisma.refreshToken.create({
      data: { userId: user.id, deviceId, tokenHash, expiresAt },
    });
    return { accessToken, refreshToken: `${row.id}.${secret}` };
  }

  /**
   * Rotate a refresh token: validate by hash, revoke the old one, issue a new
   * pair. Never skip rotation (R.4).
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const [id, secret] = refreshToken.split('.');
    if (!id || !secret) throw new UnauthorizedException('Invalid refresh token');

    const row = await this.prisma.refreshToken.findFirst({
      where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!row || !(await bcrypt.compare(secret, row.tokenHash))) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user) throw new UnauthorizedException('Invalid refresh token');

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user, row.deviceId);
  }

  /** Revoke a refresh token (idempotent). */
  async logout(refreshToken: string): Promise<void> {
    const [id] = refreshToken.split('.');
    if (!id) return;
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Enroll device biometric (playbook POST /auth/biometric/pair). */
  async pairBiometric(userId: string): Promise<void> {
    await this.prisma.device.updateMany({
      where: { userId, revokedAt: null },
      data: { biometricEnrolled: true },
    });
  }
}
