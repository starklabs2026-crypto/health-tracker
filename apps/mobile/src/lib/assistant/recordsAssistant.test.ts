import { describe, expect, it } from 'vitest';
import {
  DocType,
  OcrStatus,
  RangeFlag,
  ReadingStatus,
  type DocumentDetail,
  type DocumentSummary,
  type ParameterReading,
} from '@medical-tracker/shared-types';

import { buildRecordsAssistantAnswer } from './recordsAssistant';

function document(id: string, sourceDate = '2026-07-01'): DocumentSummary {
  return {
    id,
    docType: DocType.LabReport,
    sourceDate,
    labName: 'City Lab',
    notes: null,
    ocrStatus: OcrStatus.ReadyForReview,
    ocrProgress: 100,
    ocrStage: null,
    createdAt: `${sourceDate}T10:00:00.000Z`,
  };
}

function reading(
  id: string,
  parameterId: string,
  value: number,
  unit: string,
  documentId: string,
): ParameterReading {
  return {
    id,
    userId: 'user-1',
    documentId,
    parameterId,
    value,
    unit,
    recordedAt: '2026-07-01T10:00:00.000Z',
    status: ReadingStatus.Confirmed,
    isUserVerified: true,
    confidenceScore: 0.98,
    rangeFlag: RangeFlag.Normal,
    sourceRegion: null,
    createdByUserId: 'user-1',
    lastEditedAt: null,
  };
}

describe('buildRecordsAssistantAnswer', () => {
  it('answers a specific marker question without leaking unrelated latest readings', async () => {
    const documents = [document('doc-1')];
    const readings = [
      reading('reading-hemoglobin', 'hemoglobin', 13.8, 'g/dL', 'doc-1'),
      reading('reading-glucose', 'fasting-blood-glucose', 91, 'mg/dL', 'doc-1'),
    ];

    const result = await buildRecordsAssistantAnswer({
      question: 'What is my latest hemoglobin?',
      documents,
      readings,
      activeProfileName: 'Aditi',
      getDocument: async (id): Promise<DocumentDetail | null> => ({
        document: {
          ...documents[0],
          notes: documents[0]!.notes ?? null,
          ownerUserId: 'user-1',
          uploadedByUserId: 'user-1',
          fileUrl: null,
          fileType: 'application/pdf',
          orderingPhysician: null,
          ocrAttempts: 1,
          ocrQueuedAt: null,
          ocrStartedAt: null,
          ocrCompletedAt: null,
          deletedAt: null,
        },
        readings: readings.filter((item) => item.documentId === id),
      }),
    });

    expect(result.answer).toContain('Hemoglobin: 13.8 g/dL');
    expect(result.answer).not.toContain('Fasting Blood Glucose');
  });
});
