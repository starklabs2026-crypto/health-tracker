import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type DocumentDetail,
  type DocumentSummary,
  DocType,
  OcrStatus,
  type Paginated,
  type PatchDocumentRequest,
} from '@medical-tracker/shared-types';

import { mapDocument, mapReading } from '../common/mappers.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OcrQueueService } from '../queue/ocr-queue.service.js';
import { STORAGE_ADAPTER, type StorageAdapter } from '../storage/storage.adapter.js';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: OcrQueueService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  /** Create the record (pending_upload) and return a presigned upload URL. */
  async create(
    userId: string,
    dto: CreateDocumentRequest,
  ): Promise<CreateDocumentResponse> {
    const ownerUserId = dto.ownerProfileId ?? userId;
    const doc = await this.prisma.document.create({
      data: {
        ownerUserId,
        uploadedByUserId: userId,
        fileType: dto.fileType,
        docType: dto.docType,
        sourceDate: new Date(dto.sourceDate),
        labName: dto.labName ?? null,
        orderingPhysician: dto.orderingPhysician ?? null,
        notes: dto.notes ?? null,
        ocrStatus: OcrStatus.PendingUpload,
      },
    });

    const fileKey = `${ownerUserId}/${doc.id}/source`;
    const { uploadUrl } = this.storage.getPresignedUploadUrl(fileKey, dto.fileType);
    return { documentId: doc.id, uploadUrl, fileKey };
  }

  /** Confirm upload, mark queued, enqueue the OCR job. */
  async markUploaded(_userId: string, id: string, fileKey: string): Promise<{ ok: true }> {
    const doc = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new NotFoundException();
    if (!fileKey.startsWith(`${doc.ownerUserId}/${doc.id}/`)) {
      throw new BadRequestException('fileKey does not belong to this document');
    }
    if (!(await this.storage.objectExists(fileKey))) {
      throw new BadRequestException('Uploaded file not found in storage');
    }

    await this.prisma.document.update({
      where: { id },
      data: { fileUrl: fileKey, ocrStatus: OcrStatus.Queued },
    });
    await this.queue.enqueue({ documentId: id, userId: doc.ownerUserId, fileKey });
    return { ok: true };
  }

  async list(
    userId: string,
    query: {
      profileId?: string;
      docType?: DocType;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<Paginated<DocumentSummary>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 20);
    const ownerUserId = query.profileId ?? userId;

    const where = {
      ownerUserId,
      deletedAt: null,
      ...(query.docType ? { docType: query.docType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            sourceDate: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { sourceDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);

    const items: DocumentSummary[] = rows.map((d) => ({
      id: d.id,
      docType: d.docType as DocType,
      sourceDate: d.sourceDate.toISOString(),
      labName: d.labName,
      ocrStatus: d.ocrStatus as OcrStatus,
      createdAt: d.createdAt.toISOString(),
    }));
    return { items, page, limit, total };
  }

  async getById(id: string): Promise<DocumentDetail> {
    const doc = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new NotFoundException();
    const readings = await this.prisma.parameterReading.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'asc' },
    });
    return { document: mapDocument(doc), readings: readings.map(mapReading) };
  }

  async patch(id: string, dto: PatchDocumentRequest): Promise<DocumentDetail> {
    await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.docType !== undefined ? { docType: dto.docType } : {}),
        ...(dto.sourceDate !== undefined ? { sourceDate: new Date(dto.sourceDate) } : {}),
        ...(dto.labName !== undefined ? { labName: dto.labName } : {}),
        ...(dto.orderingPhysician !== undefined
          ? { orderingPhysician: dto.orderingPhysician }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    return this.getById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async getDownloadUrl(id: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    const doc = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new NotFoundException();
    if (!doc.fileUrl) throw new BadRequestException('Document has no uploaded file yet');
    const { downloadUrl, expiresAt } = this.storage.getPresignedDownloadUrl(doc.fileUrl);
    return { downloadUrl, expiresAt };
  }
}
