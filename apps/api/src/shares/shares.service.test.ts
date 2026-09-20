import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ShareExpiry } from '@medical-tracker/shared-types';

import type { PrismaService } from '../prisma/prisma.service.js';
import { SharesService } from './shares.service.js';

function makeService() {
  const prisma = {
    familyLink: {
      findFirst: vi.fn(async () => null),
    },
    doctorShare: {
      create: vi.fn(),
    },
  } as unknown as PrismaService;

  return {
    service: new SharesService(prisma),
    prisma,
  };
}

describe('SharesService', () => {
  it('rejects share creation for a profile the owner cannot actively manage', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.create(
        'owner-user-id',
        {
          profileUserId: 'unmanaged-user-id',
          dateRangeStart: '2026-07-01',
          dateRangeEnd: '2026-07-08',
          parameterSet: [],
          includeDocuments: true,
          singleUse: false,
          expiry: ShareExpiry.OneWeek,
        },
        'https://healthfolio.app',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.doctorShare.create).not.toHaveBeenCalled();
  });
});
