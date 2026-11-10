import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { logger } from '@medical-tracker/phi-scrubber';
import type {
  MeResponse,
  UpdateHealthProfileRequest,
  UpdateMeRequest,
} from '@medical-tracker/shared-types';

import { mapHealthProfile, mapUser } from '../common/mappers.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_ADAPTER, type StorageAdapter } from '../storage/storage.adapter.js';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    const healthProfile = await this.prisma.healthProfile.findUnique({ where: { userId } });
    return {
      user: mapUser(user),
      healthProfile: healthProfile ? mapHealthProfile(healthProfile) : null,
    };
  }

  async updateMe(userId: string, dto: UpdateMeRequest): Promise<MeResponse> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.dob !== undefined ? { dob: new Date(dto.dob) } : {}),
        ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
        ...(dto.unitsPreference !== undefined ? { unitsPreference: dto.unitsPreference } : {}),
        ...(dto.bloodGroup !== undefined ? { bloodGroup: dto.bloodGroup } : {}),
      },
    });
    return this.getMe(userId);
  }

  async upsertHealthProfile(userId: string, dto: UpdateHealthProfileRequest): Promise<MeResponse> {
    await this.prisma.healthProfile.upsert({
      where: { userId },
      create: {
        userId,
        height: dto.height ?? null,
        weight: dto.weight ?? null,
        knownConditions: dto.knownConditions ?? [],
        allergies: dto.allergies ?? [],
        currentMedications: dto.currentMedications ?? [],
      },
      update: {
        ...(dto.height !== undefined ? { height: dto.height } : {}),
        ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        ...(dto.knownConditions !== undefined ? { knownConditions: dto.knownConditions } : {}),
        ...(dto.allergies !== undefined ? { allergies: dto.allergies } : {}),
        ...(dto.currentMedications !== undefined
          ? { currentMedications: dto.currentMedications }
          : {}),
      },
    });
    return this.getMe(userId);
  }

  async deleteMe(userId: string): Promise<void> {
    const managedProfiles = await this.prisma.familyLink.findMany({
      where: {
        ownerUserId: userId,
        member: {
          authUserId: null,
          email: null,
          phone: null,
        },
      },
      select: { memberUserId: true },
    });
    const userIds = [
      ...new Set([userId, ...managedProfiles.map((profile) => profile.memberUserId)]),
    ];

    const [documents, exports, user] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          OR: [{ ownerUserId: { in: userIds } }, { uploadedByUserId: { in: userIds } }],
          fileUrl: { not: null },
        },
        select: { fileUrl: true },
      }),
      this.prisma.export.findMany({
        where: { userId: { in: userIds }, fileUrl: { not: null } },
        select: { fileUrl: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, phone: true },
      }),
    ]);

    const fileKeys = [...documents, ...exports]
      .map((row) => row.fileUrl)
      .filter((fileUrl): fileUrl is string => {
        if (!fileUrl) return false;
        return !/^https?:\/\//i.test(fileUrl);
      })
      .map((fileUrl) => fileUrl.replace(/^storage:\/\/[^/]+\//, ''));

    await Promise.all(fileKeys.map((fileKey) => this.storage.deleteObject(fileKey)));

    await this.prisma.$transaction([
      this.prisma.auditLog.deleteMany({
        where: { OR: [{ actorUserId: { in: userIds } }, { targetUserId: { in: userIds } }] },
      }),
      ...(user?.email || user?.phone
        ? [
            this.prisma.otpCode.deleteMany({
              where: {
                identifier: {
                  in: [user.email, user.phone].filter((value): value is string => Boolean(value)),
                },
              },
            }),
          ]
        : []),
      this.prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ]);

    logger.info('Account and associated user data deleted', { userId });
  }
}
