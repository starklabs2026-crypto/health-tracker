import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AcceptInviteRequest,
  type CreateInviteRequest,
  type CreateInviteResponse,
  DocType,
  type FamilyLink as FamilyLinkDto,
  FamilyLinkStatus,
  type FamilyMembershipView,
  type FamilyMemberView,
  FamilyRole,
  type PatchFamilyLinkRequest,
} from '@medical-tracker/shared-types';
import { randomBytes } from 'crypto';

import { mapFamilyLink } from '../common/mappers.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FamilyService {
  constructor(private readonly prisma: PrismaService) {}

  async invite(ownerId: string, body: CreateInviteRequest): Promise<CreateInviteResponse> {
    // Resolve the member by email or phone
    const member = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: body.memberIdentifier },
          { phone: body.memberIdentifier },
        ],
        deletedAt: null,
      },
    });
    if (!member) throw new NotFoundException('User not found');
    if (member.id === ownerId) throw new BadRequestException('Cannot invite yourself');

    // Prevent duplicate active or pending links
    const existing = await this.prisma.familyLink.findFirst({
      where: {
        ownerUserId: ownerId,
        memberUserId: member.id,
        status: { in: [FamilyLinkStatus.Active, FamilyLinkStatus.Pending] },
      },
    });
    if (existing) throw new BadRequestException('Link already exists');

    const inviteToken = randomBytes(32).toString('hex');
    const link = await this.prisma.familyLink.create({
      data: {
        ownerUserId: ownerId,
        memberUserId: member.id,
        role: body.role ?? FamilyRole.Viewer,
        permissions: body.permissions ?? { docTypes: Object.values(DocType) },
        status: FamilyLinkStatus.Pending,
        inviteToken,
      },
    });

    return { link: mapFamilyLink(link), inviteToken };
  }

  async accept(memberId: string, body: AcceptInviteRequest): Promise<FamilyLinkDto> {
    const link = await this.prisma.familyLink.findFirst({
      where: { inviteToken: body.inviteToken, memberUserId: memberId },
    });
    if (!link) throw new NotFoundException('Invite not found');
    if (link.status !== FamilyLinkStatus.Pending) {
      throw new BadRequestException('Invite is no longer pending');
    }

    const updated = await this.prisma.familyLink.update({
      where: { id: link.id },
      data: {
        status: FamilyLinkStatus.Active,
        acceptedAt: new Date(),
        inviteToken: null,
      },
    });
    return mapFamilyLink(updated);
  }

  async listMembers(ownerId: string): Promise<FamilyMemberView[]> {
    const links = await this.prisma.familyLink.findMany({
      where: { ownerUserId: ownerId, status: { not: FamilyLinkStatus.Revoked } },
      include: { member: true },
      orderBy: { invitedAt: 'desc' },
    });

    return links.map((l) => ({
      link: mapFamilyLink(l),
      memberName: l.member.name,
      memberEmail: l.member.email,
      memberPhone: l.member.phone,
    }));
  }

  async listMemberships(memberId: string): Promise<FamilyMembershipView[]> {
    const links = await this.prisma.familyLink.findMany({
      where: { memberUserId: memberId, status: FamilyLinkStatus.Active },
      include: { owner: true },
      orderBy: { acceptedAt: 'desc' },
    });

    return links.map((l) => ({
      link: mapFamilyLink(l),
      ownerName: l.owner.name,
      ownerEmail: l.owner.email,
    }));
  }

  async patch(ownerId: string, linkId: string, body: PatchFamilyLinkRequest): Promise<FamilyLinkDto> {
    const link = await this.prisma.familyLink.findFirst({
      where: { id: linkId, ownerUserId: ownerId },
    });
    if (!link) throw new NotFoundException('Family link not found');

    const updated = await this.prisma.familyLink.update({
      where: { id: linkId },
      data: {
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
      },
    });
    return mapFamilyLink(updated);
  }

  async revoke(ownerId: string, linkId: string): Promise<void> {
    const link = await this.prisma.familyLink.findFirst({
      where: { id: linkId, ownerUserId: ownerId },
    });
    if (!link) throw new NotFoundException('Family link not found');

    await this.prisma.familyLink.update({
      where: { id: linkId },
      data: { status: FamilyLinkStatus.Revoked, revokedAt: new Date() },
    });
  }
}
