import { Injectable, NotFoundException } from '@nestjs/common';
import { computeRangeFlag, findById, formatRange } from '@medical-tracker/parameter-catalog';
import {
  type CreateReadingRequest,
  type PatchReadingRequest,
  type Paginated,
  type ParameterReading as ParameterReadingDto,
  RangeFlag,
  ReadingStatus,
  type TrendPoint,
  type TrendResponse,
} from '@medical-tracker/shared-types';

import { mapReading } from '../common/mappers.js';
import { PrismaService } from '../prisma/prisma.service.js';

type RangeCtx = { sex?: 'male' | 'female'; ageYears?: number };

@Injectable()
export class ReadingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async rangeCtx(userId: string): Promise<RangeCtx> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { sex: true, dob: true },
    });
    if (!user) return {};
    const sex =
      user.sex === 'male' ? 'male' : user.sex === 'female' ? 'female' : undefined;
    const ageYears = Math.floor(
      (Date.now() - user.dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );
    return { sex, ageYears };
  }

  private flag(parameterId: string, value: number, ctx: RangeCtx): string {
    const entry = findById(parameterId);
    if (!entry) return RangeFlag.Unknown;
    return computeRangeFlag(value, entry, ctx);
  }

  async list(
    userId: string,
    query: {
      parameterId?: string;
      dateFrom?: string;
      dateTo?: string;
      status?: ReadingStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<Paginated<ParameterReadingDto>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(200, query.limit ?? 50);

    const where = {
      userId,
      ...(query.parameterId ? { parameterId: query.parameterId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            recordedAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.parameterReading.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.parameterReading.count({ where }),
    ]);

    return { items: rows.map(mapReading), page, limit, total };
  }

  async create(userId: string, dto: CreateReadingRequest): Promise<ParameterReadingDto> {
    if (!findById(dto.parameterId)) throw new NotFoundException('Unknown parameter');

    const ctx = await this.rangeCtx(userId);
    const rangeFlag = this.flag(dto.parameterId, dto.value, ctx);

    const reading = await this.prisma.parameterReading.create({
      data: {
        userId,
        documentId: null,
        parameterId: dto.parameterId,
        value: dto.value,
        unit: dto.unit,
        recordedAt: new Date(dto.recordedAt),
        status: ReadingStatus.Confirmed,
        isUserVerified: true,
        confidenceScore: 1.0,
        rangeFlag,
        createdByUserId: userId,
      },
    });
    return mapReading(reading);
  }

  async getById(userId: string, id: string): Promise<ParameterReadingDto> {
    const r = await this.prisma.parameterReading.findFirst({ where: { id, userId } });
    if (!r) throw new NotFoundException();
    return mapReading(r);
  }

  async patch(
    userId: string,
    id: string,
    dto: PatchReadingRequest,
  ): Promise<ParameterReadingDto> {
    const existing = await this.prisma.parameterReading.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException();

    let rangeFlag: string | undefined;
    if (dto.value !== undefined) {
      const ctx = await this.rangeCtx(userId);
      rangeFlag = this.flag(existing.parameterId, dto.value, ctx);
    }

    const updated = await this.prisma.parameterReading.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.isUserVerified !== undefined ? { isUserVerified: dto.isUserVerified } : {}),
        ...(dto.value !== undefined ? { value: dto.value, rangeFlag } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        lastEditedAt: new Date(),
      },
    });
    return mapReading(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const r = await this.prisma.parameterReading.findFirst({ where: { id, userId } });
    if (!r) throw new NotFoundException();
    await this.prisma.parameterReading.delete({ where: { id } });
  }

  async trend(
    userId: string,
    parameterId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<TrendResponse> {
    const entry = findById(parameterId);
    if (!entry) throw new NotFoundException('Unknown parameter');

    const ctx = await this.rangeCtx(userId);

    const rows = await this.prisma.parameterReading.findMany({
      where: {
        userId,
        parameterId,
        ...(dateFrom || dateTo
          ? {
              recordedAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo) } : {}),
              },
            }
          : {}),
      },
      orderBy: { recordedAt: 'asc' },
      take: 100,
    });

    const data: TrendPoint[] = rows.map((r) => ({
      readingId: r.id,
      value: Number(r.value),
      unit: r.unit,
      recordedAt: r.recordedAt.toISOString(),
      rangeFlag: r.rangeFlag as RangeFlag,
      isUserVerified: r.isUserVerified,
      confidenceScore: r.confidenceScore,
    }));

    return {
      parameterId: entry.id,
      canonicalName: entry.canonicalName,
      unit: entry.unit,
      rangeLabel: formatRange(entry, ctx),
      data,
    };
  }
}
