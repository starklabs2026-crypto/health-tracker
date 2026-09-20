import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type CreateDocumentRequest,
  type CreateDocumentBatchRequest,
  createDocumentBatchSchema,
  createDocumentSchema,
  type CreateDocumentBatchResponse,
  type CreateDocumentResponse,
  type DocumentDetail,
  type DocumentSummary,
  DocType,
  type MarkUploadedBatchRequest,
  markUploadedBatchSchema,
  type MarkUploadedRequest,
  markUploadedSchema,
  type Paginated,
  type PatchDocumentRequest,
  patchDocumentSchema,
} from '@medical-tracker/shared-types';

import { AuditLog } from '../common/audit-log.decorator.js';
import { CurrentUser, type AuthUser } from '../common/current-user.decorator.js';
import { ResourceAccessGuard } from '../common/resource-access.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DocumentsService } from './documents.service.js';

@Controller('documents')
@UseGuards(ResourceAccessGuard)
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Post()
  @AuditLog('create', 'document')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDocumentSchema)) body: CreateDocumentRequest,
  ): Promise<CreateDocumentResponse> {
    return this.docs.create(user.id, body);
  }

  @Post('batch')
  @AuditLog('create', 'document_batch')
  createBatch(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDocumentBatchSchema)) body: CreateDocumentBatchRequest,
  ): Promise<CreateDocumentBatchResponse> {
    return this.docs.createBatch(user.id, body.documents);
  }

  @Post(':id/mark-uploaded')
  markUploaded(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(markUploadedSchema)) body: MarkUploadedRequest,
  ): Promise<{ ok: true }> {
    return this.docs.markUploaded(user.id, id, body.fileKey);
  }

  @Post('mark-uploaded')
  markUploadedBatch(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(markUploadedBatchSchema)) body: MarkUploadedBatchRequest,
  ): Promise<{ ok: true }> {
    return this.docs.markUploadedBatch(user.id, body.documents);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('profileId') profileId?: string,
    @Query('docType') docType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<Paginated<DocumentSummary>> {
    return this.docs.list(user.id, {
      profileId,
      docType: docType as DocType | undefined,
      dateFrom,
      dateTo,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  @Get(':id/download-url')
  getDownloadUrl(@Param('id') id: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    return this.docs.getDownloadUrl(id);
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<DocumentDetail> {
    return this.docs.getById(id);
  }

  @Patch(':id')
  @AuditLog('update', 'document')
  patch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(patchDocumentSchema)) body: PatchDocumentRequest,
  ): Promise<DocumentDetail> {
    return this.docs.patch(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @AuditLog('delete', 'document')
  async softDelete(@Param('id') id: string): Promise<void> {
    await this.docs.softDelete(id);
  }
}
