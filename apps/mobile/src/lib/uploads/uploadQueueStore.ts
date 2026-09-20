import { DocType, OcrStatus } from '@medical-tracker/shared-types';
import { create } from 'zustand';

import {
  createDocument,
  listDocumentsByIds,
  markUploaded,
  uploadToPresignedUrl,
} from '../api/endpoints';
import { queryClient } from '../query';

export type UploadQueueStatus = 'queued' | 'uploading' | 'processing' | 'analyzed' | 'failed';

export interface UploadQueueFile {
  uri: string;
  mimeType: string;
  size: number;
  name: string;
}

export interface UploadQueueItem extends UploadQueueFile {
  localId: string;
  profileId: string | null;
  profileName: string | null;
  createdAt: number;
  updatedAt: number;
  progress: number;
  status: UploadQueueStatus;
  documentId: string | null;
  error: string | null;
}

interface UploadQueueState {
  items: UploadQueueItem[];
  addFiles: (
    files: UploadQueueFile[],
    context: { profileId: string | null; profileName: string | null },
  ) => void;
  retryItem: (localId: string) => void;
  removeItem: (localId: string) => void;
  clearFinished: () => void;
}

const POLL_INTERVAL_MS = 2500;

let uploadLoopRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

function now(): number {
  return Date.now();
}

function formatToday(): string {
  const date = new Date();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function queueErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!message) return 'Upload failed';
  if (/selected file was empty/i.test(message)) return 'The file was empty';
  if (/network request failed|failed to fetch|timeout/i.test(message)) return 'Network issue';
  if (/OpenAI|OCR/i.test(message)) return 'Could not read this file';
  if (/OPENAI_API_KEY/i.test(message)) return 'Analysis is unavailable';
  return message;
}

export function inferDocTypeForFile(name: string, mimeType: string): DocType {
  const text = `${name} ${mimeType}`.toLowerCase();
  if (/\b(rx|prescription|medication|medicine|script)\b/.test(text)) return DocType.Prescription;
  if (/\b(x[-\s]?ray|ct|mri|scan|radiology|ultrasound|sonography|imaging)\b/.test(text)) {
    return DocType.ImagingReport;
  }
  if (/\b(discharge|surgery|surgical|operative|operation|procedure)\b/.test(text)) {
    return DocType.DischargeSummary;
  }
  if (/\b(vaccine|vaccination|immunization|immunisation)\b/.test(text)) {
    return DocType.VaccinationRecord;
  }
  if (/\b(blood|cbc|lipid|thyroid|hba1c|glucose|lab|pathology|biomarker)\b/.test(text)) {
    return DocType.LabReport;
  }
  return DocType.Other;
}

function statusFromOcrState(status: OcrStatus): UploadQueueStatus {
  if (status === OcrStatus.ReadyForReview) return 'analyzed';
  if (status === OcrStatus.Failed) return 'failed';
  return 'processing';
}

function progressFromOcrState(
  status: OcrStatus,
  ocrProgress: number,
  currentProgress: number,
): number {
  if (status === OcrStatus.ReadyForReview || status === OcrStatus.Failed) return 1;
  const backendProgress = Number.isFinite(ocrProgress) ? ocrProgress / 100 : 0;
  const processingProgress = 0.6 + Math.max(0, Math.min(0.98, backendProgress)) * 0.4;
  return Math.max(currentProgress, Math.min(0.99, processingProgress));
}

function updateItem(localId: string, updater: (item: UploadQueueItem) => UploadQueueItem): void {
  useUploadQueueStore.setState((state) => ({
    items: state.items.map((item) => (item.localId === localId ? updater(item) : item)),
  }));
}

function hasProcessingItems(): boolean {
  return useUploadQueueStore.getState().items.some((item) => item.status === 'processing');
}

function nextQueuedItem(): UploadQueueItem | undefined {
  return useUploadQueueStore.getState().items.find((item) => item.status === 'queued');
}

async function invalidateHealthData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['documents'] }),
    queryClient.invalidateQueries({ queryKey: ['family'] }),
    queryClient.invalidateQueries({ queryKey: ['readings'] }),
    queryClient.invalidateQueries({ queryKey: ['trend'] }),
  ]);
}

async function pollProcessingStatuses(): Promise<void> {
  const items = useUploadQueueStore
    .getState()
    .items.filter((item) => item.status === 'processing' && item.documentId);
  if (items.length === 0) return;

  let changed = false;
  const documents = await listDocumentsByIds(
    items.map((item) => item.documentId).filter((id): id is string => Boolean(id)),
  );
  const byId = new Map(documents.map((document) => [document.id, document]));

  for (const item of items) {
    const document = item.documentId ? byId.get(item.documentId) : undefined;
    if (!document) continue;

    const nextStatus = statusFromOcrState(document.ocrStatus);
    const nextProgress = progressFromOcrState(
      document.ocrStatus,
      document.ocrProgress,
      item.progress,
    );
    const nextError =
      document.ocrStatus === OcrStatus.Failed ? 'Could not analyze this file' : null;
    if (
      item.status !== nextStatus ||
      Math.abs(item.progress - nextProgress) > 0.001 ||
      item.error !== nextError
    ) {
      changed = true;
      updateItem(item.localId, (current) => ({
        ...current,
        status: nextStatus,
        progress: nextProgress,
        error: nextError,
        updatedAt: now(),
      }));
    }
  }

  if (changed) {
    await invalidateHealthData();
  }
}

function ensureProcessingPoll(): void {
  if (pollTimer || !hasProcessingItems()) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void (async () => {
      try {
        await pollProcessingStatuses();
      } finally {
        ensureProcessingPoll();
      }
    })();
  }, POLL_INTERVAL_MS);
}

async function runUploadLoop(): Promise<void> {
  if (uploadLoopRunning) return;
  uploadLoopRunning = true;

  try {
    let nextItem = nextQueuedItem();
    while (nextItem) {
      updateItem(nextItem.localId, (item) => ({
        ...item,
        status: 'uploading',
        progress: 0.14,
        error: null,
        updatedAt: now(),
      }));

      try {
        const inferredDocType = inferDocTypeForFile(nextItem.name, nextItem.mimeType);
        const { documentId, uploadUrl, fileKey } = await createDocument({
          ...(nextItem.profileId ? { ownerProfileId: nextItem.profileId } : {}),
          docType: inferredDocType,
          sourceDate: formatToday(),
          labName: inferredDocType === DocType.Other ? undefined : nextItem.name,
          notes:
            inferredDocType === DocType.Prescription
              ? `Original file: ${nextItem.name}\nPrescription OCR requires user verification before use.`
              : `Original file: ${nextItem.name}`,
          fileType: nextItem.mimeType,
          fileSize: Math.max(nextItem.size, 1),
        });

        updateItem(nextItem.localId, (item) => ({
          ...item,
          documentId,
          progress: 0.32,
          updatedAt: now(),
        }));

        await uploadToPresignedUrl(uploadUrl, {
          uri: nextItem.uri,
          mimeType: nextItem.mimeType,
        });

        updateItem(nextItem.localId, (item) => ({
          ...item,
          progress: 0.58,
          updatedAt: now(),
        }));

        await markUploaded(documentId, fileKey);

        const [document] = await listDocumentsByIds([documentId]);
        const nextStatus = document ? statusFromOcrState(document.ocrStatus) : 'processing';
        const nextProgress = document
          ? progressFromOcrState(document.ocrStatus, document.ocrProgress, 0.74)
          : 0.74;
        const nextError =
          document?.ocrStatus === OcrStatus.Failed ? 'Could not analyze this file' : null;

        updateItem(nextItem.localId, (item) => ({
          ...item,
          status: nextStatus,
          progress: nextProgress,
          error: nextError,
          updatedAt: now(),
        }));

        await invalidateHealthData();
        ensureProcessingPoll();
      } catch (error) {
        updateItem(nextItem.localId, (item) => ({
          ...item,
          status: 'failed',
          progress: Math.max(item.progress, 0.2),
          error: queueErrorMessage(error),
          updatedAt: now(),
        }));
      }

      nextItem = nextQueuedItem();
    }
  } finally {
    uploadLoopRunning = false;
    ensureProcessingPoll();
  }
}

export function ensureUploadQueueProcessing(): void {
  void runUploadLoop();
  ensureProcessingPoll();
}

export const useUploadQueueStore = create<UploadQueueState>((set) => ({
  items: [],
  addFiles: (files, context) => {
    const timestamp = now();
    const queuedItems = files.map((file, index) => ({
      ...file,
      localId: `${timestamp}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      profileId: context.profileId,
      profileName: context.profileName,
      createdAt: timestamp + index,
      updatedAt: timestamp + index,
      progress: 0.06,
      status: 'queued' as const,
      documentId: null,
      error: null,
    }));

    set((state) => ({ items: [...queuedItems, ...state.items] }));
    ensureUploadQueueProcessing();
  },
  retryItem: (localId) => {
    updateItem(localId, (item) => ({
      ...item,
      status: 'queued',
      progress: 0.06,
      error: null,
      documentId: null,
      updatedAt: now(),
    }));
    ensureUploadQueueProcessing();
  },
  removeItem: (localId) =>
    set((state) => ({
      items: state.items.filter((item) => item.localId !== localId),
    })),
  clearFinished: () =>
    set((state) => ({
      items: state.items.filter((item) => item.status !== 'analyzed'),
    })),
}));
