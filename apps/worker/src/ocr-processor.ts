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
function parseCandidates(
  text: string,
): Array<{ label: string; value: number; rawUnit: string }> {
  const candidates: Array<{ label: string; value: number; rawUnit: string }> = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Require the numeric value to be clearly separated from the label (≥1 space or colon)
    const m = trimmed.match(
      /^([A-Za-z][\w\s()/\-–,.]{1,50?}?)\s*[:-]?\s{1,}(\d{1,6}(?:\.\d{1,4})?)\s*([^\s]\S*)?$/,
    );
    if (!m) continue;

    const label = (m[1] ?? '').trim().replace(/[:\s-]+$/, '').replace(/\s+/g, ' ');
    if (label.length < 2) continue;

    const value = parseFloat(m[2] ?? '');
    if (isNaN(value)) continue;

    candidates.push({ label, value, rawUnit: (m[3] ?? '').trim() });
  }

  return candidates;
}

export async function processOcrJob(job: OcrJobData): Promise<void> {
  const { documentId, userId, fileKey } = job;

  // Mark as processing and increment attempt counter
  const doc = await prisma.document.update({
    where: { id: documentId },
    data: { ocrStatus: 'processing', ocrAttempts: { increment: 1 } },
    select: { sourceDate: true },
  });

  let text: string;
  try {
    const filePath = storagePath(fileKey);
    const buf = await readFile(filePath);

    // Detect PDF by magic bytes (%PDF)
    const isPdf =
      buf.length >= 4 &&
      buf[0] === 0x25 &&
      buf[1] === 0x50 &&
      buf[2] === 0x44 &&
      buf[3] === 0x46;

    text = isPdf ? await extractTextFromPdf(buf) : await extractTextFromImage(buf);
  } catch (err) {
    logger.error('OCR extraction failed', err instanceof Error ? err : new Error(String(err)), {
      documentId,
    });
    await prisma.document.update({ where: { id: documentId }, data: { ocrStatus: 'failed' } });
    return;
  }

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
      recordedAt: doc.sourceDate,
      confidenceScore: match.score,
      createdByUserId: userId,
    });
  }

  await prisma.$transaction([
    ...readingData.map((r) => prisma.parameterReading.create({ data: r })),
    prisma.document.update({
      where: { id: documentId },
      data: { ocrStatus: 'ready_for_review' },
    }),
  ]);

  logger.info('OCR complete', { documentId, extracted: readingData.length });
}
