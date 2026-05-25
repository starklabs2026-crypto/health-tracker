import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const OCR_QUEUE = 'ocr-processing';

export interface OcrJobData {
  documentId: string;
  userId: string;
  fileKey: string;
}

/** Produces 'ocr-processing' jobs consumed by the worker (playbook §2.1.2). */
@Injectable()
export class OcrQueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly queue: Queue<OcrJobData>;

  constructor(config: ConfigService) {
    this.connection = new IORedis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue<OcrJobData>(OCR_QUEUE, { connection: this.connection });
  }

  async enqueue(data: OcrJobData): Promise<void> {
    await this.queue.add('process', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
