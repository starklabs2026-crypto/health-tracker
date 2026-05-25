import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { TokenService } from './token.service.js';

const USER = { id: 'user-1', email: 'alice@test.local', phone: null };

function makeService(opts: { tokenHash: string; expired?: boolean; revoked?: boolean }) {
  const row = {
    id: 'rt-1',
    userId: USER.id,
    deviceId: 'device-1',
    tokenHash: opts.tokenHash,
    expiresAt: opts.expired ? new Date(Date.now() - 1000) : new Date(Date.now() + 1_000_000),
    revokedAt: opts.revoked ? new Date() : null,
  };

  const update = vi.fn(async () => row);
  const create = vi.fn(async () => ({ id: 'rt-2' }));
  const updateMany = vi.fn(async () => ({ count: 1 }));

  const prisma = {
    refreshToken: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== row.id) return null;
        if (row.revokedAt || row.expiresAt < new Date()) return null;
        return row;
      }),
      update,
      create,
      updateMany,
    },
    user: { findUnique: vi.fn(async () => USER) },
  } as unknown as PrismaService;

  const tokens = { signAccessToken: vi.fn(() => 'access-token') } as unknown as TokenService;
  const config = { get: () => 2_592_000 } as unknown as ConfigService;

  return { service: new AuthService(prisma, tokens, config), update, create, updateMany, row };
}

describe('AuthService refresh-token rotation', () => {
  it('rotates: revokes the old token and issues a new pair', async () => {
    const secret = 'super-secret-value';
    const tokenHash = await bcrypt.hash(secret, 12);
    const { service, update, create } = makeService({ tokenHash });

    const result = await service.refresh(`rt-1.${secret}`);

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken.startsWith('rt-2.')).toBe(true);
    expect(update).toHaveBeenCalledTimes(1); // old revoked
    expect(create).toHaveBeenCalledTimes(1); // new issued
  });

  it('rejects a tampered secret', async () => {
    const tokenHash = await bcrypt.hash('the-real-secret', 12);
    const { service } = makeService({ tokenHash });
    await expect(service.refresh('rt-1.wrong-secret')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a malformed token', async () => {
    const { service } = makeService({ tokenHash: 'x' });
    await expect(service.refresh('no-dot')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const secret = 's';
    const tokenHash = await bcrypt.hash(secret, 12);
    const { service } = makeService({ tokenHash, expired: true });
    await expect(service.refresh(`rt-1.${secret}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout revokes the refresh token', async () => {
    const { service, updateMany } = makeService({ tokenHash: 'x' });
    await service.logout('rt-1.whatever');
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
