import { Module } from '@nestjs/common';

import { ResourceAccessGuard } from '../common/resource-access.guard.js';
import { OcrQueueService } from '../queue/ocr-queue.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, OcrQueueService, ResourceAccessGuard],
})
export class DocumentsModule {}
