/** Shared queue definitions. The OCR pipeline runs on a single queue (playbook §0.1.7.3). */
export const OCR_QUEUE = 'ocr-processing';

/** Payload enqueued by the API when a document upload completes (Phase 2). */
export interface OcrJobData {
  documentId: string;
  userId: string;
  fileKey: string;
}
