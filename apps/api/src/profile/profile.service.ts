import { Injectable, NotFoundException } from '@nestjs/common';
import { logger } from '@medical-tracker/phi-scrubber';
import type {
  MeResponse,
  UpdateHealthProfileRequest,
  UpdateMeRequest,
} from '@medical-tracker/shared-types';

import { mapHealthProfile, mapUser } from '../common/mappers.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

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

  async upsertHealthProfile(
    userId: string,
    dto: UpdateHealthProfileRequest,
  ): Promise<MeResponse> {
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

  /**
   * Soft-delete: mark the account for deletion (30-day grace). The hard purge
   * job is a stub for the MVP (playbook §1.1.3).
   */
  async deleteMe(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
    logger.info('Account marked for deletion (purge job stubbed)', { userId });
  }
}
