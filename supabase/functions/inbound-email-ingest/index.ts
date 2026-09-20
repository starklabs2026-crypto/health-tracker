import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import { corsHeaders, HttpError, jsonResponse } from '../_shared/http.ts';

type AppUser = {
  id: string;
  authUserId: string | null;
  inboundEmailAlias: string | null;
};

type EmailAttachment = {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  idempotencyKey: string | null;
};

type ExistingDocument = {
  id: string;
  fileUrl: string | null;
  ocrStatus: string | null;
  ocrQueuedAt: string | null;
  ocrStartedAt: string | null;
};

type ParsedInboundEmail = {
  recipients: string[];
  from: string | null;
  subject: string | null;
  attachments: EmailAttachment[];
};

const DOCUMENT_BUCKET = Deno.env.get('DOCUMENT_BUCKET') ?? 'medical-documents';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const EMAIL_INGEST_WEBHOOK_SECRET = Deno.env.get('EMAIL_INGEST_WEBHOOK_SECRET');
const INTERNAL_FUNCTION_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET');
// Match the address emitted by HealthFolioProfile; alternative transports are server-owned.
const EMAIL_INGEST_MAILBOX = Deno.env.get('EMAIL_INGEST_MAILBOX')?.trim().toLowerCase() || 'test.healthfolio@gmail.com';
const EMAIL_INGEST_DOMAIN = Deno.env.get('EMAIL_INGEST_DOMAIN')?.trim().toLowerCase();
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const OCR_STALE_AFTER_MS = 15 * 60 * 1000;
const SUPPORTED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, 'Supabase service configuration is missing');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function verifyWebhookSecret(req: Request): void {
  if (!EMAIL_INGEST_WEBHOOK_SECRET) {
    throw new HttpError(500, 'EMAIL_INGEST_WEBHOOK_SECRET is not configured');
  }

  const auth = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerSecret = req.headers.get('x-healthfolio-email-secret');
  if (auth !== EMAIL_INGEST_WEBHOOK_SECRET && headerSecret !== EMAIL_INGEST_WEBHOOK_SECRET) {
    throw new HttpError(401, 'Invalid email ingest secret');
  }
}

function normalizeRecipient(value: string): string | null {
  const match = value.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (!match?.[0]) return null;
  return match[0];
}

function aliasesFromRecipient(value: string): string[] {
  const recipient = normalizeRecipient(value);
  if (!recipient) return [];
  const [localPart, domain] = recipient.split('@');
  const [mailbox, mailboxDomain] = EMAIL_INGEST_MAILBOX.split('@');
  const [base, plusAlias, extra] = (localPart ?? '').split('+');
  const validAlias = (alias: string | undefined): alias is string => Boolean(alias && /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(alias));
  if (domain === mailboxDomain && base === mailbox && extra === undefined && validAlias(plusAlias)) return [plusAlias];
  if (EMAIL_INGEST_DOMAIN && domain === EMAIL_INGEST_DOMAIN && plusAlias === undefined && validAlias(base)) return [base];
  return [];
}

function parseRecipientList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => parseRecipientList(item));
  }
  if (typeof raw === 'object') {
    const object = raw as {
      email?: unknown;
      address?: unknown;
      to?: unknown;
      recipients?: unknown;
    };
    const direct = object.email ?? object.address;
    return [
      ...(typeof direct === 'string' ? parseRecipientList(direct) : []),
      ...parseRecipientList(object.to),
      ...parseRecipientList(object.recipients),
    ];
  }
  if (typeof raw !== 'string') return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed !== raw) return parseRecipientList(parsed);
  } catch {
    // Plain recipient string.
  }

  return raw
    .split(/[,;\n]/)
    .map(normalizeRecipient)
    .filter((recipient): recipient is string => Boolean(recipient));
}

function normalizeMime(contentType: string | null | undefined, filename: string): string {
  const lower = (contentType ?? '').toLowerCase();
  if (SUPPORTED_MIME_TYPES.has(lower)) return lower;

  const name = filename.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return lower || 'application/octet-stream';
}

function fileExt(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}

function notesForAttachment(
  email: Pick<ParsedInboundEmail, 'from' | 'subject'>,
  filename: string,
): string {
  return [
    `Forwarded email attachment: ${filename}`,
    email.subject ? `Subject: ${email.subject}` : null,
    email.from ? `From: ${email.from}` : null,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);
}

function cleanDisplayName(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 200) : null;
}

function isGenericAttachmentName(filename: string): boolean {
  const normalized = filename.trim().toLowerCase();
  return /^(file|attachment|document|scan|report|pdf)([-_\s]?\d+)?\.(pdf|png|jpe?g)$/i.test(
    normalized,
  );
}

function documentNameForAttachment(
  email: Pick<ParsedInboundEmail, 'subject'>,
  filename: string,
): string {
  if (isGenericAttachmentName(filename)) {
    return cleanDisplayName(email.subject) ?? cleanDisplayName(filename) ?? 'Forwarded document';
  }

  return cleanDisplayName(filename) ?? 'Forwarded document';
}

function bytesFromBase64(value: string): Uint8Array {
  const compact = value.replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  const binary = atob(compact);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexFromBuffer(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function contentHash(bytes: Uint8Array): Promise<string> {
  return hexFromBuffer(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer));
}

async function emailIngestKeyForAttachment(attachment: EmailAttachment): Promise<string> {
  if (attachment.idempotencyKey) return `message:${attachment.idempotencyKey}`;
  return `content-sha256:${await contentHash(attachment.bytes)}`;
}

async function requeueDocument(admin: SupabaseClient, documentId: string, ownerUserId: string): Promise<void> {
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
    .eq('id', documentId)
    .eq('ownerUserId', ownerUserId)
    .is('deletedAt', null);
  if (error) throw error;
}

async function rememberEmailIngestKey(
  admin: SupabaseClient,
  documentId: string,
  emailIngestKey: string,
  ownerUserId: string,
): Promise<void> {
  const { error } = await admin
    .from('Document')
    .update({ emailIngestKey })
    .eq('id', documentId)
    .eq('ownerUserId', ownerUserId)
    .is('deletedAt', null);
  if (error) throw error;
}

function shouldRetryExistingDocument(document: ExistingDocument): boolean {
  if (document.ocrStatus === 'failed') return true;
  if (!['queued', 'processing', 'pending_upload'].includes(document.ocrStatus ?? '')) return false;

  const timestamp = document.ocrStatus === 'processing'
    ? document.ocrStartedAt
    : document.ocrQueuedAt;
  if (!timestamp) return true;
  const age = Date.now() - new Date(timestamp).getTime();
  return !Number.isFinite(age) || age >= OCR_STALE_AFTER_MS;
}

async function attachmentFromFile(file: File): Promise<EmailAttachment | null> {
  const contentType = normalizeMime(file.type, file.name);
  if (!SUPPORTED_MIME_TYPES.has(contentType)) return null;
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) return null;

  return {
    filename: file.name || `attachment.${fileExt(contentType)}`,
    contentType,
    bytes: new Uint8Array(await file.arrayBuffer()),
    idempotencyKey: null,
  };
}

function attachmentFromJson(raw: unknown): EmailAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as {
    filename?: unknown;
    name?: unknown;
    contentType?: unknown;
    content_type?: unknown;
    type?: unknown;
    contentBase64?: unknown;
    content_base64?: unknown;
    data?: unknown;
    content?: unknown;
    idempotencyKey?: unknown;
    idempotency_key?: unknown;
  };
  const filename =
    typeof item.filename === 'string'
      ? item.filename
      : typeof item.name === 'string'
        ? item.name
        : 'attachment';
  const contentType = normalizeMime(
    typeof item.contentType === 'string'
      ? item.contentType
      : typeof item.content_type === 'string'
        ? item.content_type
        : typeof item.type === 'string'
          ? item.type
          : null,
    filename,
  );
  if (!SUPPORTED_MIME_TYPES.has(contentType)) return null;

  const base64 = item.contentBase64 ?? item.content_base64 ?? item.data ?? item.content;
  if (typeof base64 !== 'string' || base64.trim().length === 0) return null;

  const bytes = bytesFromBase64(base64);
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES) return null;

  const rawIdempotencyKey = item.idempotencyKey ?? item.idempotency_key;
  const idempotencyKey =
    typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim()
      ? rawIdempotencyKey.trim().slice(0, 500)
      : null;

  return { filename, contentType, bytes, idempotencyKey };
}

async function parseMultipart(req: Request): Promise<ParsedInboundEmail> {
  const form = await req.formData();
  const recipients = [
    ...parseRecipientList(form.get('to')),
    ...parseRecipientList(form.get('recipient')),
    ...parseRecipientList(form.get('recipients')),
    ...parseRecipientList(form.get('envelope')),
  ];
  const attachments: EmailAttachment[] = [];

  for (const [, value] of form.entries()) {
    if (!(value instanceof File)) continue;
    const attachment = await attachmentFromFile(value);
    if (attachment) attachments.push(attachment);
  }

  return {
    recipients: [...new Set(recipients)],
    from: typeof form.get('from') === 'string' ? String(form.get('from')) : null,
    subject: typeof form.get('subject') === 'string' ? String(form.get('subject')) : null,
    attachments: attachments.slice(0, MAX_ATTACHMENTS),
  };
}

async function parseJson(req: Request): Promise<ParsedInboundEmail> {
  const body = (await req.json()) as Record<string, unknown>;
  const envelope = body.envelope as { to?: unknown; recipients?: unknown } | undefined;
  const attachments = Array.isArray(body.attachments)
    ? body.attachments
        .map(attachmentFromJson)
        .filter((item): item is EmailAttachment => Boolean(item))
    : [];

  return {
    recipients: [
      ...parseRecipientList(body.to),
      ...parseRecipientList(body.recipient),
      ...parseRecipientList(body.recipients),
      ...parseRecipientList(envelope?.to),
      ...parseRecipientList(envelope?.recipients),
    ],
    from: typeof body.from === 'string' ? body.from : null,
    subject: typeof body.subject === 'string' ? body.subject : null,
    attachments: attachments.slice(0, MAX_ATTACHMENTS),
  };
}

async function parseInboundEmail(req: Request): Promise<ParsedInboundEmail> {
  const contentType = req.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType.includes('multipart/form-data') ? parseMultipart(req) : parseJson(req);
}

async function resolveRecipientUser(
  admin: SupabaseClient,
  recipients: string[],
): Promise<AppUser> {
  const aliases = recipients
    .flatMap(aliasesFromRecipient)
    .filter((alias): alias is string => Boolean(alias));
  if (aliases.length === 0) throw new HttpError(400, 'No HealthFolio forwarding recipient found');

  const { data, error } = await admin
    .from('User')
    .select('id, authUserId, inboundEmailAlias')
    .in('inboundEmailAlias', [...new Set(aliases)])
    .is('deletedAt', null);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new HttpError(404, 'Forwarding address is not assigned to a HealthFolio user');
  }
  if (data.length > 1) {
    throw new HttpError(400, 'Forwarded email matched multiple HealthFolio users');
  }
  const user = data[0];
  if (!user) throw new HttpError(404, 'Forwarding address is not assigned to a HealthFolio user');
  return user as AppUser;
}

async function assertIndependentRecipient(admin: SupabaseClient, user: AppUser): Promise<void> {
  const authId = user.authUserId ?? user.id;
  const isAuthId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const unavailable = () => new HttpError(403, 'Email forwarding is unavailable for this profile pending verified account access.');
  if (!isAuthId(authId)) throw unavailable();

  const authExists = async (id: string): Promise<boolean> => {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error) {
      if (error.status === 404 || error.code === 'user_not_found') return false;
      throw new HttpError(503, 'Email forwarding account verification is temporarily unavailable.');
    }
    return data.user?.id === id;
  };
  if (!await authExists(authId)) throw unavailable();
  if (user.id !== authId && isAuthId(user.id) && await authExists(user.id)) throw unavailable();

  // No email reconciliation and no inference from writable FamilyLink.status.
  // Managed aliases remain disabled until a separately verified guardian-ingestion
  // capability exists. Legacy id-bound Auth users still count as independent users.
  const select = 'id, authUserId, deletedAt';
  const bound = await admin.from('User').select(select).eq('authUserId', authId);
  if (bound.error) throw bound.error;
  const legacy = await admin.from('User').select(select).eq('id', authId);
  if (legacy.error) throw legacy.error;
  const identities = new Map([...bound.data ?? [], ...legacy.data ?? []].map((row) => [row.id, row]));
  const identity = identities.get(user.id);
  if (identities.size !== 1 || !identity || identity.deletedAt != null
    || (identity.authUserId != null && identity.authUserId !== authId)) throw unavailable();

  const { data: consent, error } = await admin.from('UserConsent').select('acceptedAt')
    .eq('userId', user.id)
    .eq('consentVersion', '2026-07-10')
    .eq('privacyPolicyVersion', '2026-07-10')
    .eq('eulaType', 'apple_standard')
    .eq('healthDataProcessingAccepted', true)
    .maybeSingle();
  if (error) throw error;
  if (!consent?.acceptedAt || !Number.isFinite(Date.parse(consent.acceptedAt))) {
    throw new HttpError(403, 'Current health-data processing consent is required before email forwarding.');
  }
}

async function uploadAttachment(
  admin: SupabaseClient,
  user: AppUser,
  email: Pick<ParsedInboundEmail, 'from' | 'subject'>,
  attachment: EmailAttachment,
): Promise<{ documentId: string; fileKey: string; created: boolean; shouldQueue: boolean }> {
  const notes = notesForAttachment(email, attachment.filename);
  const documentName = documentNameForAttachment(email, attachment.filename);
  const emailIngestKey = await emailIngestKeyForAttachment(attachment);

  const { data: existing, error: existingError } = await admin
    .from('Document')
    .select('id, fileUrl, ocrStatus, ocrQueuedAt, ocrStartedAt')
    .eq('ownerUserId', user.id)
    .eq('emailIngestKey', emailIngestKey)
    .is('deletedAt', null)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const document = existing as ExistingDocument;
    const shouldRetry = shouldRetryExistingDocument(document);
    if (shouldRetry) await requeueDocument(admin, document.id, user.id);

    return {
      documentId: document.id,
      fileKey: document.fileUrl ?? '',
      created: false,
      shouldQueue: shouldRetry,
    };
  }

  const { data: legacyMatches, error: legacyError } = await admin
    .from('Document')
    .select('id, fileUrl, ocrStatus, ocrQueuedAt, ocrStartedAt')
    .eq('ownerUserId', user.id)
    .eq('labName', documentName)
    .eq('notes', notes)
    .is('deletedAt', null)
    .order('createdAt', { ascending: false })
    .limit(1);
  if (legacyError) throw legacyError;

  const legacy = legacyMatches?.[0] as ExistingDocument | undefined;
  if (legacy) {
    await rememberEmailIngestKey(admin, legacy.id, emailIngestKey, user.id);
    const shouldRetry = shouldRetryExistingDocument(legacy);
    if (shouldRetry) await requeueDocument(admin, legacy.id, user.id);

    return {
      documentId: legacy.id,
      fileKey: legacy.fileUrl ?? '',
      created: false,
      shouldQueue: shouldRetry,
    };
  }

  const documentId = crypto.randomUUID();
  const sourceOwner = user.authUserId ?? user.id;
  const fileKey = `${sourceOwner}/email/${documentId}/attachment.${fileExt(
    attachment.contentType,
  )}`;

  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_BUCKET)
    .upload(fileKey, attachment.bytes, {
      contentType: attachment.contentType,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { error: insertError } = await admin.from('Document').insert({
    id: documentId,
    ownerUserId: user.id,
    uploadedByUserId: user.id,
    emailIngestKey,
    fileUrl: fileKey,
    fileType: attachment.contentType,
    docType: 'other',
    labName: documentName,
    sourceDate: new Date().toISOString(),
    notes,
    ocrStatus: 'queued',
    ocrProgress: 5,
    ocrStage: 'queued',
    ocrQueuedAt: new Date().toISOString(),
  });
  if (insertError) {
    await admin.storage.from(DOCUMENT_BUCKET).remove([fileKey]);

    if (insertError.code === '23505') {
      const { data: duplicate, error: duplicateError } = await admin
        .from('Document')
        .select('id, fileUrl, ocrStatus, ocrQueuedAt, ocrStartedAt')
        .eq('ownerUserId', user.id)
        .eq('emailIngestKey', emailIngestKey)
        .is('deletedAt', null)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) {
        const document = duplicate as ExistingDocument;
        const shouldRetry = shouldRetryExistingDocument(document);
        if (shouldRetry) await requeueDocument(admin, document.id, user.id);
        return {
          documentId: document.id,
          fileKey: document.fileUrl ?? '',
          created: false,
          shouldQueue: shouldRetry,
        };
      }
    }

    throw insertError;
  }

  return { documentId, fileKey, created: true, shouldQueue: true };
}

async function queueOcr(documentIds: string[], appUserId: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !INTERNAL_FUNCTION_SECRET) {
    throw new HttpError(500, 'Internal OCR queue configuration is missing');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-document-ocr`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'x-healthfolio-internal-secret': INTERNAL_FUNCTION_SECRET,
    },
    body: JSON.stringify({ documentIds, appUserId, wait: false }),
  });

  if (!response.ok) {
    throw new HttpError(502, 'Could not queue OCR for forwarded email. Please try again.');
  }

  const payload = (await response.json()) as {
    documents?: Array<{ documentId?: string; status?: string; error?: string }>;
  };
  const results = Array.isArray(payload.documents) ? payload.documents : [];
  const failed = results.filter((result) => result.status === 'failed');
  if (failed.length > 0) {
    throw new HttpError(502, 'OCR failed for one or more forwarded-email attachments. Please try again.');
  }

  const returnedIds = new Set(results.map((result) => result.documentId).filter(Boolean));
  if (documentIds.some((documentId) => !returnedIds.has(documentId))) {
    throw new HttpError(502, 'OCR returned an incomplete forwarded-email result');
  }
}

async function markOcrQueueFailed(
  admin: SupabaseClient,
  documentIds: string[],
  ownerUserId: string,
): Promise<void> {
  if (documentIds.length === 0) return;
  await admin
    .from('Document')
    .update({
      ocrStatus: 'failed',
      ocrProgress: 100,
      ocrStage: 'failed',
      ocrError: 'Email OCR did not start. Please resend this file.',
      ocrCompletedAt: new Date().toISOString(),
    })
    .in('id', documentIds)
    .eq('ownerUserId', ownerUserId)
    .is('deletedAt', null)
    // A batched OCR response can contain both successes and failures. Never
    // overwrite a document that already reached a terminal success state.
    .neq('ocrStatus', 'ready_for_review');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    verifyWebhookSecret(req);
    const admin = getAdminClient();
    const parsed = await parseInboundEmail(req);
    const user = await resolveRecipientUser(admin, parsed.recipients);

    if (parsed.attachments.length === 0) {
      return jsonResponse({ status: 'ignored', reason: 'No supported attachments found' }, 202);
    }
    await assertIndependentRecipient(admin, user);

    const uploaded = [];
    for (const attachment of parsed.attachments) {
      uploaded.push(await uploadAttachment(admin, user, parsed, attachment));
    }

    const queueableDocumentIds = uploaded
      .filter((item) => item.shouldQueue)
      .map((item) => item.documentId);
    if (queueableDocumentIds.length > 0) {
      try {
        await queueOcr(queueableDocumentIds, user.id);
      } catch (error) {
        await markOcrQueueFailed(admin, queueableDocumentIds, user.id);
        throw error;
      }
    }

    return jsonResponse(
      {
        status: queueableDocumentIds.length > 0 ? 'processed' : 'duplicate',
        documents: uploaded.map((item) => ({
          documentId: item.documentId,
          fileKey: item.fileKey,
          created: item.created,
        })),
      },
      202,
    );
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
    // Provider/database errors can contain health data or credentials.
    console.error('Inbound email ingestion failed');
    return jsonResponse({ error: 'Email forwarding is temporarily unavailable.' }, 500);
  }
});
