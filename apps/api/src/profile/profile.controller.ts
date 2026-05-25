import { Body, Controller, Delete, Get, HttpCode, Put } from '@nestjs/common';
import {
  type MeResponse,
  type UpdateHealthProfileRequest,
  type UpdateMeRequest,
  updateHealthProfileSchema,
  updateMeSchema,
} from '@medical-tracker/shared-types';

import { AuditLog } from '../common/audit-log.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthUser } from '../common/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ProfileService } from './profile.service.js';

@Controller('me')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.profile.getMe(user.id);
  }

  @Put()
  @AuditLog('update', 'user')
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeRequest,
  ): Promise<MeResponse> {
    return this.profile.updateMe(user.id, body);
  }

  @Put('health-profile')
  @AuditLog('update', 'health_profile')
  updateHealthProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateHealthProfileSchema)) body: UpdateHealthProfileRequest,
  ): Promise<MeResponse> {
    return this.profile.upsertHealthProfile(user.id, body);
  }

  @Delete()
  @HttpCode(204)
  @AuditLog('delete', 'user')
  async deleteMe(@CurrentUser() user: AuthUser): Promise<void> {
    await this.profile.deleteMe(user.id);
  }
}
