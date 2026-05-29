import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, normalize, resolve, sep } from 'node:path';

import { matchParameter } from '@medical-tracker/parameter-catalog';
import { logger } from '@medical-tracker/phi-scrubber';
import { PrismaClient } from '@prisma/client';
import Tesseract from 'tesseract.js';

import type { OcrJobData } from './queue.js';

const prisma = new PrismaClient();

const STORAGE_ROOT = resolve(process.env['STORAGE_LOCAL_PATH'] ?? './storage');
const MIN_CONFIDENCE = 0.5;

async function setOcrProgress(
  documentId: string,
  progress: number,
  stage: string,
  status?: string,
): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      ...(status ? { ocrStatus: status } : {}),
      ocrProgress: progress,
      ocrStage: stage,
    },
  });
}

function storagePath(fileKey: string): string {
  const full = normalize(join(STORAGE_ROOT, fileKey));
  if (full !== STORAGE_ROOT && !full.startsWith(STORAGE_ROOT + sep)) {
    throw new Error('Invalid storage key');
  }
  return full;
}

async function extractTextFromPdf(buf: Buffer): Promise<string> {
  // Dynamic import avoids top-level worker-thread issues with pdfjs-dist
  const pdfjs = await import('pdfjs-dist');

  // Resolve the worker via CJS require so we get the hoisted node_modules path
  const req = createRequire(import.meta.url);
  try {
    const workerPath = req.resolve('pdfjs-dist/build/pdf.worker.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = '';
  }

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    pages.push(text);
  }

  return pages.join('\n');
}

async function extractTextFromImage(buf: Buffer): Promise<string> {
  const { data } = await Tesseract.recognize(buf, 'eng', {
    logger: () => {}, // suppress progress logs
  });
  return data.text;
}

/**
 * Parse OCR/extracted text into candidate {label, value, rawUnit} rows.
 * Matches lines of the form: "Label   12.5   g/dL"  or  "Label: 12.5 g/dL"
 */
function parseCandidates(text: string): Array<{ label: string; value: number; rawUnit: string }> {
  const candidates: Array<{ label: string; value: number; rawUnit: string }> = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Require the numeric value to be clearly separated from the label (≥1 space or colon)
    const m = trimmed.match(
      /^([A-Za-z][\w\s()/\-–,.]{1,50?}?)\s*[:-]?\s{1,}(\d{1,6}(?:\.\d{1,4})?)\s*([^\s]\S*)?$/,
    );
    if (!m) continue;

    const label = (m[1] ?? '')
      .trim()
      .replace(/[:\s-]+$/, '')
      .replace(/\s+/g, ' ');
    if (label.length < 2) continue;

    const value = parseFloat(m[2] ?? '');
    if (isNaN(value)) continue;

    candidates.push({ label, value, rawUnit: (m[3] ?? '').trim() });
  }

  return candidates;
}

function parseVisibleDate(raw: string): Date | null {
  const value = raw.trim();
  const datePatterns = [
    /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/,
    /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/,
  ];

  for (let index = 0; index < datePatterns.length; index += 1) {
    const pattern = datePatterns[index]!;
    const match = value.match(pattern);
    if (!match) continue;

    const first = Number(match[1] ?? '');
    const second = Number(match[2] ?? '');
    const third = Number(match[3] ?? '');
    const isYearMonthDay = index === 0;
    const year = isYearMonthDay ? first : third < 100 ? 2000 + third : third;
    const month = second;
    const day = isYearMonthDay ? third : first;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function extractDocumentMetadata(text: string): { sourceDate?: Date; labName?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let sourceDate: Date | undefined;
  for (const line of lines.slice(0, 80)) {
    if (!/(date|collected|collection|sample|report)/i.test(line)) continue;
    const parsed = parseVisibleDate(line);
    if (parsed) {
      sourceDate = parsed;
      break;
    }
  }

  const labelledLab = lines
    .slice(0, 40)
    .map((line) =>
      line
        .match(
          /(?:lab|laboratory|hospital|diagnostic(?:s)?|provider)\s*(?:name)?\s*[:\-]\s*(.+)$/i,
        )?.[1]
        ?.trim(),
    )
    .find((value): value is string => Boolean(value && value.length >= 2));

  const headingLab =
    labelledLab ??
    lines
      .slice(0, 12)
      .find(
        (line) =>
          /(lab|laboratory|diagnostic|pathology|hospital)/i.test(line) && line.length <= 120,
      );

  return {
    ...(sourceDate ? { sourceDate } : {}),
    ...(headingLab ? { labName: headingLab } : {}),
  };
}

export async function processOcrJob(job: OcrJobData): Promise<void> {
  const { documentId, userId, fileKey } = job;

  // Mark as processing and increment attempt counter
  const doc = await prisma.document.update({
    where: { id: documentId },
    data: {
      ocrStatus: 'processing',
      ocrProgress: 15,
      ocrStage: 'reading_file',
      ocrAttempts: { increment: 1 },
      ocrStartedAt: new Date(),
      ocrCompletedAt: null,
      ocrError: null,
    },
    select: { sourceDate: true, labName: true },
  });

  let text: string;
  try {
    const filePath = storagePath(fileKey);
    const buf = await readFile(filePath);
    await setOcrProgress(documentId, 30, 'extracting_text');

    // Detect PDF by magic bytes (%PDF)
    const isPdf =
      buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;

    text = isPdf ? await extractTextFromPdf(buf) : await extractTextFromImage(buf);
    await setOcrProgress(documentId, 55, 'parsing_readings');
  } catch (err) {
    logger.error('OCR extraction failed', err instanceof Error ? err : new Error(String(err)), {
      documentId,
    });
    await prisma.document.update({
      where: { id: documentId },
      data: {
        ocrStatus: 'failed',
        ocrProgress: 100,
        ocrStage: 'failed',
        ocrError: err instanceof Error ? err.message.slice(0, 1000) : 'Unknown OCR error',
        ocrCompletedAt: new Date(),
      },
    });
    return;
  }

  const metadata = extractDocumentMetadata(text);
  const recordedAt = metadata.sourceDate ?? doc.sourceDate;
  const candidates = parseCandidates(text);
  const seen = new Set<string>(); // one reading per parameter per document

  const readingData: Array<{
    userId: string;
    documentId: string;
    parameterId: string;
    value: number;
    unit: string;
    recordedAt: Date;
    confidenceScore: number;
    createdByUserId: string;
  }> = [];

  for (const { label, value, rawUnit } of candidates) {
    const match = matchParameter(label);
    if (!match || match.score < MIN_CONFIDENCE) continue;
    if (seen.has(match.entry.id)) continue;
    seen.add(match.entry.id);

    readingData.push({
      userId,
      documentId,
      parameterId: match.entry.id,
      value,
      unit: rawUnit || match.entry.unit,
      recordedAt,
      confidenceScore: match.score,
      createdByUserId: userId,
    });
  }

  await prisma.$transaction([
    prisma.parameterReading.deleteMany({
      where: { documentId, status: 'pending', isUserVerified: false },
    }),
    ...readingData.map((r) => prisma.parameterReading.create({ data: r })),
    prisma.document.update({
      where: { id: documentId },
      data: {
        ocrStatus: 'ready_for_review',
        ocrProgress: 100,
        ocrStage: 'ready_for_review',
        ocrError: null,
        ocrCompletedAt: new Date(),
        ...(metadata.sourceDate ? { sourceDate: metadata.sourceDate } : {}),
        ...(!doc.labName && metadata.labName ? { labName: metadata.labName } : {}),
      },
    }),
  ]);

  logger.info('OCR complete', { documentId, extracted: readingData.length });
}
