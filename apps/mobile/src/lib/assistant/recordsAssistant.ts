import { PARAMETER_SEED } from '@medical-tracker/parameter-catalog';
import {
  DocType,
  OcrStatus,
  RangeFlag,
  type DocumentDetail,
  type DocumentSummary,
  type ParameterReading,
} from '@medical-tracker/shared-types';

export type SourceRef = {
  id: string;
  title: string;
  subtitle: string;
};

export type AssistantResult = {
  answer: string;
  sources: SourceRef[];
};

type BuildAnswerInput = {
  question: string;
  documents: DocumentSummary[];
  readings: ParameterReading[];
  activeProfileName?: string | null;
  getDocument: (id: string) => Promise<DocumentDetail | null>;
};

const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DocType.LabReport]: 'Blood work',
  [DocType.Prescription]: 'Prescription',
  [DocType.ImagingReport]: 'Imaging',
  [DocType.DischargeSummary]: 'Surgery',
  [DocType.VaccinationRecord]: 'Vaccine',
  [DocType.Other]: 'Document',
};

const STOP_WORDS = new Set([
  'about',
  'again',
  'any',
  'are',
  'can',
  'could',
  'did',
  'doc',
  'docs',
  'document',
  'documents',
  'from',
  'have',
  'how',
  'latest',
  'last',
  'me',
  'mine',
  'most',
  'my',
  'need',
  'report',
  'reports',
  'sent',
  'show',
  'summarize',
  'summary',
  'tell',
  'that',
  'the',
  'this',
  'uploaded',
  'was',
  'were',
  'what',
  'when',
  'which',
  'with',
]);

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function tokens(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9.+%/-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function parameterName(id: string): string {
  return PARAMETER_SEED.find((param) => param.id === id)?.canonicalName ?? id.replace(/-/g, ' ');
}

function parameterSearchText(reading: ParameterReading): string {
  const entry = PARAMETER_SEED.find((param) => param.id === reading.parameterId);
  return [
    reading.parameterId,
    entry?.canonicalName,
    ...(entry?.aliases ?? []),
    reading.unit,
    reading.rangeFlag,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function forwardedFilename(notes?: string | null): string | null {
  const match = notes?.match(/^Forwarded email attachment:\s*(.+)$/im);
  return match?.[1]?.trim() || null;
}

function forwardedSubject(notes?: string | null): string | null {
  const match = notes?.match(/^Subject:\s*(.+)$/im);
  return match?.[1]?.trim() || null;
}

export function documentTitle(doc: DocumentSummary | DocumentDetail['document']): string {
  return (
    forwardedSubject(doc.notes) ||
    doc.labName?.trim() ||
    forwardedFilename(doc.notes) ||
    DOC_TYPE_LABELS[doc.docType as DocType] ||
    'Document'
  );
}

export function documentSubtitle(doc: DocumentSummary | DocumentDetail['document']): string {
  return `${DOC_TYPE_LABELS[doc.docType as DocType] ?? 'Document'} - ${new Date(
    doc.sourceDate,
  ).toLocaleDateString()}`;
}

function sourceRefsFromDetails(details: DocumentDetail[]): SourceRef[] {
  return details.map((detail) => ({
    id: detail.document.id,
    title: documentTitle(detail.document),
    subtitle: documentSubtitle(detail.document),
  }));
}

function sourceRefsFromDocuments(documents: DocumentSummary[]): SourceRef[] {
  return documents.map((doc) => ({
    id: doc.id,
    title: documentTitle(doc),
    subtitle: documentSubtitle(doc),
  }));
}

function documentSearchText(doc: DocumentSummary): string {
  return [
    doc.id,
    doc.labName,
    doc.notes,
    doc.docType,
    DOC_TYPE_LABELS[doc.docType as DocType],
    doc.ocrStatus,
    forwardedFilename(doc.notes),
    forwardedSubject(doc.notes),
    new Date(doc.sourceDate).toLocaleDateString(),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function docTypeFromQuestion(question: string): DocType | null {
  const q = normalize(question);
  if (/\b(rx|prescription|medicine|medication|tablet)\b/.test(q)) return DocType.Prescription;
  if (/\b(xray|x-ray|ct|mri|scan|imaging|radiology|ultrasound)\b/.test(q)) {
    return DocType.ImagingReport;
  }
  if (/\b(vaccine|vaccination|immunization)\b/.test(q)) return DocType.VaccinationRecord;
  if (/\b(surgery|discharge|operative|hospital)\b/.test(q)) return DocType.DischargeSummary;
  if (/\b(blood|lab|cbc|lipid|thyroid|hba1c|glucose|biomarker|marker)\b/.test(q)) {
    return DocType.LabReport;
  }
  return null;
}

function scoreDocument(
  doc: DocumentSummary,
  questionTokens: string[],
  preferredType: DocType | null,
): number {
  const haystack = documentSearchText(doc);
  let score = 0;
  for (const token of questionTokens) {
    if (haystack.includes(token)) score += token.length > 4 ? 3 : 2;
  }
  if (preferredType && doc.docType === preferredType) score += 8;
  if (doc.ocrStatus === OcrStatus.ReadyForReview) score += 2;
  return score;
}

async function loadRelevantDocuments({
  question,
  documents,
  getDocument,
  limit = 4,
}: {
  question: string;
  documents: DocumentSummary[];
  getDocument: (id: string) => Promise<DocumentDetail | null>;
  limit?: number;
}): Promise<DocumentDetail[]> {
  const preferredType = docTypeFromQuestion(question);
  const questionTokens = tokens(question);
  const scored = documents
    .map((doc) => ({ doc, score: scoreDocument(doc, questionTokens, preferredType) }))
    .sort((a, b) => b.score - a.score || b.doc.sourceDate.localeCompare(a.doc.sourceDate));
  const chosen = scored.filter((item) => item.score > 0).slice(0, limit);
  const fallback = chosen.length > 0 ? chosen : scored.slice(0, Math.min(limit, scored.length));
  const details = await Promise.allSettled(fallback.map((item) => getDocument(item.doc.id)));

  return details
    .filter((detail): detail is PromiseFulfilledResult<DocumentDetail | null> => {
      return detail.status === 'fulfilled' && detail.value !== null;
    })
    .map((detail) => detail.value as DocumentDetail);
}

export function latestReadingsByParameter(readings: ParameterReading[]): ParameterReading[] {
  const byParameter = new Map<string, ParameterReading>();
  for (const reading of readings) {
    const existing = byParameter.get(reading.parameterId);
    if (!existing || reading.recordedAt > existing.recordedAt) {
      byParameter.set(reading.parameterId, reading);
    }
  }
  return Array.from(byParameter.values());
}

function flagRank(flag: RangeFlag): number {
  if (flag === RangeFlag.Critical) return 0;
  if (flag === RangeFlag.High || flag === RangeFlag.Low) return 1;
  if (flag === RangeFlag.Unknown) return 3;
  return 2;
}

export function attentionReadings(readings: ParameterReading[]): ParameterReading[] {
  return latestReadingsByParameter(readings)
    .filter((reading) => {
      return reading.rangeFlag !== RangeFlag.Normal && reading.rangeFlag !== RangeFlag.Unknown;
    })
    .sort((a, b) => {
      return (
        flagRank(a.rangeFlag as RangeFlag) - flagRank(b.rangeFlag as RangeFlag) ||
        b.recordedAt.localeCompare(a.recordedAt) ||
        parameterName(a.parameterId).localeCompare(parameterName(b.parameterId))
      );
    });
}

function matchingReadings(readings: ParameterReading[], question: string): ParameterReading[] {
  const questionTokens = tokens(question);
  if (questionTokens.length === 0) return [];

  return latestReadingsByParameter(readings)
    .map((reading) => ({
      reading,
      score: questionTokens.reduce(
        (total, token) => total + (parameterSearchText(reading).includes(token) ? 1 : 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.reading.recordedAt.localeCompare(a.reading.recordedAt))
    .map((item) => item.reading);
}

export function readingLine(reading: ParameterReading): string {
  const date = new Date(reading.recordedAt).toLocaleDateString();
  const flag = reading.rangeFlag === RangeFlag.Unknown ? 'not ranged' : reading.rangeFlag;
  return `${parameterName(reading.parameterId)}: ${reading.value} ${reading.unit} (${flag}, ${date})`;
}

function compactReadingLine(reading: ParameterReading): string {
  const flag = reading.rangeFlag === RangeFlag.Unknown ? 'not ranged' : reading.rangeFlag;
  return `${parameterName(reading.parameterId)} ${reading.value} ${reading.unit} (${flag})`;
}

function medicationAdviceIntent(question: string): boolean {
  const q = normalize(question);
  return /\b(should i take|what medication should|what medicine should|which medicine|which medication|dose|dosage|stop|start|increase|decrease|prescribe)\b/.test(
    q,
  );
}

function medicationTopic(question: string): boolean {
  return /\b(rx|prescription|medicine|medication|tablet|drug|pill)\b/.test(normalize(question));
}

function concernTopic(question: string): boolean {
  return /\b(attention|abnormal|flag|low|high|concerning|concern|worry|worried|marker|markers|risk)\b/.test(
    normalize(question),
  );
}

function summaryTopic(question: string): boolean {
  return /\b(summary|summarize|overview|recap|explain|documents|records|reports)\b/.test(
    normalize(question),
  );
}

function shortSourceList(details: DocumentDetail[]): SourceRef[] {
  const seen = new Set<string>();
  const sources: SourceRef[] = [];
  for (const detail of details) {
    if (seen.has(detail.document.id)) continue;
    seen.add(detail.document.id);
    sources.push({
      id: detail.document.id,
      title: documentTitle(detail.document),
      subtitle: documentSubtitle(detail.document),
    });
  }
  return sources.slice(0, 4);
}

function documentSummaryLine(detail: DocumentDetail): string {
  const flagged = detail.readings.filter((reading) => {
    return reading.rangeFlag !== RangeFlag.Normal && reading.rangeFlag !== RangeFlag.Unknown;
  });
  const lead =
    flagged.length > 0
      ? `${flagged.length} flagged: ${flagged.slice(0, 3).map(compactReadingLine).join('; ')}`
      : `${detail.readings.length} extracted reading${detail.readings.length === 1 ? '' : 's'}`;

  return `${documentTitle(detail.document)} (${new Date(
    detail.document.sourceDate,
  ).toLocaleDateString()}): ${lead}.`;
}

export async function buildRecordsAssistantAnswer({
  question,
  documents,
  readings,
  activeProfileName,
  getDocument,
}: BuildAnswerInput): Promise<AssistantResult> {
  const q = normalize(question);
  const latest = latestReadingsByParameter(readings);
  const attention = attentionReadings(readings);

  if (!q) {
    return {
      answer: 'Ask about uploaded records, flagged markers, latest reports, or prescriptions.',
      sources: [],
    };
  }

  if (medicationAdviceIntent(question)) {
    const prescriptionDetails = await loadRelevantDocuments({
      question: 'prescription medicine medication',
      documents,
      getDocument,
      limit: 3,
    });
    const prescriptionDocs = prescriptionDetails.filter((detail) => {
      return detail.document.docType === DocType.Prescription;
    });
    const attentionLine =
      attention.length > 0
        ? `Current flagged markers to discuss: ${attention.slice(0, 3).map(compactReadingLine).join('; ')}.`
        : 'I do not see flagged markers in the extracted readings.';

    return {
      answer: [
        'I cannot choose a medicine or dosage for you.',
        prescriptionDocs.length > 0
          ? `I can see ${prescriptionDocs.length} prescription record${
              prescriptionDocs.length === 1 ? '' : 's'
            }: ${prescriptionDocs
              .slice(0, 2)
              .map((detail) => documentTitle(detail.document))
              .join(', ')}.`
          : 'I do not see a prescription record for this profile.',
        attentionLine,
        'Use this as a shortlist for your clinician, not as a medication instruction.',
      ].join(' '),
      sources: prescriptionDocs.length > 0 ? sourceRefsFromDetails(prescriptionDocs) : [],
    };
  }

  if (concernTopic(question)) {
    if (attention.length === 0) {
      return {
        answer:
          'I do not see extracted markers currently flagged as high, low, or critical. This depends on the uploaded records and OCR quality.',
        sources: [],
      };
    }

    const sourceDocs = documents.filter((doc) =>
      attention.some((reading) => reading.documentId === doc.id),
    );
    return {
      answer: [
        `Most notable flagged markers for ${
          activeProfileName ?? 'this profile'
        }: ${attention.slice(0, 6).map(compactReadingLine).join('; ')}.`,
        'Verify these against the source report and discuss persistent or unexpected flags with a clinician.',
      ].join(' '),
      sources: sourceRefsFromDocuments(sourceDocs.slice(0, 4)),
    };
  }

  if (medicationTopic(question)) {
    const prescriptionDetails = await loadRelevantDocuments({
      question,
      documents,
      getDocument,
      limit: 4,
    });
    const prescriptionDocs = prescriptionDetails.filter((detail) => {
      return detail.document.docType === DocType.Prescription;
    });

    if (prescriptionDocs.length > 0) {
      return {
        answer: [
          `I found ${prescriptionDocs.length} prescription record${
            prescriptionDocs.length === 1 ? '' : 's'
          }.`,
          ...prescriptionDocs.slice(0, 3).map((detail) => {
            const notes = detail.document.notes?.split('\n').slice(0, 2).join(' ') || null;
            return `${documentTitle(detail.document)} from ${new Date(
              detail.document.sourceDate,
            ).toLocaleDateString()}${notes ? `: ${notes}` : ''}`;
          }),
          'I can summarize what is in the record, but not decide intake or dosage.',
        ].join('\n'),
        sources: sourceRefsFromDetails(prescriptionDocs),
      };
    }

    return {
      answer:
        'I do not see a matching prescription record. You can upload a prescription or use Care plan to manually track medicines.',
      sources: [],
    };
  }

  const parameterMatches = matchingReadings(latest, question);
  if (parameterMatches.length > 0) {
    const sourceDocs = documents.filter((doc) => {
      return parameterMatches.some((reading) => reading.documentId === doc.id);
    });
    return {
      answer: parameterMatches.slice(0, 6).map(readingLine).join('\n'),
      sources: sourceRefsFromDocuments(sourceDocs.slice(0, 4)),
    };
  }

  if (q.includes('latest') || q.includes('recent') || q.includes('last')) {
    const latestDoc = documents[0];
    const latestDetail = latestDoc ? await getDocument(latestDoc.id) : null;
    const topReadings = latestDetail?.readings.slice(0, 6) ?? [];

    return {
      answer: [
        latestDoc
          ? `Latest document: ${documentTitle(latestDoc)} from ${new Date(
              latestDoc.sourceDate,
            ).toLocaleDateString()}.`
          : 'No documents found.',
        topReadings.length > 0
          ? `Extracted readings: ${topReadings.map(compactReadingLine).join('; ')}.`
          : 'No extracted readings are attached to the latest document yet.',
      ].join(' '),
      sources: latestDetail ? sourceRefsFromDetails([latestDetail]) : [],
    };
  }

  if (summaryTopic(question)) {
    const relevantDetails = await loadRelevantDocuments({
      question,
      documents,
      getDocument,
      limit: 4,
    });
    if (relevantDetails.length === 0) {
      return {
        answer: `I found ${documents.length} document${documents.length === 1 ? '' : 's'} for ${
          activeProfileName ?? 'this profile'
        }, but no OCR details yet.`,
        sources: [],
      };
    }

    const lines = relevantDetails.slice(0, 4).map(documentSummaryLine);
    return {
      answer: [
        `Here is the record summary for ${activeProfileName ?? 'this profile'}:`,
        ...lines,
      ].join('\n'),
      sources: shortSourceList(relevantDetails),
    };
  }

  if (q.includes('score') || q.includes('readiness') || q.includes('health score')) {
    return {
      answer:
        'Health score uses your age/sex-aware marker ranges where available, plus OCR trust, panel coverage, and record depth. It is a records view, not a diagnosis.',
      sources: [],
    };
  }

  const relevantDetails = await loadRelevantDocuments({
    question,
    documents,
    getDocument,
    limit: 3,
  });
  if (relevantDetails.length > 0) {
    return {
      answer: relevantDetails.map(documentSummaryLine).join('\n'),
      sources: sourceRefsFromDetails(relevantDetails),
    };
  }

  return {
    answer:
      'I can answer from uploaded HealthFolio records. Try asking about flagged markers, latest reports, prescriptions, or a specific marker like hemoglobin.',
    sources: [],
  };
}
