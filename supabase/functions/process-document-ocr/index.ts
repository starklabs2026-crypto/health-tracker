import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import { corsHeaders, errorResponse, HttpError, jsonResponse } from '../_shared/http.ts';

declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };

type AppUser = {
  id: string;
  authUserId: string | null;
  email: string | null;
  name: string;
  sex: string | null;
  dob: string | null;
  unitsPreference: string | null;
  residencyRegion: string | null;
};

type DocumentRow = {
  id: string;
  ownerUserId: string;
  uploadedByUserId: string;
  fileUrl: string | null;
  fileType: string;
  docType: string | null;
  sourceDate: string;
  createdAt: string;
  labName: string | null;
  orderingPhysician: string | null;
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
  medical_document: boolean;
  document_kind: string;
  patient_name: string | null;
  document_date: string | null;
  lab_name: string | null;
  ordering_physician: string | null;
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
const OPENAI_REQUEST_TIMEOUT_MS = 120_000;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const INTERNAL_FUNCTION_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET');
const DEFAULT_MANAGED_PROFILE_DOB = '1900-01-01T00:00:00.000Z';
const UNSUPPORTED_DOCUMENT_MESSAGE = 'This file does not look like a medical record.';
const ALL_DOC_TYPES = [
  'lab_report',
  'prescription',
  'imaging_report',
  'discharge_summary',
  'vaccination_record',
  'other',
];

class UnsupportedDocumentError extends Error {
  constructor() {
    super(UNSUPPORTED_DOCUMENT_MESSAGE);
    this.name = 'UnsupportedDocumentError';
  }
}

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

  const bound = await admin
    .from('User')
    .select('id, authUserId, email, name, sex, dob, unitsPreference, residencyRegion, deletedAt')
    .eq('authUserId', authId)
    .maybeSingle();
  if (bound.error) throw bound.error;

  const legacy = await admin
    .from('User')
    .select('id, authUserId, email, name, sex, dob, unitsPreference, residencyRegion, deletedAt')
    .eq('id', authId)
    .maybeSingle();
  if (legacy.error) throw legacy.error;
  if (bound.data && legacy.data && bound.data.id !== legacy.data.id) {
    throw new HttpError(403, 'Profile identity does not match authenticated user');
  }
  const profile = bound.data ?? legacy.data;
  if (profile?.deletedAt) throw new HttpError(403, 'This profile is no longer active');
  if (profile) {
    const appUser = profile as AppUser;
    if (appUser.authUserId !== null && appUser.authUserId !== authId) {
      throw new HttpError(403, 'Profile identity does not match authenticated user');
    }
    return appUser;
  }

  throw new HttpError(404, 'HealthFolio profile not found for authenticated user');
}

async function getInternalAppUser(
  admin: SupabaseClient,
  req: Request,
  body: { appUserId?: unknown },
): Promise<AppUser | null> {
  const secret = req.headers.get('x-healthfolio-internal-secret');
  if (!INTERNAL_FUNCTION_SECRET || !secret || secret !== INTERNAL_FUNCTION_SECRET) return null;
  if (typeof body.appUserId !== 'string' || body.appUserId.trim().length === 0) {
    throw new HttpError(400, 'appUserId is required for internal OCR requests');
  }

  const { data, error } = await admin
    .from('User')
    .select('id, authUserId, email, name, sex, dob, unitsPreference, residencyRegion, deletedAt')
    .eq('id', body.appUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'HealthFolio profile not found for internal OCR request');
  if (data.deletedAt) throw new HttpError(403, 'This profile is no longer active');
  return data as AppUser;
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
    .select('id, authUserId, email, name, sex, dob, unitsPreference, residencyRegion')
    .eq('id', document.ownerUserId)
    .maybeSingle();
  if (error) throw error;
  return (data as AppUser | null) ?? appUser;
}

function cleanPatientName(rawName: string | null): string | null {
  if (!rawName) return null;
  const cleaned = rawName
    .replace(/^(?:patient|patient\s+name|name|pt\.?\s+name)\s*[:\-]\s*/i, '')
    .replace(/\b(?:mr|mrs|ms|miss|master|shri|smt|dr)\.?\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 2 || cleaned.length > 120) return null;
  if (/[0-9@]/.test(cleaned)) return null;
  return cleaned
    .split(' ')
    .map((part) =>
      part.length <= 2 && part === part.toUpperCase()
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(' ');
}

function nameKey(name: string | null | undefined): string {
  return (name ?? '')
    .replace(/\b(?:mr|mrs|ms|miss|master|shri|smt|dr)\.?\b/gi, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function tokenSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 0;
  return 1 - editDistance(a, b) / maxLength;
}

function tokensProbablyMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) <= 2) return false;
  const similarity = tokenSimilarity(a, b);
  return similarity >= 0.72 && (a[0] === b[0] || similarity >= 0.84);
}

function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const aKey = nameKey(a);
  const bKey = nameKey(b);
  if (!aKey || !bKey) return 0;
  if (aKey === bKey) return 1;

  const aParts = aKey.split(' ');
  const bParts = bKey.split(' ');
  const firstScore = tokenSimilarity(aParts[0] ?? '', bParts[0] ?? '');
  const lastScore = tokenSimilarity(aParts[aParts.length - 1] ?? '', bParts[bParts.length - 1] ?? '');
  const fullScore = tokenSimilarity(aKey, bKey);
  return firstScore * 0.38 + lastScore * 0.42 + fullScore * 0.20;
}

function namesProbablyMatch(a: string, b: string): boolean {
  const aKey = nameKey(a);
  const bKey = nameKey(b);
  if (!aKey || !bKey) return false;
  if (aKey === bKey) return true;

  const aParts = aKey.split(' ');
  const bParts = bKey.split(' ');
  if (!tokensProbablyMatch(aParts[0] ?? '', bParts[0] ?? '')) return false;

  const aLast = aParts[aParts.length - 1];
  const bLast = bParts[bParts.length - 1];
  if (aParts.length > 1 && bParts.length > 1) return tokensProbablyMatch(aLast, bLast);

  return aParts.length === 1 || bParts.length === 1;
}

async function loadManagedProfiles(admin: SupabaseClient, ownerUserId: string): Promise<AppUser[]> {
  const { data: links, error: linksError } = await admin
    .from('FamilyLink')
    .select('memberUserId')
    .eq('ownerUserId', ownerUserId)
    .eq('status', 'active');
  if (linksError) throw linksError;

  const memberIds = (links ?? [])
    .map((link) => (link as { memberUserId?: string }).memberUserId)
    .filter((id): id is string => Boolean(id));
  const ids = [...new Set([ownerUserId, ...memberIds])];

  const { data, error } = await admin
    .from('User')
    .select('id, authUserId, email, name, sex, dob, unitsPreference, residencyRegion')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as AppUser[];
}

function findNameMatch(profiles: AppUser[], patientName: string): AppUser | null {
  const exact = profiles.find((profile) => nameKey(profile.name) === nameKey(patientName));
  if (exact) return exact;

  const loose = profiles.filter((profile) => namesProbablyMatch(profile.name, patientName));
  if (loose.length === 1) return loose[0];

  const ranked = profiles
    .map((profile) => ({ profile, score: nameSimilarity(profile.name, patientName) }))
    .filter((candidate) => candidate.score >= 0.82)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;
  if (ranked.length === 1 || ranked[0].score - ranked[1].score >= 0.06) {
    return ranked[0].profile;
  }

  return null;
}

async function createManagedProfileFromReportName(
  admin: SupabaseClient,
  owner: AppUser,
  patientName: string,
): Promise<AppUser> {
  const profileId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const profile: AppUser = {
    id: profileId,
    authUserId: null,
    email: null,
    name: patientName,
    dob: DEFAULT_MANAGED_PROFILE_DOB,
    sex: 'other',
    unitsPreference: owner.unitsPreference ?? 'metric',
    residencyRegion: owner.residencyRegion ?? 'US',
  };

  const { error: userError } = await admin.from('User').insert({
    id: profile.id,
    authUserId: null,
    email: null,
    phone: null,
    name: profile.name,
    dob: profile.dob,
    sex: profile.sex,
    unitsPreference: profile.unitsPreference,
    bloodGroup: null,
    residencyRegion: profile.residencyRegion,
  });
  if (userError) throw userError;

  const { error: healthError } = await admin.from('HealthProfile').insert({
    userId: profile.id,
    height: null,
    weight: null,
    knownConditions: [],
    allergies: [],
    currentMedications: [],
    updatedAt: timestamp,
  });
  if (healthError) throw healthError;

  const { error: linkError } = await admin.from('FamilyLink').insert({
    ownerUserId: owner.id,
    memberUserId: profile.id,
    role: 'guardian',
    permissions: { docTypes: ALL_DOC_TYPES },
    status: 'active',
    acceptedAt: timestamp,
  });
  if (linkError) throw linkError;

  return profile;
}

async function resolveDocumentOwnerFromPatientName(
  admin: SupabaseClient,
  appUser: AppUser,
  document: DocumentRow,
  rawPatientName: string | null,
): Promise<{
  document: DocumentRow;
  owner: AppUser;
  patientName: string | null;
  createdProfile: boolean;
}> {
  const patientName = cleanPatientName(rawPatientName);
  if (!patientName) {
    return {
      document,
      owner: await rangeUserForDocument(admin, appUser, document),
      patientName: null,
      createdProfile: false,
    };
  }

  // An extracted name is document content, not authority to move health data.
  const owner = await rangeUserForDocument(admin, appUser, document);

  return {
    document: { ...document, ownerUserId: owner.id },
    owner,
    patientName,
    createdProfile: false,
  };
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
    required: [
      'medical_document',
      'document_kind',
      'patient_name',
      'document_date',
      'lab_name',
      'ordering_physician',
      'readings',
      'warnings',
    ],
    properties: {
      medical_document: {
        type: 'boolean',
        description:
          'True only when the file is a medical record such as a lab report, prescription, medicine list, imaging/scans, discharge summary, vaccination record, or doctor note. False for finance, insurance, identity, invoice, travel, school, and other unrelated documents.',
      },
      document_kind: {
        type: 'string',
        enum: ALL_DOC_TYPES,
        description:
          'Best matching medical document kind. Use other for medical notes that do not fit the named categories, or for non-medical files.',
      },
      patient_name: {
        type: ['string', 'null'],
        description:
          'Patient/person name printed on the report, with honorifics removed when possible. Return null if not visible.',
      },
      document_date: {
        type: ['string', 'null'],
        description: 'Report collection/source date if visible, ISO YYYY-MM-DD when possible.',
      },
      lab_name: {
        type: ['string', 'null'],
        description: 'Lab, hospital, or provider name if visible.',
      },
      ordering_physician: {
        type: ['string', 'null'],
        description:
          'Ordering, referring, treating, or reporting doctor/clinician name if explicitly printed; otherwise null.',
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
    'Classify whether this file is a medical record for HealthFolio, then extract lab-report readings when present.',
    'Set medical_document to false when the file is not medical. For non-medical files, return no readings and add a short warning.',
    'For medical records, return only readings that match one of the allowed catalog ids.',
    'Extract the patient/person name if it is explicitly printed on the report.',
    'Extract the hospital, laboratory, or institution name and the doctor/clinician name when explicitly printed.',
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('OpenAI OCR timed out. Please retry this document.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

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
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  await setDocumentProgress(admin, documentId, 55, 'extracting_readings');
  const extraction = await extractWithOpenAI(bytes, mime, documentId, catalog);
  if (!extraction.medical_document) {
    throw new UnsupportedDocumentError();
  }
  const ownerResolution = await resolveDocumentOwnerFromPatientName(
    admin,
    appUser,
    doc,
    extraction.patient_name,
  );
  const finalDoc = ownerResolution.document;
  const rangeUser = ownerResolution.owner;
  const readings = uniqueReadings(extraction.readings, catalogById);
  await setDocumentProgress(admin, documentId, 80, 'saving_readings');

  await admin
    .from('ParameterReading')
    .delete()
    .eq('documentId', documentId)
    .eq('isUserVerified', false);

  const rows = readings.map((reading) => {
    const entry = catalogById.get(reading.parameter_id)!;
    return {
      userId: finalDoc.ownerUserId,
      documentId,
      parameterId: reading.parameter_id,
      value: reading.value,
      unit: reading.unit || entry.unit,
      recordedAt: normalizeDate(
        reading.recorded_at ?? extraction.document_date,
        finalDoc.sourceDate ?? finalDoc.createdAt,
      ),
      status: 'confirmed',
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
  if (extraction.lab_name) updatePayload.labName = extraction.lab_name;
  if (extraction.ordering_physician) {
    updatePayload.orderingPhysician = extraction.ordering_physician;
  }
  // Preserve the upload-time filename/category hint when OCR cannot identify
  // a more specific medical document type.
  if (ALL_DOC_TYPES.includes(extraction.document_kind) && extraction.document_kind !== 'other') {
    updatePayload.docType = extraction.document_kind;
  }
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
  const isUnsupported = error instanceof UnsupportedDocumentError;
  const payload = {
    ocrStatus: 'failed',
    ocrProgress: 100,
    ocrStage: isUnsupported ? 'unsupported_document' : 'failed',
    ocrCompletedAt: new Date().toISOString(),
    ocrError: isUnsupported
      ? UNSUPPORTED_DOCUMENT_MESSAGE
      : errorMessage(error).slice(0, 1000),
  };
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { error: updateError } = await admin
      .from('Document')
      .update(payload)
      .eq('id', documentId);
    if (!updateError) return;
    lastError = updateError;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error('Could not persist OCR failure state');
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
    .select('id, ownerUserId, uploadedByUserId, fileUrl, fileType, docType, sourceDate, createdAt, labName, orderingPhysician')
    .is('deletedAt', null)
    .in('id', documentIds);
  if (error) throw error;

  const byId = new Map((data ?? []).map((row) => [(row as DocumentRow).id, row as DocumentRow]));
  const documents: DocumentRow[] = [];

  for (const id of documentIds) {
    const doc = byId.get(id);
    if (!doc) throw new HttpError(404, `Document not found: ${id}`);
    if (doc.ownerUserId !== appUser.id) {
      const { data: allowed, error: accessError } = await admin.rpc('can_manage_document_for_user', {
        p_requester_id: appUser.id,
        p_document_id: id,
      });
      if (accessError) throw accessError;
      if (allowed !== true) throw new HttpError(403, 'No permission to process this document');
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
  return Promise.all(
    documents.map(async (doc) => {
      try {
        return await processDocumentOcr(admin, appUser, doc.id, doc);
      } catch (error) {
        try {
          await markDocumentFailed(admin, doc.id, error);
        } catch (markError) {
          console.error('Could not persist OCR failure state', {
            documentId: doc.id,
            error: markError,
          });
        }
        return {
          documentId: doc.id,
          status: 'failed',
          extracted: 0,
          warnings: [],
          error: errorMessage(error),
        };
      }
    }),
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }
  return 'Unknown OCR error';
}

async function markBackgroundFailure(
  admin: SupabaseClient,
  documents: DocumentRow[],
  error: unknown,
): Promise<void> {
  console.error('Background OCR failed before document processing completed', error);
  await Promise.allSettled(
    documents.map((document) => markDocumentFailed(admin, document.id, error)),
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const admin = getAdminClient();
    const body = (await req.json()) as {
      appUserId?: unknown;
      documentId?: unknown;
      documentIds?: unknown;
      wait?: unknown;
    };
    const appUser =
      (await getInternalAppUser(admin, req, body)) ?? (await getAuthenticatedAppUser(admin, req));
    const documentIds = parseDocumentIds(body);
    const documents = await loadAuthorizedDocuments(admin, appUser, documentIds);
    await markDocumentsQueued(admin, documentIds);

    if (body.wait === true) {
      console.log('OCR request mode: inline', { documentCount: documents.length });
      const results = await processDocuments(admin, appUser, documents);
      return jsonResponse({ documents: results, mode: 'inline' });
    }

    console.log('OCR request mode: background', { documentCount: documents.length });
    EdgeRuntime.waitUntil(
      processDocuments(admin, appUser, documents).catch((error) =>
        markBackgroundFailure(admin, documents, error),
      ),
    );
    return jsonResponse(
      {
        documents: documents.map((document) => ({
          documentId: document.id,
          status: 'queued',
          extracted: 0,
          warnings: [],
        })),
        mode: 'background',
      },
      202,
    );
  } catch (error) {
    return errorResponse(error);
  }
});
