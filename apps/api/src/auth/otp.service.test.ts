import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import type { OtpDelivery } from './otp-delivery.js';
import { OtpService } from './otp.service.js';

interface FakeOtpRow {
  id: string;
  identifier: string;
  codeHash: string;
  expiresAt: Date;
  attemptsRemaining: number;
  consumedAt: Date | null;
  createdAt: Date;
}

function makeService(rows: FakeOtpRow[] = []) {
  const created: FakeOtpRow[] = [];
  const prisma = {
    otpCode: {
      create: vi.fn(async ({ data }: { data: Partial<FakeOtpRow> }) => {
        const row: FakeOtpRow = {
          id: `otp-${created.length + 1}`,
          identifier: data.identifier!,
          codeHash: data.codeHash!,
          expiresAt: data.expiresAt!,
          attemptsRemaining: data.attemptsRemaining ?? 3,
          consumedAt: null,
          createdAt: new Date(),
        };
        created.push(row);
        rows.push(row);
        return row;
      }),
      findFirst: vi.fn(async () => {
        const valid = rows
          .filter((r) => r.consumedAt === null && r.expiresAt > new Date())
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return valid[0] ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r.id === where.id);
        if (row && 'consumedAt' in data) row.consumedAt = data.consumedAt as Date;
        if (row && 'attemptsRemaining' in data) row.attemptsRemaining -= 1;
        return row;
      }),
    },
  } as unknown as PrismaService;

  const config = {
    get: (key: string) => (key === 'OTP_LENGTH' ? 6 : key === 'OTP_EXPIRY_SECONDS' ? 300 : undefined),
  } as unknown as ConfigService;

  const sent: Array<{ identifier: string; code: string }> = [];
  const delivery: OtpDelivery = {
    send: vi.fn(async (identifier: string, code: string) => {
      sent.push({ identifier, code });
    }),
  };

  return { service: new OtpService(prisma, config, delivery), rows, sent, prisma };
}

describe('OtpService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('issues a 6-digit code, stores a bcrypt hash, and delivers it', async () => {
    const { service, sent, rows } = makeService();
    const res = await service.requestOtp('alice@test.local');

    expect(res.expiresIn).toBe(300);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.code).toMatch(/^\d{6}$/);
    // Stored value is a hash, not the plaintext code.
    expect(rows[0]!.codeHash).not.toBe(sent[0]!.code);
    expect(await bcrypt.compare(sent[0]!.code, rows[0]!.codeHash)).toBe(true);
  });

  it('verifies a correct code and consumes it', async () => {
    const { service, sent, rows } = makeService();
    await service.requestOtp('alice@test.local');
    const ok = await service.verifyOtp('alice@test.local', sent[0]!.code);
    expect(ok).toBe(true);
    expect(rows[0]!.consumedAt).not.toBeNull();
  });

  it('rejects a wrong code and decrements attempts', async () => {
    const { service, rows } = makeService();
    await service.requestOtp('alice@test.local');
    const ok = await service.verifyOtp('alice@test.local', '000000');
    expect(ok).toBe(false);
    expect(rows[0]!.attemptsRemaining).toBe(2);
  });

  it('invalidates after 3 failed attempts', async () => {
    const { service, sent, rows } = makeService();
    await service.requestOtp('alice@test.local');
    await service.verifyOtp('alice@test.local', '000001');
    await service.verifyOtp('alice@test.local', '000002');
    await service.verifyOtp('alice@test.local', '000003');
    expect(rows[0]!.attemptsRemaining).toBe(0);
    // Even the correct code now fails (0 attempts remaining).
    expect(await service.verifyOtp('alice@test.local', sent[0]!.code)).toBe(false);
  });

  it('returns false when no OTP exists', async () => {
    const { service } = makeService();
    expect(await service.verifyOtp('nobody@test.local', '123456')).toBe(false);
  });

  it('ignores expired codes', async () => {
    const { service, rows } = makeService();
    await service.requestOtp('alice@test.local');
    rows[0]!.expiresAt = new Date(Date.now() - 1000); // expire it
    expect(await service.verifyOtp('alice@test.local', '123456')).toBe(false);
  });
});
