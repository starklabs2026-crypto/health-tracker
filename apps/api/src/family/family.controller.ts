import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type AcceptInviteRequest,
  acceptInviteSchema,
  type CreateInviteRequest,
  createInviteSchema,
  type CreateInviteResponse,
  type FamilyLink,
  type FamilyMembershipView,
  type FamilyMemberView,
  type PatchFamilyLinkRequest,
  patchFamilyLinkSchema,
} from '@medical-tracker/shared-types';

import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { FamilyService } from './family.service.js';

@Controller('family')
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  /** POST /family/invite — owner invites a member */
  @Post('invite')
  invite(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createInviteSchema)) body: CreateInviteRequest,
  ): Promise<CreateInviteResponse> {
    return this.family.invite(user.id, body);
  }

  /** POST /family/accept — member accepts a pending invite */
  @Post('accept')
  @HttpCode(200)
  accept(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: AcceptInviteRequest,
  ): Promise<FamilyLink> {
    return this.family.accept(user.id, body);
  }

  /** GET /family/members — list everyone the caller has shared with */
  @Get('members')
  listMembers(@CurrentUser() user: AuthUser): Promise<FamilyMemberView[]> {
    return this.family.listMembers(user.id);
  }

  /** GET /family/memberships — list accounts the caller is a member of */
  @Get('memberships')
  listMemberships(@CurrentUser() user: AuthUser): Promise<FamilyMembershipView[]> {
    return this.family.listMemberships(user.id);
  }

  /** PATCH /family/:id — owner updates role/permissions */
  @Patch(':id')
  patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(patchFamilyLinkSchema)) body: PatchFamilyLinkRequest,
  ): Promise<FamilyLink> {
    return this.family.patch(user.id, id, body);
  }

  /** DELETE /family/:id — owner revokes a link */
  @Delete(':id')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.family.revoke(user.id, id);
  }
}
