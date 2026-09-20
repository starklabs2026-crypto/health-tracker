#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const PROJECT_REF = 'qojdeuacwkmlxmodeabt';
const CONSENT_VERSION = '2026-07-10';
const BASE_URL = `https://${PROJECT_REF}.supabase.co`;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const restPath = (table, query = {}) => `/rest/v1/${table}?${new URLSearchParams(query)}`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class SmokeFailure extends Error {
  constructor(stage, category) {
    super('Synthetic upload smoke failed');
    this.stage = stage;
    this.category = category;
  }
}

function requireFixture(condition, stage) {
  if (!condition) throw new SmokeFailure(stage, 'unexpected_fixture_result');
}

function errorCategory(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (/insufficient_quota|billing_hard_limit/i.test(text)) return 'provider_quota';
  if (/invalid_api_key|incorrect api key/i.test(text)) return 'provider_credentials';
  if (/OPENAI_API_KEY is not configured/i.test(text)) return 'provider_not_configured';
  if (/timed?\s*out|timeout/i.test(text)) return 'timeout';
  if (/rate_limit/i.test(text)) return 'rate_limit';
  return 'request_failed';
}

export function makeSyntheticReport(patientName, date) {
  const python = process.env.REPORTLAB_PYTHON
    ?? `${homedir()}/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`;
  return execFileSync(python, ['-c', `
import io, json, sys
from reportlab.pdfgen import canvas
from pypdf import PdfReader
fixture = json.load(sys.stdin)
output = io.BytesIO()
pdf = canvas.Canvas(output, pagesize=(595, 842))
pdf.setFont('Helvetica-Bold', 18)
pdf.drawString(48, 785, 'Example Synthetic Laboratory')
pdf.setFont('Helvetica-Bold', 12)
pdf.drawString(48, 755, 'LABORATORY REPORT')
pdf.setFont('Helvetica', 10)
for y, text in [
    (730, 'SYNTHETIC TEST DATA - NOT A REAL PATIENT'),
    (700, 'Patient: ' + fixture['patientName']),
    (682, 'Date of birth: 1990-01-01'),
    (664, 'Collection date: ' + fixture['date']),
    (646, 'Specimen: Blood'),
]:
    pdf.drawString(48, y, text)
pdf.setFont('Courier', 10)
for y, text in [
    (605, 'Test                      Result    Unit      Reference'),
    (580, 'Fasting Blood Glucose      104       mg/dL     70 - 99'),
    (555, 'Hemoglobin                13.5      g/dL      12 - 16'),
    (530, 'Total Cholesterol         180       mg/dL     Below 200'),
]:
    pdf.drawString(48, y, text)
pdf.setFont('Helvetica', 10)
pdf.drawString(48, 480, 'This fictional medical report is for upload and extraction testing only.')
pdf.drawString(48, 462, 'No diagnosis, medication, or treatment recommendation is provided.')
pdf.showPage()
pdf.save()
reader = PdfReader(io.BytesIO(output.getvalue()))
assert len(reader.pages) == 1
assert all(value in reader.pages[0].extract_text() for value in ['104', '13.5', '180'])
sys.stdout.buffer.write(output.getvalue())
`], {
    input: JSON.stringify({ patientName, date }), timeout: 20000,
    stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 2000000,
  });
}

function managementTokenFromKeychain() {
  let raw;
  try {
    raw = execFileSync('/usr/bin/security', [
      'find-generic-password', '-s', 'Supabase CLI', '-w',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    throw new SmokeFailure('keychain', 'unavailable');
  }
  if (raw.startsWith('go-keyring-encoded:')) {
    const encoded = raw.slice('go-keyring-encoded:'.length);
    requireFixture(/^(?:[0-9a-f]{2})+$/i.test(encoded), 'keychain_encoding');
    raw = Buffer.from(encoded, 'hex').toString('utf8');
  } else if (raw.startsWith('go-keyring-base64:')) {
    raw = Buffer.from(raw.slice('go-keyring-base64:'.length), 'base64').toString('utf8');
  }
  requireFixture(/^sbp_[A-Za-z0-9]+$/.test(raw), 'keychain_token_format');
  return raw;
}

export async function runUploadSmoke({ fetchImpl = fetch, log = console.log } = {}) {
  const started = performance.now();
  const steps = [];
  const report = { ok: false, steps, cleanupVerified: false };
  const emit = (event) => log(JSON.stringify(event));
  const runId = randomUUID();
  const fixtureName = `Synthetic Upload ${runId.slice(0, 8)}`;
  const email = `healthfolio-upload-${runId}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const documentId = randomUUID();
  let authUserId = randomUUID();
  let appUserId;
  let storagePath;
  let serviceKey;
  let publicKey;
  let accessToken;
  let authAttempted = false;
  let documentAttempted = false;
  let storageAttempted = false;
  let ocrStartedAt;
  let ocrTerminal = false;

  async function request(stage, path, {
    method = 'GET', body, admin = false, management = false,
    binary = false, raw = false, headers = {}, timeout = 30000,
    acceptable = [],
  } = {}) {
    const start = performance.now();
    const url = path.startsWith('https://') ? path : `${BASE_URL}${path}`;
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          ...(management ? {} : {
            apikey: admin ? serviceKey : publicKey,
            Authorization: `Bearer ${admin ? serviceKey : accessToken ?? publicKey}`,
          }),
          ...(body === undefined ? {} : { 'Content-Type': raw ? 'application/pdf' : 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
        redirect: 'error',
      });
      const payload = binary ? Buffer.from(await response.arrayBuffer()) : await response.text();
      const entry = { stage, status: response.status, durationMs: Math.round(performance.now() - start) };
      steps.push(entry);
      emit(entry);
      if (!response.ok && !acceptable.includes(response.status)) {
        throw new SmokeFailure(stage, errorCategory(payload));
      }
      if (binary) return { status: response.status, data: payload };
      let data;
      try { data = payload ? JSON.parse(payload) : null; }
      catch { throw new SmokeFailure(stage, 'invalid_json'); }
      return { status: response.status, data };
    } catch (error) {
      if (error instanceof SmokeFailure) throw error;
      const entry = { stage, status: response?.status ?? null, durationMs: Math.round(performance.now() - start) };
      steps.push(entry);
      emit(entry);
      throw new SmokeFailure(stage, error?.name === 'TimeoutError' ? 'timeout' : 'network_failure');
    }
  }

  const getDocument = (stage, admin = false) => request(stage, restPath('Document', {
    id: `eq.${documentId}`,
    select: 'id,ownerUserId,fileUrl,ocrStatus,ocrProgress,ocrAttempts,ocrError,ocrModel',
  }), { admin });

  try {
    const now = new Date().toISOString();
    const pdf = makeSyntheticReport(fixtureName, now.slice(0, 10));
    requireFixture(pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 1000, 'pdf_valid');
    report.pdfBytes = pdf.length;
    emit({ stage: 'pdf_generated_and_parsed', bytes: pdf.length });
    const managementToken = managementTokenFromKeychain();
    const { data: keys } = await request('management_keys',
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
        management: true, headers: { Authorization: `Bearer ${managementToken}` },
      });
    requireFixture(Array.isArray(keys), 'management_keys_shape');
    serviceKey = keys.find((key) => key.name === 'service_role')?.api_key;
    publicKey = keys.find((key) => key.name === 'anon')?.api_key;
    requireFixture(serviceKey && publicKey, 'management_keys_available');

    authAttempted = true;
    const { data: created } = await request('auth_create', '/auth/v1/admin/users', {
      admin: true, method: 'POST', body: {
        id: authUserId, email, password, email_confirm: true,
        user_metadata: { name: fixtureName, syntheticUploadSmoke: true },
      },
    });
    requireFixture(typeof created?.id === 'string', 'auth_create_id');
    authUserId = created.id;
    appUserId = authUserId;
    storagePath = `${authUserId}/documents/${documentId}/synthetic-upload-smoke.pdf`;
    const { data: session } = await request('auth_sign_in', '/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email, password },
    });
    requireFixture(session?.user?.id === authUserId && session.access_token, 'auth_sign_in_identity');
    accessToken = session.access_token;

    const { data: profileId } = await request('self_profile_upsert', '/rest/v1/rpc/upsert_app_user_profile', {
      method: 'POST', body: {
        p_name: fixtureName, p_dob: '1990-01-01T00:00:00.000Z', p_sex: 'other',
        p_units_preference: 'metric', p_blood_group: null, p_has_blood_group: false,
      },
    });
    requireFixture(profileId === appUserId, 'self_profile_identity');
    await request('consent', restPath('UserConsent', { on_conflict: 'userId,consentVersion' }), {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: {
        userId: appUserId, consentVersion: CONSENT_VERSION, privacyPolicyVersion: CONSENT_VERSION,
        eulaType: 'apple_standard', healthDataProcessingAccepted: true, source: 'ios_email',
      },
    });
    const { data: catalog } = await request('catalog_read', restPath('ParameterCatalog', {
      select: 'id,canonicalName,unit', limit: '1000',
    }));
    const expected = [
      { match: /^(?:fasting\s+(?:blood\s+)?)?glucose(?:\s*\(fasting\))?$/i, value: 104 },
      { match: /^(?:hemoglobin|haemoglobin)(?:\s*\(hgb\))?$/i, value: 13.5 },
      { match: /^(?:total cholesterol|cholesterol[ ,]+total)$/i, value: 180 },
    ];
    const expectedById = new Map(catalog.flatMap((row) => {
      const found = expected.find((entry) => entry.match.test(row.canonicalName));
      return found ? [[row.id, found.value]] : [];
    }));
    requireFixture(expectedById.size >= 2, 'catalog_expected_parameters');
    documentAttempted = true;
    const { data: inserted } = await request('document_create', restPath('Document', { select: 'id' }), {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: {
        id: documentId, ownerUserId: appUserId, uploadedByUserId: appUserId,
        fileType: 'application/pdf', docType: 'lab_report', sourceDate: now,
        notes: 'Disposable synthetic upload smoke; no real patient data.',
        ocrStatus: 'pending_upload', ocrProgress: 0, ocrStage: 'awaiting_upload',
      },
    });
    requireFixture(inserted?.[0]?.id === documentId, 'document_persisted_id');
    storageAttempted = true;
    await request('pdf_upload', `/storage/v1/object/medical-documents/${storagePath}`, {
      method: 'POST', raw: true, body: pdf, headers: { 'x-upsert': 'false' },
    });
    const { data: attached } = await request('document_attach', restPath('Document', {
      id: `eq.${documentId}`, select: 'id,fileUrl',
    }), {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: {
        fileUrl: storagePath, ocrStatus: 'queued', ocrProgress: 5,
        ocrStage: 'queued', ocrQueuedAt: new Date().toISOString(), ocrError: null,
      },
    });
    requireFixture(attached?.[0]?.fileUrl === storagePath, 'document_attached');
    const { data: beforeOcr } = await getDocument('document_get_before_ocr');
    requireFixture(beforeOcr?.[0]?.id === documentId && beforeOcr[0].ownerUserId === appUserId,
      'persisted_self_document');

    ocrStartedAt = performance.now();
    const { data: ocr } = await request('ocr_inline', '/functions/v1/process-document-ocr', {
      method: 'POST', body: { documentId, wait: true }, timeout: 180000,
    });
    const result = ocr?.documents?.find((entry) => entry.documentId === documentId);
    ocrTerminal = ['ready_for_review', 'failed'].includes(result?.status);
    if (result?.status === 'failed') throw new SmokeFailure('ocr_result', errorCategory(result.error));
    requireFixture(ocr?.mode === 'inline' && result?.status === 'ready_for_review', 'ocr_ready');
    report.ocrExtracted = result.extracted;
    const { data: finalDocuments } = await getDocument('document_get_after_ocr');
    const finalDocument = finalDocuments?.[0];
    requireFixture(finalDocument?.ownerUserId === appUserId && finalDocument?.fileUrl === storagePath
      && finalDocument?.ocrStatus === 'ready_for_review', 'ocr_document_state');
    report.ocrAttempts = finalDocument.ocrAttempts;
    const { data: readings } = await request('extracted_readings', restPath('ParameterReading', {
      documentId: `eq.${documentId}`, select: 'id,userId,documentId,parameterId,value,unit',
    }));
    requireFixture(readings.length >= 2 && readings.every((row) => row.userId === appUserId
      && row.documentId === documentId), 'readings_self_isolation');
    const matched = readings.filter((row) => expectedById.has(row.parameterId)
      && Math.abs(Number(row.value) - expectedById.get(row.parameterId)) < 0.001);
    requireFixture(matched.length >= 2, 'readings_match_pdf');
    report.readingCount = readings.length;
    report.expectedValueMatches = matched.length;

    const { data: signed } = await request('preview_sign', `/storage/v1/object/sign/medical-documents/${storagePath}`, {
      method: 'POST', body: { expiresIn: 60 },
    });
    requireFixture(typeof signed?.signedURL === 'string', 'preview_signed_url');
    const previewURL = new URL(signed.signedURL, `${BASE_URL}/storage/v1/`);
    if (previewURL.pathname.startsWith('/object/')) previewURL.pathname = `/storage/v1${previewURL.pathname}`;
    requireFixture(previewURL.origin === BASE_URL
      && previewURL.pathname === `/storage/v1/object/sign/medical-documents/${storagePath}`, 'preview_origin');
    const { data: preview } = await request('preview_download', previewURL.href, {
      binary: true, management: true,
    });
    requireFixture(digest(preview) === digest(pdf), 'preview_exact_pdf');
    report.previewMatchesUpload = true;
    report.ok = true;
  } catch (error) {
    report.failure = error instanceof SmokeFailure
      ? { stage: error.stage, category: error.category }
      : { stage: 'smoke', category: 'unexpected_error' };
  } finally {
    const cleanupFailures = [];
    const clean = async (stage, fn) => {
      try { await fn(); }
      catch { cleanupFailures.push(stage); emit({ stage, cleanupFailed: true }); }
    };
    // A timed-out client must not delete underneath an OCR invocation still saving results.
    if (ocrStartedAt && !ocrTerminal) {
      await clean('wait_for_ocr_before_cleanup', async () => {
        while (performance.now() - ocrStartedAt < 300000) {
          const { data: docs } = await getDocument('cleanup_ocr_state', true);
          if (!docs.length || ['ready_for_review', 'failed'].includes(docs[0].ocrStatus)) {
            ocrTerminal = true;
            break;
          }
          await pause(5000);
        }
        requireFixture(ocrTerminal, 'ocr_settled_before_cleanup');
      });
    }
    if (serviceKey && authAttempted) {
      if (documentAttempted) {
        await clean('cleanup_readings', () => request('cleanup_readings', restPath('ParameterReading', {
          documentId: `eq.${documentId}`,
        }), { admin: true, method: 'DELETE' }));
        await clean('cleanup_document', () => request('cleanup_document', restPath('Document', {
          id: `eq.${documentId}`, ownerUserId: `eq.${appUserId}`,
        }), { admin: true, method: 'DELETE' }));
      }
      if (storageAttempted) await clean('cleanup_storage', () => request('cleanup_storage',
        '/storage/v1/object/medical-documents', {
          admin: true, method: 'DELETE', body: { prefixes: [storagePath] },
        }));
      // Profile-owned consent/health rows use database cascades, never broad table deletes.
      await clean('cleanup_profile', () => request('cleanup_profile', restPath('User', {
        id: `eq.${appUserId ?? authUserId}`, authUserId: `eq.${authUserId}`,
      }), { admin: true, method: 'DELETE' }));
      await clean('cleanup_auth', () => request('cleanup_auth', `/auth/v1/admin/users/${authUserId}`, {
        admin: true, method: 'DELETE', acceptable: [404],
      }));
      for (const [table, query] of [
        ['User', { id: `eq.${appUserId ?? authUserId}` }],
        ['UserConsent', { userId: `eq.${appUserId ?? authUserId}` }],
        ['HealthProfile', { userId: `eq.${appUserId ?? authUserId}` }],
        ['Document', { id: `eq.${documentId}` }],
        ['ParameterReading', { documentId: `eq.${documentId}` }],
      ]) await clean(`verify_deleted_${table}`, async () => {
        const { data } = await request(`verify_deleted_${table}`, restPath(table, { ...query, select: '*', limit: '1' }), { admin: true });
        requireFixture(Array.isArray(data) && data.length === 0, `deleted_${table}`);
      });
      await clean('verify_deleted_auth', async () => {
        const { status } = await request('verify_deleted_auth', `/auth/v1/admin/users/${authUserId}`, {
          admin: true, acceptable: [404],
        });
        requireFixture(status === 404, 'deleted_auth');
      });
      if (storageAttempted) await clean('verify_deleted_storage', async () => {
        const { data } = await request('verify_deleted_storage', '/storage/v1/object/list/medical-documents', {
          admin: true, method: 'POST', body: {
            prefix: `${authUserId}/documents/${documentId}/`, limit: 2,
          },
        });
        requireFixture(Array.isArray(data) && data.length === 0, 'deleted_storage');
      });
    }
    report.cleanupVerified = Boolean(serviceKey && authAttempted && cleanupFailures.length === 0);
    if (cleanupFailures.length) report.cleanupFailures = cleanupFailures;
    report.ok = report.ok && report.cleanupVerified;
    report.durationMs = Math.round(performance.now() - started);
    emit({ summary: report });
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3 || process.argv[2] !== '--live') {
    console.error('Explicit --live required: creates and deletes disposable synthetic upload fixtures.');
    process.exitCode = 2;
  } else {
    const result = await runUploadSmoke();
    process.exitCode = result.ok ? 0 : 1;
  }
}
