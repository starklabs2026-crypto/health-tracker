import { logger } from '@medical-tracker/phi-scrubber';
import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { processOcrJob } from './ocr-processor.js';
import { OCR_QUEUE, type OcrJobData } from './queue.js';

const connection = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  OCR_QUEUE,
  async (job: Job<OcrJobData>) => {
    logger.info('processing OCR job', { jobId: job.id, documentId: job.data.documentId });
    await processOcrJob(job.data);
  },
  { connection },
);

worker.on('ready', () => logger.info('OCR worker ready', { queue: OCR_QUEUE }));
worker.on('failed', (job, err) => logger.error('job failed', err, { jobId: job?.id }));
worker.on('error', (err) => logger.error('worker error', err));

async function shutdown(): Promise<void> {
  await worker.close();
  await connection.quit();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
