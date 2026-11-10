import { z } from 'zod';

/** Document categories (PRD §7.2). */
export enum DocType {
  LabReport = 'lab_report',
  Prescription = 'prescription',
  ImagingReport = 'imaging_report',
  DischargeSummary = 'discharge_summary',
  VaccinationRecord = 'vaccination_record',
  Other = 'other',
}

/**
 * OCR lifecycle for a document.
 * pending_upload -> queued -> processing -> ready_for_review | failed
 */
export enum OcrStatus {
  PendingUpload = 'pending_upload',
  Queued = 'queued',
  Processing = 'processing',
  ReadyForReview = 'ready_for_review',
  Failed = 'failed',
}

export const docTypeSchema = z.nativeEnum(DocType);
export const ocrStatusSchema = z.nativeEnum(OcrStatus);

export interface Document {
  id: string;
  ownerUserId: string;
  uploadedByUserId: string;
  fileUrl: string | null;
  fileType: string;
  docType: DocType;
  sourceDate: string; // ISO date
  labName: string | null;
  orderingPhysician: string | null;
  notes: string | null;
  ocrStatus: OcrStatus;
  ocrAttempts: number;
  ocrProgress: number;
  ocrStage: string | null;
  ocrQueuedAt: string | null;
  ocrStartedAt: string | null;
  ocrCompletedAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

// --- API boundary schemas (R.1) ---

const isoDate = z.string().datetime({ offset: true }).or(z.string().date());

export const createDocumentSchema = z.object({
  ownerProfileId: z.string().uuid().optional(),
  docType: docTypeSchema,
  sourceDate: isoDate.optional(),
  labName: z.string().max(200).optional(),
  orderingPhysician: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024),
  fileType: z.string().min(1),
});
export type CreateDocumentRequest = z.infer<typeof createDocumentSchema>;

export const createDocumentBatchSchema = z.object({
  documents: z.array(createDocumentSchema).min(1).max(20),
});
export type CreateDocumentBatchRequest = z.infer<typeof createDocumentBatchSchema>;

export const markUploadedSchema = z.object({ fileKey: z.string().min(1) });
export type MarkUploadedRequest = z.infer<typeof markUploadedSchema>;

export const markUploadedBatchSchema = z.object({
  documents: z
    .array(
      z.object({
        documentId: z.string().uuid(),
        fileKey: z.string().min(1),
      }),
    )
    .min(1)
    .max(20),
});
export type MarkUploadedBatchRequest = z.infer<typeof markUploadedBatchSchema>;

export const patchDocumentSchema = z
  .object({
    docType: docTypeSchema,
    sourceDate: isoDate,
    labName: z.string().max(200).nullable(),
    orderingPhysician: z.string().max(200).nullable(),
    notes: z.string().max(2000).nullable(),
  })
  .partial();
export type PatchDocumentRequest = z.infer<typeof patchDocumentSchema>;
