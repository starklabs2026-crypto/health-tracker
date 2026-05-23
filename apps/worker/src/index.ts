import { logger } from '@medical-tracker/phi-scrubber';
import { type Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { OCR_QUEUE, type OcrJobData } from './queue.js';

/**
 * OCR worker entry point (Phase 0 skeleton). Connects to Redis and registers a
 * BullMQ Worker on the 'ocr-processing' queue. The handler is a stub for now;
 * the real OCR + normalization pipeline is filled in during Phase 2. The
 * generated Prisma client is shared with the API via @prisma/client.
 */
const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  OCR_QUEUE,
  async (job: Job<OcrJobData>) => {
    // Phase 2 will fetch the file, OCR it, normalize, and persist readings.
    logger.info('received job', { jobId: job.id, queue: OCR_QUEUE });
    return { ok: true };
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
