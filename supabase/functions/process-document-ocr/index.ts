import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import { corsHeaders, errorResponse, HttpError, jsonResponse } from '../_shared/http.ts';

type SupabaseClient = ReturnType<typeof createClient>;

type AppUser = {
  id: string;
  authUserId: string | null;
  email: string | null;
  sex: string | null;
  dob: string | null;
};

type DocumentRow = {
  id: string;
  ownerUserId: string;
  uploadedByUserId: string;
  fileUrl: string | null;
  fileType: string;
  sourceDate: string;
  createdAt: string;
  labName: string | null;
};

type CatalogRow = {
  id: string;
  canonicalName: string;
  aliases: string[] | null;
  unit: string;
  panel: string;
  rangeDefault: RangeDefinition;
  criticalLow: number | null;
  criticalHigh: number | null;
};

type NumericRange = { min: number | null; max: number | null };
type RangeDefinition = {
  default: NumericRange | null;
  bySex?: Partial<Record<'male' | 'female', NumericRange>>;
  byAge?: Array<{ minAge: number; maxAge: number; range: NumericRange }>;
  qualitativeNormal?: string;
};

type OcrReading = {
  parameter_id: string;
  observed_label: string;
  value: number;
  unit: string;
  recorded_at: string | null;
  confidence: number;
  page: number | null;
};

type OcrResult = {
  document_date: string | null;
  lab_name: string | null;
  readings: OcrReading[];
  warnings: string[];
};

type OcrJobResult = {
  documentId: string;
  status: string;
  extracted: number;
  warnings: string[];
  error?: string;
};

const DOCUMENT_BUCKET = Deno.env.get('DOCUMENT_BUCKET') ?? 'medical-documents';
const OPENAI_MODEL = Deno.env.get('OPENAI_OCR_MODEL') ?? 'gpt-4.1-mini';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, 'Supabase service configuration is missing');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function bearerToken(req: Request): string {
  const auth = req.headers.get('Authorization');
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new HttpError(401, 'Missing bearer token');
  return match[1];
}

async function getAuthenticatedAppUser(admin: SupabaseClient, req: Request): Promise<AppUser> {
  const token = bearerToken(req);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid bearer token');

  const authUser = data.user;
  const authId = authUser.id;
  const email = authUser.email ?? null;

  let query = admin
    .from('User')
    .select('id, authUserId, email, sex, dob')
    .eq('authUserId', authId)
    .maybeSingle();
  let result = await query;
  if (result.error) throw result.error;
  if (result.data) return result.data as AppUser;

  result = await admin
    .from('User')
    .select('id, authUserId, email, sex, dob')
    .eq('id', authId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (result.data) return result.data as AppUser;

  if (email) {
    result = await admin
      .from('User')
      .select('id, authUserId, email, sex, dob')
      .eq('email', email)
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data) {
      const appUser = result.data as AppUser;
      if (!appUser.authUserId) {
        await admin.from('User').update({ authUserId: authId }).eq('id', appUser.id);
      }
      return { ...appUser, authUserId: authId };
    }
  }

  throw new HttpError(404, 'HealthFolio profile not found for authenticated user');
}

function parseStoragePointer(fileUrl: string): { bucket: string; path: string } {
  if (fileUrl.startsWith('storage://')) {
    const rest = fileUrl.slice('storage://'.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) throw new HttpError(400, 'Invalid storage URL');
    return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    throw new HttpError(400, 'Document fileUrl must be a Supabase storage path, not an HTTP URL');
  }

  return { bucket: DOCUMENT_BUCKET, path: fileUrl.replace(/^\/+/, '') };
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function normalizeMime(fileType: string): string {
  const lower = fileType.toLowerCase();
  if (lower.includes('pdf')) return 'application/pdf';
  if (lower.includes('png')) return 'image/png';
  if (lower.includes('jpg') || lower.includes('jpeg')) return 'image/jpeg';
  throw new HttpError(400, 'OCR supports PDF, JPG, and PNG files for MVP');
}

function filenameFor(documentId: string, mime: string): string {
  if (mime === 'application/pdf') return `${documentId}.pdf`;
  if (mime === 'image/png') return `${documentId}.png`;
  return `${documentId}.jpg`;
}

function ageYears(dob: string | null): number | undefined {
  if (!dob) return undefined;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return undefined;
  return Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function resolveRange(entry: CatalogRow, user: AppUser): NumericRange | null {
  const sex = user.sex === 'male' || user.sex === 'female' ? user.sex : undefined;
  const age = ageYears(user.dob);
  const def = entry.rangeDefault;

  if (age !== undefined && Array.isArray(def.byAge)) {
    const ageMatch = def.byAge.find((band) => age >= band.minAge && age <= band.maxAge);
    if (ageMatch) return ageMatch.range;
  }

  if (sex && def.bySex?.[sex]) return def.bySex[sex] ?? null;
  return def.default ?? null;
}

function computeRangeFlag(value: number, entry: CatalogRow, user: AppUser): string {
  if (entry.criticalLow !== null && value < entry.criticalLow) return 'critical';
  if (entry.criticalHigh !== null && value > entry.criticalHigh) return 'critical';

  const range = resolveRange(entry, user);
  if (!range) return 'unknown';
  if (range.min !== null && value < range.min) return 'low';
  if (range.max !== null && value > range.max) return 'high';
  return 'normal';
}

async function rangeUserForDocument(
  admin: SupabaseClient,
  appUser: AppUser,
  document: DocumentRow,
): Promise<AppUser> {
  if (document.ownerUserId === appUser.id) return appUser;

  const { data, error } = await admin
    .from('User')
    .select('id, authUserId, email, sex, dob')
    .eq('id', document.ownerUserId)
    .maybeSingle();
  if (error) throw error;
  return (data as AppUser | null) ?? appUser;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

async function setDocumentProgress(
  admin: SupabaseClient,
  documentId: string,
  progress: number,
  stage: string,
  status?: string,
): Promise<void> {
  const { error } = await admin
    .from('Document')
    .update({
      ...(status ? { ocrStatus: status } : {}),
      ocrProgress: progress,
      ocrStage: stage,
    })
    .eq('id', documentId);
  if (error) throw error;
}

function ocrJsonSchema(parameterIds: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['document_date', 'lab_name', 'readings', 'warnings'],
    properties: {
      document_date: {
        type: ['string', 'null'],
        description: 'Report collection/source date if visible, ISO YYYY-MM-DD when possible.',
      },
      lab_name: {
        type: ['string', 'null'],
        description: 'Lab, hospital, or provider name if visible.',
      },
      readings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'parameter_id',
            'observed_label',
            'value',
            'unit',
            'recorded_at',
            'confidence',
            'page',
          ],
          properties: {
            parameter_id: {
              type: 'string',
              enum: parameterIds,
              description: 'Best matching HealthFolio parameter id from the allowed catalog.',
            },
            observed_label: {
              type: 'string',
              description: 'Exact or near-exact label seen on the report.',
            },
            value: {
              type: 'number',
              description: 'Numeric result value only. Do not include inequality symbols or text.',
            },
            unit: {
              type: 'string',
              description:
                'Unit printed on the report, or the catalog unit when the report omits it.',
            },
            recorded_at: {
              type: ['string', 'null'],
              description: 'ISO date for this reading if visible, otherwise null.',
            },
            confidence: {
              type: 'number',
              description: '0 to 1 confidence for this specific extraction and catalog match.',
            },
            page: {
              type: ['integer', 'null'],
              description: 'One-based source page number if known.',
            },
          },
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  };
}

function buildPrompt(catalog: CatalogRow[]): string {
  const compactCatalog = catalog.map((entry) => ({
    id: entry.id,
    name: entry.canonicalName,
    aliases: entry.aliases ?? [],
    unit: entry.unit,
    panel: entry.panel,
  }));

  return [
    'Extract lab-report readings for HealthFolio.',
    'Return only readings that match one of the allowed catalog ids.',
    'Prefer exact printed values and units. Do not infer missing numeric values.',
    'If a value is qualitative, a paragraph, a diagnosis, or a medication instruction, skip it.',
    'Do not decide whether a result is normal or abnormal. The backend will compute range flags.',
    'If the report contains repeated rows for the same parameter, keep the clearest current result.',
    '',
    'Allowed catalog:',
    JSON.stringify(compactCatalog),
  ].join('\n');
}

function fileContentItem(mime: string, filename: string, base64: string) {
  if (mime === 'application/pdf') {
    return {
      type: 'input_file',
      filename,
      file_data: `data:${mime};base64,${base64}`,
    };
  }

  return {
    type: 'input_image',
    image_url: `data:${mime};base64,${base64}`,
  };
}

function outputText(response: Record<string, unknown>): string {
  if (typeof response.output_text === 'string') return response.output_text;

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const maybeItem = item as { content?: unknown };
    const content = Array.isArray(maybeItem.content) ? maybeItem.content : [];
    for (const part of content) {
      const maybePart = part as { type?: string; text?: unknown };
      if (
        (maybePart.type === 'output_text' || maybePart.type === 'text') &&
        typeof maybePart.text === 'string'
      ) {
        return maybePart.text;
      }
    }
  }

  throw new Error('OpenAI response did not include output text');
}

async function extractWithOpenAI(
  fileBytes: Uint8Array,
  mime: string,
  documentId: string,
  catalog: CatalogRow[],
): Promise<OcrResult> {
  if (!OPENAI_API_KEY) throw new HttpError(500, 'OPENAI_API_KEY is not configured');

  const base64 = bytesToBase64(fileBytes);
  const body = {
    model: OPENAI_MODEL,
    store: false,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: 'You extract structured numeric lab readings from medical report files. You never provide medical advice.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          fileContentItem(mime, filenameFor(documentId, mime), base64),
          {
            type: 'input_text',
            text: buildPrompt(catalog),
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'healthfolio_ocr_result',
        strict: true,
        schema: ocrJsonSchema(catalog.map((entry) => entry.id)),
      },
    },
    max_output_tokens: 5000,
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message = JSON.stringify(payload).slice(0, 500);
    throw new Error(`OpenAI OCR failed: ${message}`);
  }

  return JSON.parse(outputText(payload)) as OcrResult;
}

async function processDocumentOcr(
  admin: SupabaseClient,
  appUser: AppUser,
  documentId: string,
  document: DocumentRow,
): Promise<{ documentId: string; status: string; extracted: number; warnings: string[] }> {
  const doc = document;

  await admin
    .from('Document')
    .update({
      ocrStatus: 'processing',
      ocrProgress: 15,
      ocrStage: 'downloading_document',
      ocrError: null,
      ocrStartedAt: new Date().toISOString(),
      ocrCompletedAt: null,
    })
    .eq('id', documentId);

  const attempt = await admin.rpc('increment_document_ocr_attempts', {
    p_document_id: documentId,
  });
  if (attempt.error) {
    const { data: current } = await admin
      .from('Document')
      .select('ocrAttempts')
      .eq('id', documentId)
      .maybeSingle();
    const attempts = Number((current as { ocrAttempts?: number } | null)?.ocrAttempts ?? 0) + 1;
    await admin.from('Document').update({ ocrAttempts: attempts }).eq('id', documentId);
  }

  const { bucket, path } = parseStoragePointer(doc.fileUrl!);
  const mime = normalizeMime(doc.fileType);
  const { data: fileBlob, error: downloadError } = await admin.storage.from(bucket).download(path);
  if (downloadError || !fileBlob) {
    throw downloadError ?? new Error('Could not download document file');
  }
  await setDocumentProgress(admin, documentId, 35, 'loading_catalog');

  const { data: catalogData, error: catalogError } = await admin
    .from('ParameterCatalog')
    .select('id, canonicalName, aliases, unit, panel, rangeDefault, criticalLow, criticalHigh')
    .order('panel', { ascending: true });
  if (catalogError) throw catalogError;

  const catalog = (catalogData ?? []) as CatalogRow[];
  if (catalog.length === 0) throw new Error('Parameter catalog is empty');

  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const rangeUser = await rangeUserForDocument(admin, appUser, doc);
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  await setDocumentProgress(admin, documentId, 55, 'extracting_readings');
  const extraction = await extractWithOpenAI(bytes, mime, documentId, catalog);
  const readings = uniqueReadings(extraction.readings, catalogById);
  await setDocumentProgress(admin, documentId, 80, 'saving_readings');

  await admin
    .from('ParameterReading')
    .delete()
    .eq('documentId', documentId)
    .eq('status', 'pending')
    .eq('isUserVerified', false);

  const rows = readings.map((reading) => {
    const entry = catalogById.get(reading.parameter_id)!;
    return {
      userId: doc.ownerUserId,
      documentId,
      parameterId: reading.parameter_id,
      value: reading.value,
      unit: reading.unit || entry.unit,
      recordedAt: normalizeDate(
        reading.recorded_at ?? extraction.document_date,
        doc.sourceDate ?? doc.createdAt,
      ),
      status: 'pending',
      isUserVerified: false,
      confidenceScore: clampConfidence(reading.confidence),
      rangeFlag: computeRangeFlag(reading.value, entry, rangeUser),
      sourceRegion: null,
      createdByUserId: appUser.id,
    };
  });

  if (rows.length > 0) {
    const { error: insertError } = await admin.from('ParameterReading').insert(rows);
    if (insertError) throw insertError;
  }

  const updatePayload: Record<string, unknown> = {
    ocrStatus: 'ready_for_review',
    ocrProgress: 100,
    ocrStage: 'ready_for_review',
    ocrModel: OPENAI_MODEL,
    ocrError: null,
    ocrCompletedAt: new Date().toISOString(),
  };
  if (!doc.labName && extraction.lab_name) updatePayload.labName = extraction.lab_name;
  const extractedDocumentDate = normalizeOptionalDate(extraction.document_date);
  if (extractedDocumentDate) updatePayload.sourceDate = extractedDocumentDate;

  const { error: updateError } = await admin
    .from('Document')
    .update(updatePayload)
    .eq('id', documentId);
  if (updateError) throw updateError;

  return {
    documentId,
    status: 'ready_for_review',
    extracted: rows.length,
    warnings: extraction.warnings,
  };
}

async function markDocumentFailed(
  admin: SupabaseClient,
  documentId: string,
  error: unknown,
): Promise<void> {
  await admin
    .from('Document')
    .update({
      ocrStatus: 'failed',
      ocrProgress: 100,
      ocrStage: 'failed',
      ocrCompletedAt: new Date().toISOString(),
      ocrError: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown OCR error',
    })
    .eq('id', documentId);
}

function waitUntilAvailable(): boolean {
  return typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function';
}

function normalizeDate(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
}

function normalizeOptionalDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function uniqueReadings(
  readings: OcrReading[],
  catalogById: Map<string, CatalogRow>,
): OcrReading[] {
  const best = new Map<string, OcrReading>();

  for (const reading of readings) {
    if (!catalogById.has(reading.parameter_id)) continue;
    if (!Number.isFinite(reading.value)) continue;

    const confidence = clampConfidence(reading.confidence);
    const existing = best.get(reading.parameter_id);
    if (!existing || confidence > clampConfidence(existing.confidence)) {
      best.set(reading.parameter_id, { ...reading, confidence });
    }
  }

  return [...best.values()];
}

function parseDocumentIds(body: { documentId?: unknown; documentIds?: unknown }): string[] {
  const ids = Array.isArray(body.documentIds)
    ? body.documentIds
    : typeof body.documentId === 'string'
      ? [body.documentId]
      : [];

  const uniqueIds = [
    ...new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
  ];
  if (uniqueIds.length === 0) throw new HttpError(400, 'documentId or documentIds is required');
  if (uniqueIds.length > 20) throw new HttpError(400, 'At most 20 documents can be queued at once');
  return uniqueIds;
}

async function loadAuthorizedDocuments(
  admin: SupabaseClient,
  appUser: AppUser,
  documentIds: string[],
): Promise<DocumentRow[]> {
  const { data, error } = await admin
    .from('Document')
    .select('id, ownerUserId, uploadedByUserId, fileUrl, fileType, sourceDate, createdAt, labName')
    .in('id', documentIds);
  if (error) throw error;

  const byId = new Map((data ?? []).map((row) => [(row as DocumentRow).id, row as DocumentRow]));
  const documents: DocumentRow[] = [];

  for (const id of documentIds) {
    const doc = byId.get(id);
    if (!doc) throw new HttpError(404, `Document not found: ${id}`);
    if (doc.ownerUserId !== appUser.id && doc.uploadedByUserId !== appUser.id) {
      throw new HttpError(403, `Document does not belong to authenticated user: ${id}`);
    }
    if (!doc.fileUrl) throw new HttpError(400, `Document has no uploaded storage path: ${id}`);
    documents.push(doc);
  }

  return documents;
}

async function markDocumentsQueued(admin: SupabaseClient, documentIds: string[]): Promise<void> {
  const { error } = await admin
    .from('Document')
    .update({
      ocrStatus: 'queued',
      ocrProgress: 5,
      ocrStage: 'queued',
      ocrQueuedAt: new Date().toISOString(),
      ocrStartedAt: null,
      ocrCompletedAt: null,
      ocrError: null,
    })
    .in('id', documentIds);
  if (error) throw error;
}

async function processDocuments(
  admin: SupabaseClient,
  appUser: AppUser,
  documents: DocumentRow[],
): Promise<OcrJobResult[]> {
  const results: OcrJobResult[] = [];

  for (const doc of documents) {
    try {
      results.push(await processDocumentOcr(admin, appUser, doc.id, doc));
    } catch (error) {
      await markDocumentFailed(admin, doc.id, error);
      results.push({
        documentId: doc.id,
        status: 'failed',
        extracted: 0,
        warnings: [],
        error: error instanceof Error ? error.message : 'Unknown OCR error',
      });
    }
  }

  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const admin = getAdminClient();
    const appUser = await getAuthenticatedAppUser(admin, req);
    const body = (await req.json()) as { documentId?: unknown; documentIds?: unknown };
    const documentIds = parseDocumentIds(body);
    const documents = await loadAuthorizedDocuments(admin, appUser, documentIds);
    await markDocumentsQueued(admin, documentIds);

    if (waitUntilAvailable()) {
      EdgeRuntime.waitUntil(processDocuments(admin, appUser, documents));

      return jsonResponse(
        {
          documents: documentIds.map((id) => ({ documentId: id, status: 'queued' })),
          status: 'queued',
          message: 'OCR processing has started.',
        },
        202,
      );
    }

    const results = await processDocuments(admin, appUser, documents);
    return jsonResponse({ documents: results });
  } catch (error) {
    return errorResponse(error);
  }
});
