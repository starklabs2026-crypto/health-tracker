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
  createdAt: string;
  deletedAt: string | null;
}
