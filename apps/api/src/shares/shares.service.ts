import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { findById, formatRange } from '@medical-tracker/parameter-catalog';
import {
  type CreateShareRequest,
  type CreateShareResponse,
  type DoctorShare,
  type PublicShareView,
  RangeFlag,
  ShareExpiry,
} from '@medical-tracker/shared-types';

import { PrismaService } from '../prisma/prisma.service.js';

const EXPIRY_MS: Record<ShareExpiry, number> = {
  [ShareExpiry.OneHour]: 60 * 60 * 1000,
  [ShareExpiry.OneDay]: 24 * 60 * 60 * 1000,
  [ShareExpiry.OneWeek]: 7 * 24 * 60 * 60 * 1000,
  [ShareExpiry.OneMonth]: 30 * 24 * 60 * 60 * 1000,
};

function mapShare(s: {
  id: string;
  ownerUserId: string;
  profileUserId: string;
  shareToken: string;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  parameterSet: unknown;
  includeDocuments: boolean;
  expiresAt: Date;
  singleUse: boolean;
  revokedAt: Date | null;
  customNote: string | null;
  createdAt: Date;
}): DoctorShare {
  return {
    id: s.id,
    ownerUserId: s.ownerUserId,
    profileUserId: s.profileUserId,
    shareToken: s.shareToken,
    dateRangeStart: s.dateRangeStart.toISOString(),
    dateRangeEnd: s.dateRangeEnd.toISOString(),
    parameterSet: s.parameterSet as string[],
    includeDocuments: s.includeDocuments,
    expiresAt: s.expiresAt.toISOString(),
    singleUse: s.singleUse,
    revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
    customNote: s.customNote,
    createdAt: s.createdAt.toISOString(),
  };
}

@Injectable()
export class SharesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    ownerId: string,
    body: CreateShareRequest,
    shareBaseUrl: string,
  ): Promise<CreateShareResponse> {
    const profileUserId = body.profileUserId ?? ownerId;
    const expiry = body.expiry ?? ShareExpiry.OneWeek;
    const expiresAt = new Date(Date.now() + EXPIRY_MS[expiry]);
    const shareToken = randomBytes(32).toString('hex');

    const share = await this.prisma.doctorShare.create({
      data: {
        ownerUserId: ownerId,
        profileUserId,
        shareToken,
        dateRangeStart: new Date(body.dateRangeStart),
        dateRangeEnd: new Date(body.dateRangeEnd),
        parameterSet: body.parameterSet ?? [],
        includeDocuments: body.includeDocuments ?? true,
        expiresAt,
        singleUse: body.singleUse ?? false,
        customNote: body.customNote ?? null,
      },
    });

    return {
      share: mapShare(share),
      shareUrl: `${shareBaseUrl}/share/${shareToken}`,
    };
  }

  async list(ownerId: string): Promise<DoctorShare[]> {
    const shares = await this.prisma.doctorShare.findMany({
      where: { ownerUserId: ownerId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return shares.map(mapShare);
  }

  async revoke(ownerId: string, shareId: string): Promise<void> {
    const share = await this.prisma.doctorShare.findFirst({
      where: { id: shareId },
    });
    if (!share) throw new NotFoundException('Share not found');
    if (share.ownerUserId !== ownerId) throw new ForbiddenException();

    await this.prisma.doctorShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });
  }

  async resolvePublic(token: string, userAgent: string | null): Promise<PublicShareView> {
    const share = await this.prisma.doctorShare.findFirst({
      where: { shareToken: token, revokedAt: null },
    });

    if (!share) throw new NotFoundException('Share not found or revoked');
    if (share.expiresAt < new Date()) throw new BadRequestException('Share link has expired');

    // Log the access
    await this.prisma.doctorShareAccess.create({
      data: { shareId: share.id, userAgent: userAgent ?? null },
    });

    // Single-use: revoke after access is logged
    if (share.singleUse) {
      await this.prisma.doctorShare.update({
        where: { id: share.id },
        data: { revokedAt: new Date() },
      });
    }

    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: share.profileUserId },
    });

    const ageYears = Math.floor(
      (Date.now() - user.dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );

    const paramSet = share.parameterSet as string[];

    const readings = await this.prisma.parameterReading.findMany({
      where: {
        userId: share.profileUserId,
        recordedAt: { gte: share.dateRangeStart, lte: share.dateRangeEnd },
        ...(paramSet.length > 0 ? { parameterId: { in: paramSet } } : {}),
      },
      orderBy: [{ parameterId: 'asc' }, { recordedAt: 'asc' }],
    });

    // Group readings by parameterId
    const byParam = new Map<string, typeof readings>();
    for (const r of readings) {
      const group = byParam.get(r.parameterId) ?? [];
      group.push(r);
      byParam.set(r.parameterId, group);
    }

    const parameters: PublicShareView['parameters'] = [];
    for (const [parameterId, pts] of byParam) {
      const entry = findById(parameterId);
      if (!entry) continue;
      const sex = user.sex === 'male' ? 'male' : user.sex === 'female' ? 'female' : undefined;
      const normalRange = formatRange(entry, { sex, ageYears });
      parameters.push({
        canonical: entry.canonicalName,
        unit: entry.unit,
        normalRange,
        readings: pts.map((p) => ({
          date: p.recordedAt.toISOString().split('T')[0] ?? p.recordedAt.toISOString(),
          value: Number(p.value),
          rangeFlag: p.rangeFlag as RangeFlag,
        })),
      });
    }

    const documents: PublicShareView['documents'] = [];
    if (share.includeDocuments) {
      const docs = await this.prisma.document.findMany({
        where: {
          ownerUserId: share.profileUserId,
          sourceDate: { gte: share.dateRangeStart, lte: share.dateRangeEnd },
          deletedAt: null,
        },
        orderBy: { sourceDate: 'desc' },
      });
      for (const doc of docs) {
        documents.push({
          docType: doc.docType,
          sourceDate: doc.sourceDate.toISOString().split('T')[0] ?? doc.sourceDate.toISOString(),
          downloadUrl: doc.fileUrl ?? '',
        });
      }
    }

    return {
      patient: {
        firstName: user.name.split(' ')[0] ?? user.name,
        ageBand: `${ageYears}y`,
        sex: user.sex,
        bloodGroup: user.bloodGroup,
      },
      parameters,
      documents,
      customNote: share.customNote,
    };
  }
}
