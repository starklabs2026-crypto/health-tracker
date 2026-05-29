import { computeRangeFlag, findById, formatRange } from '@medical-tracker/parameter-catalog';
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  CreateReadingRequest,
  CreateShareRequest,
  CreateShareResponse,
  DevicePlatform,
  Document,
  DocumentDetail,
  DocumentSummary,
  DocType,
  DoctorShare,
  FamilyLink,
  FamilyMembershipView,
  FamilyMemberView,
  HealthProfile,
  MeResponse,
  OtpRequestResponse,
  OtpVerifyResponse,
  Paginated,
  ParameterReading,
  PatchDocumentRequest,
  PatchFamilyLinkRequest,
  PatchReadingRequest,
  TrendResponse,
  UpdateHealthProfileRequest,
  UpdateMeRequest,
  User,
} from '@medical-tracker/shared-types';
import {
  FamilyLinkStatus,
  RangeFlag,
  ReadingStatus,
  ResidencyRegion,
  Sex,
  UnitsPreference,
} from '@medical-tracker/shared-types';
import axios from 'axios';
import { File as ExpoFile } from 'expo-file-system';

import { supabase } from '../supabase/client';
import { api } from './client';

const DOCUMENT_BUCKET = 'medical-documents';

type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
};

type UserRow = User & {
  authUserId?: string | null;
};

type HealthProfileRow = HealthProfile & {
  id?: string;
  updatedAt?: string;
};

type DocumentRow = Document & {
  ocrModel?: string | null;
  ocrError?: string | null;
};

type FamilyLinkRow = FamilyLink & {
  inviteToken?: string | null;
};

type FamilyMemberJoinRow = FamilyLinkRow & {
  member?:
    | Pick<User, 'id' | 'name' | 'email' | 'phone'>
    | Array<Pick<User, 'id' | 'name' | 'email' | 'phone'>>
    | null;
};

type FamilyOwnerJoinRow = FamilyLinkRow & {
  owner?: Pick<User, 'id' | 'name' | 'email'> | Array<Pick<User, 'id' | 'name' | 'email'>> | null;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email ?? null,
    phone: row.phone ?? null,
    name: row.name ?? '',
    dob: row.dob,
    sex: row.sex,
    unitsPreference: row.unitsPreference,
    bloodGroup: row.bloodGroup ?? null,
    residencyRegion: row.residencyRegion,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt ?? null,
  };
}

function mapHealthProfile(row: HealthProfileRow | null): HealthProfile | null {
  if (!row) return null;
  return {
    userId: row.userId,
    height: row.height ?? null,
    weight: row.weight ?? null,
    knownConditions: row.knownConditions ?? [],
    allergies: row.allergies ?? [],
    currentMedications: row.currentMedications ?? [],
  };
}

function mapDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    uploadedByUserId: row.uploadedByUserId,
    fileUrl: row.fileUrl ?? null,
    fileType: row.fileType,
    docType: row.docType,
    sourceDate: row.sourceDate,
    labName: row.labName ?? null,
    orderingPhysician: row.orderingPhysician ?? null,
    notes: row.notes ?? null,
    ocrStatus: row.ocrStatus,
    ocrAttempts: row.ocrAttempts ?? 0,
    ocrProgress: row.ocrProgress ?? 0,
    ocrStage: row.ocrStage ?? null,
    ocrQueuedAt: row.ocrQueuedAt ?? null,
    ocrStartedAt: row.ocrStartedAt ?? null,
    ocrCompletedAt: row.ocrCompletedAt ?? null,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt ?? null,
  };
}

function mapDocumentSummary(row: DocumentSummary): DocumentSummary {
  return {
    id: row.id,
    docType: row.docType,
    sourceDate: row.sourceDate,
    labName: row.labName ?? null,
    ocrStatus: row.ocrStatus,
    ocrProgress: row.ocrProgress ?? 0,
    ocrStage: row.ocrStage ?? null,
    createdAt: row.createdAt,
  };
}

function mapReading(row: ParameterReading): ParameterReading {
  return {
    id: row.id,
    userId: row.userId,
    documentId: row.documentId ?? null,
    parameterId: row.parameterId,
    value: Number(row.value),
    unit: row.unit,
    recordedAt: row.recordedAt,
    status: row.status,
    isUserVerified: row.isUserVerified,
    confidenceScore: row.confidenceScore,
    rangeFlag: row.rangeFlag,
    sourceRegion: row.sourceRegion ?? null,
    createdByUserId: row.createdByUserId,
    lastEditedAt: row.lastEditedAt ?? null,
  };
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapFamilyLink(row: FamilyLinkRow): FamilyLink {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    memberUserId: row.memberUserId,
    role: row.role,
    permissions: row.permissions,
    status: row.status,
    invitedAt: row.invitedAt,
    acceptedAt: row.acceptedAt ?? null,
    revokedAt: row.revokedAt ?? null,
  };
}

async function requireAuthUser(): Promise<AuthUser> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not signed in');
  return data.user as AuthUser;
}

async function findAppUser(authUser = undefined as AuthUser | undefined): Promise<UserRow | null> {
  const current = authUser ?? (await requireAuthUser());

  let res = await supabase.from('User').select('*').eq('authUserId', current.id).maybeSingle();
  if (res.error) throw res.error;
  if (res.data) return res.data as UserRow;

  res = await supabase.from('User').select('*').eq('id', current.id).maybeSingle();
  if (res.error) throw res.error;
  if (res.data) return res.data as UserRow;

  if (current.email) {
    res = await supabase.from('User').select('*').eq('email', current.email).maybeSingle();
    if (res.error) throw res.error;
    if (res.data) {
      const row = res.data as UserRow;
      if (!row.authUserId) {
        const update = await supabase
          .from('User')
          .update({ authUserId: current.id })
          .eq('id', row.id);
        if (update.error) throw update.error;
      }
      return { ...row, authUserId: current.id };
    }
  }

  return null;
}

async function requireAppUser(): Promise<UserRow> {
  const row = await findAppUser();
  if (!row) throw new Error('HealthFolio profile not found');
  return row;
}

function ageYears(dob: string): number | undefined {
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return undefined;
  return Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function rangeContext(user: UserRow): { sex?: 'male' | 'female'; ageYears?: number } {
  return {
    sex: user.sex === Sex.Male || user.sex === Sex.Female ? user.sex : undefined,
    ageYears: ageYears(user.dob),
  };
}

function readingFlag(parameterId: string, value: number, user: UserRow): RangeFlag {
  const entry = findById(parameterId);
  if (!entry) return RangeFlag.Unknown;
  return computeRangeFlag(value, entry, rangeContext(user));
}

function fileExt(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('pdf')) return 'pdf';
  if (lower.includes('png')) return 'png';
  return 'jpg';
}

function parseStorageUrl(uploadUrl: string): { bucket: string; path: string } {
  if (!uploadUrl.startsWith('storage://')) {
    throw new Error('Not a Supabase storage URL');
  }
  const rest = uploadUrl.slice('storage://'.length);
  const slash = rest.indexOf('/');
  if (slash < 1) throw new Error('Invalid Supabase storage URL');
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

async function functionErrorMessage(error: unknown): Promise<string> {
  const fallback =
    error instanceof Error ? error.message : 'Document review failed. Please try again.';
  const context = (error as { context?: Response | null })?.context;
  if (!context) return fallback;

  try {
    const body = (await context.clone().json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
  } catch {
    // Fall through to text parsing below.
  }

  try {
    const text = await context.clone().text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

// --- Legacy OTP endpoints. Kept temporarily while Supabase Auth replaces this flow. ---

export async function requestOtp(identifier: string): Promise<OtpRequestResponse> {
  const { data } = await api.post<OtpRequestResponse>('/auth/otp/request', { identifier });
  return data;
}

export async function verifyOtp(input: {
  identifier: string;
  code: string;
  deviceId: string;
  platform: DevicePlatform;
}): Promise<OtpVerifyResponse> {
  const { data } = await api.post<OtpVerifyResponse>('/auth/otp/verify', input);
  return data;
}

// --- Profile ---

export async function getMe(): Promise<MeResponse> {
  const user = await requireAppUser();
  const { data, error } = await supabase
    .from('HealthProfile')
    .select('*')
    .eq('userId', user.id)
    .maybeSingle();
  if (error) throw error;
  return { user: mapUser(user), healthProfile: mapHealthProfile(data as HealthProfileRow | null) };
}

export async function updateMe(body: UpdateMeRequest): Promise<MeResponse> {
  const authUser = await requireAuthUser();
  const { error: rpcError } = await supabase.rpc('upsert_app_user_profile', {
    p_name: body.name ?? null,
    p_dob: body.dob ?? null,
    p_sex: body.sex ?? null,
    p_units_preference: body.unitsPreference ?? null,
    p_blood_group: body.bloodGroup ?? null,
    p_has_blood_group: body.bloodGroup !== undefined,
  });

  if (rpcError) {
    const existing = await findAppUser(authUser);

    if (existing) {
      const patch = {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.dob !== undefined ? { dob: body.dob } : {}),
        ...(body.sex !== undefined ? { sex: body.sex } : {}),
        ...(body.unitsPreference !== undefined ? { unitsPreference: body.unitsPreference } : {}),
        ...(body.bloodGroup !== undefined ? { bloodGroup: body.bloodGroup } : {}),
        authUserId: authUser.id,
      };
      const { error } = await supabase.from('User').update(patch).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('User').insert({
        id: authUser.id,
        authUserId: authUser.id,
        email: authUser.email ?? null,
        phone: authUser.phone ?? null,
        name: body.name ?? '',
        dob: body.dob ?? new Date(0).toISOString(),
        sex: body.sex ?? Sex.Other,
        unitsPreference: body.unitsPreference ?? UnitsPreference.Metric,
        bloodGroup: body.bloodGroup ?? null,
        residencyRegion: ResidencyRegion.US,
      });
      if (error) throw error;
    }
  }

  return getMe();
}

export async function updateHealthProfile(body: UpdateHealthProfileRequest): Promise<MeResponse> {
  const user = await requireAppUser();
  const { error } = await supabase.from('HealthProfile').upsert(
    {
      userId: user.id,
      height: body.height ?? null,
      weight: body.weight ?? null,
      knownConditions: body.knownConditions ?? [],
      allergies: body.allergies ?? [],
      currentMedications: body.currentMedications ?? [],
      updatedAt: new Date().toISOString(),
    },
    { onConflict: 'userId' },
  );
  if (error) throw error;
  return getMe();
}

export async function pairBiometric(): Promise<void> {
  // Biometric state is enforced locally in the MVP. Device-row sync can be added later.
}

// --- Documents ---

export async function createDocument(body: CreateDocumentRequest): Promise<CreateDocumentResponse> {
  const authUser = await requireAuthUser();
  const appUser = await requireAppUser();
  const ownerUserId = body.ownerProfileId ?? appUser.id;

  const { data, error } = await supabase
    .from('Document')
    .insert({
      ownerUserId,
      uploadedByUserId: appUser.id,
      fileType: body.fileType,
      docType: body.docType,
      sourceDate: body.sourceDate ?? new Date().toISOString(),
      labName: body.labName ?? null,
      orderingPhysician: body.orderingPhysician ?? null,
      notes: body.notes ?? null,
      ocrStatus: 'pending_upload',
      ocrProgress: 0,
      ocrStage: 'awaiting_upload',
    })
    .select('id')
    .single();
  if (error) throw error;

  const documentId = (data as { id: string }).id;
  const fileKey = `${authUser.id}/documents/${documentId}/report.${fileExt(body.fileType)}`;
  return {
    documentId,
    fileKey,
    uploadUrl: `storage://${DOCUMENT_BUCKET}/${fileKey}`,
  };
}

/** Upload the actual file bytes to Supabase Storage, or legacy presigned URL. */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: { uri: string; mimeType: string },
): Promise<void> {
  if (!uploadUrl.startsWith('storage://')) {
    const form = new FormData();
    form.append('file', { uri: file.uri, type: file.mimeType, name: 'upload' } as unknown as Blob);
    await axios.post(uploadUrl, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    return;
  }

  const { bucket, path } = parseStorageUrl(uploadUrl);
  const localFile = new ExpoFile(file.uri);
  const bytes = await localFile.bytes();
  if (bytes.byteLength === 0) {
    throw new Error('The selected file was empty. Please choose the original PDF or image again.');
  }
  const fileBody = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const { error } = await supabase.storage.from(bucket).upload(path, fileBody, {
    contentType: file.mimeType,
    upsert: true,
  });
  if (error) throw error;
}

export async function markUploaded(documentId: string, fileKey: string): Promise<void> {
  const { error } = await supabase
    .from('Document')
    .update({
      fileUrl: fileKey,
      ocrStatus: 'queued',
      ocrProgress: 5,
      ocrStage: 'queued',
      ocrQueuedAt: new Date().toISOString(),
      ocrStartedAt: null,
      ocrCompletedAt: null,
      ocrError: null,
    })
    .eq('id', documentId);
  if (error) throw error;

  const result = await supabase.functions.invoke('process-document-ocr', {
    body: { documentId },
  });
  if (result.error) throw new Error(await functionErrorMessage(result.error));
}

export async function listDocuments(params: {
  docType?: DocType;
  dateFrom?: string;
  dateTo?: string;
  profileId?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<DocumentSummary>> {
  const appUser = await requireAppUser();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(200, params.limit ?? 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('Document')
    .select('id, docType, sourceDate, labName, ocrStatus, ocrProgress, ocrStage, createdAt', {
      count: 'exact',
    })
    .eq('ownerUserId', params.profileId ?? appUser.id)
    .is('deletedAt', null)
    .order('sourceDate', { ascending: false })
    .range(from, to);

  if (params.docType) query = query.eq('docType', params.docType);
  if (params.dateFrom) query = query.gte('sourceDate', params.dateFrom);
  if (params.dateTo) query = query.lte('sourceDate', params.dateTo);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    items: ((data ?? []) as DocumentSummary[]).map(mapDocumentSummary),
    page,
    limit,
    total: count ?? data?.length ?? 0,
  };
}

export async function listDocumentsByIds(ids: string[]): Promise<DocumentSummary[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('Document')
    .select('id, docType, sourceDate, labName, ocrStatus, ocrProgress, ocrStage, createdAt')
    .in('id', ids)
    .is('deletedAt', null);
  if (error) throw error;

  return ((data ?? []) as DocumentSummary[]).map(mapDocumentSummary);
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const { data: doc, error: docError } = await supabase
    .from('Document')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (docError) throw docError;
  if (!doc) throw new Error('Document not found');

  const { data: readings, error: readingsError } = await supabase
    .from('ParameterReading')
    .select('*')
    .eq('documentId', id)
    .order('createdAt', { ascending: true });
  if (readingsError) throw readingsError;

  return {
    document: mapDocument(doc as DocumentRow),
    readings: ((readings ?? []) as ParameterReading[]).map(mapReading),
  };
}

export async function patchDocument(
  id: string,
  body: PatchDocumentRequest,
): Promise<DocumentDetail> {
  const { error } = await supabase.from('Document').update(body).eq('id', id);
  if (error) throw error;
  return getDocument(id);
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('Document')
    .update({ deletedAt: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function getDownloadUrl(
  id: string,
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const { data: doc, error } = await supabase
    .from('Document')
    .select('fileUrl')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  const fileUrl = (doc as { fileUrl?: string | null } | null)?.fileUrl;
  if (!fileUrl) throw new Error('Document file is missing');

  const { bucket, path } = fileUrl.startsWith('storage://')
    ? parseStorageUrl(fileUrl)
    : { bucket: DOCUMENT_BUCKET, path: fileUrl };
  const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 5);
  if (signed.error) throw signed.error;
  return {
    downloadUrl: signed.data.signedUrl,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
}

// --- Readings ---

export async function listReadings(params: {
  parameterId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  profileId?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<ParameterReading>> {
  const appUser = await requireAppUser();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(200, params.limit ?? 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('ParameterReading')
    .select('*', { count: 'exact' })
    .eq('userId', params.profileId ?? appUser.id)
    .order('recordedAt', { ascending: false })
    .range(from, to);

  if (params.parameterId) query = query.eq('parameterId', params.parameterId);
  if (params.status) query = query.eq('status', params.status);
  if (params.dateFrom) query = query.gte('recordedAt', params.dateFrom);
  if (params.dateTo) query = query.lte('recordedAt', params.dateTo);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    items: ((data ?? []) as ParameterReading[]).map(mapReading),
    page,
    limit,
    total: count ?? data?.length ?? 0,
  };
}

export async function createReading(body: CreateReadingRequest): Promise<ParameterReading> {
  const appUser = await requireAppUser();
  const ownerUserId = body.ownerProfileId ?? appUser.id;
  const rangeFlag = readingFlag(body.parameterId, body.value, appUser);

  const { data, error } = await supabase
    .from('ParameterReading')
    .insert({
      userId: ownerUserId,
      documentId: null,
      parameterId: body.parameterId,
      value: body.value,
      unit: body.unit,
      recordedAt: body.recordedAt,
      status: ReadingStatus.Confirmed,
      isUserVerified: true,
      confidenceScore: 1,
      rangeFlag,
      createdByUserId: appUser.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapReading(data as ParameterReading);
}

export async function getTrend(
  parameterId: string,
  opts?: { dateFrom?: string; dateTo?: string; profileId?: string },
): Promise<TrendResponse> {
  const appUser = await requireAppUser();
  const entry = findById(parameterId);
  if (!entry) throw new Error('Unknown parameter');

  const readings = await listReadings({
    parameterId,
    dateFrom: opts?.dateFrom,
    dateTo: opts?.dateTo,
    profileId: opts?.profileId,
    limit: 100,
  });
  const documentIds = [
    ...new Set(
      readings.items.map((reading) => reading.documentId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const documentById = new Map<
    string,
    { id: string; docType: DocType; sourceDate: string; labName: string | null }
  >();

  if (documentIds.length > 0) {
    const { data: docs, error } = await supabase
      .from('Document')
      .select('id, docType, sourceDate, labName')
      .in('id', documentIds);
    if (error) throw error;
    for (const doc of docs ?? []) {
      const row = doc as {
        id: string;
        docType: DocType;
        sourceDate: string;
        labName: string | null;
      };
      documentById.set(row.id, {
        id: row.id,
        docType: row.docType,
        sourceDate: row.sourceDate,
        labName: row.labName ?? null,
      });
    }
  }

  const data = [...readings.items]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map((r) => ({
      readingId: r.id,
      documentId: r.documentId,
      value: r.value,
      unit: r.unit,
      recordedAt: r.recordedAt,
      rangeFlag: r.rangeFlag,
      isUserVerified: r.isUserVerified,
      confidenceScore: r.confidenceScore,
      sourceDocument: r.documentId ? (documentById.get(r.documentId) ?? null) : null,
    }));

  return {
    parameterId: entry.id,
    canonicalName: entry.canonicalName,
    unit: entry.unit,
    rangeLabel: formatRange(entry, rangeContext(appUser)),
    data,
  };
}

export async function patchReading(
  id: string,
  body: PatchReadingRequest,
): Promise<ParameterReading> {
  const appUser = await requireAppUser();
  const { data: existing, error: existingError } = await supabase
    .from('ParameterReading')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error('Reading not found');

  const current = existing as ParameterReading;
  const patch = {
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.isUserVerified !== undefined ? { isUserVerified: body.isUserVerified } : {}),
    ...(body.value !== undefined ? { value: body.value } : {}),
    ...(body.unit !== undefined ? { unit: body.unit } : {}),
    ...(body.value !== undefined
      ? { rangeFlag: readingFlag(current.parameterId, body.value, appUser) }
      : {}),
    lastEditedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('ParameterReading')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapReading(data as ParameterReading);
}

export async function deleteReading(id: string): Promise<void> {
  const { error } = await supabase.from('ParameterReading').delete().eq('id', id);
  if (error) throw error;
}

// --- Family ---

export async function createManagedProfile(body: {
  name: string;
  dob: string;
  sex: Sex;
  unitsPreference?: UnitsPreference;
}): Promise<{ profileId: string }> {
  const { data, error } = await supabase.rpc('create_managed_profile', {
    p_name: body.name,
    p_dob: body.dob,
    p_sex: body.sex,
    p_units_preference: body.unitsPreference ?? UnitsPreference.Metric,
    p_blood_group: null,
    p_residency_region: ResidencyRegion.US,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) {
    throw new Error('Managed profile creation did not return a profile id.');
  }
  return { profileId: data };
}

export async function listFamilyMembers(): Promise<FamilyMemberView[]> {
  const appUser = await requireAppUser();
  const { data, error } = await supabase
    .from('FamilyLink')
    .select(
      `
      id,
      ownerUserId,
      memberUserId,
      role,
      permissions,
      status,
      invitedAt,
      acceptedAt,
      revokedAt,
      member:User!FamilyLink_memberUserId_fkey(id, name, email, phone)
    `,
    )
    .eq('ownerUserId', appUser.id)
    .neq('memberUserId', appUser.id)
    .neq('status', FamilyLinkStatus.Revoked)
    .order('invitedAt', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as FamilyMemberJoinRow[]).map((row) => {
    const member = firstRelated(row.member);
    return {
      link: mapFamilyLink(row),
      memberName: member?.name ?? 'Unnamed profile',
      memberEmail: member?.email ?? null,
      memberPhone: member?.phone ?? null,
    };
  });
}

export async function listFamilyMemberships(): Promise<FamilyMembershipView[]> {
  const appUser = await requireAppUser();
  const { data, error } = await supabase
    .from('FamilyLink')
    .select(
      `
      id,
      ownerUserId,
      memberUserId,
      role,
      permissions,
      status,
      invitedAt,
      acceptedAt,
      revokedAt,
      owner:User!FamilyLink_ownerUserId_fkey(id, name, email)
    `,
    )
    .eq('memberUserId', appUser.id)
    .neq('ownerUserId', appUser.id)
    .eq('status', FamilyLinkStatus.Active)
    .order('invitedAt', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as FamilyOwnerJoinRow[]).map((row) => {
    const owner = firstRelated(row.owner);
    return {
      link: mapFamilyLink(row),
      ownerName: owner?.name ?? 'Unnamed owner',
      ownerEmail: owner?.email ?? null,
    };
  });
}

export async function patchFamilyLink(
  id: string,
  body: PatchFamilyLinkRequest,
): Promise<FamilyLink> {
  const { data, error } = await supabase
    .from('FamilyLink')
    .update(body)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapFamilyLink(data as FamilyLinkRow);
}

export async function revokeFamilyLink(id: string): Promise<void> {
  const { error } = await supabase
    .from('FamilyLink')
    .update({ status: FamilyLinkStatus.Revoked, revokedAt: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// --- Shares (still pending Supabase Edge Function migration) ---

export async function createShare(body: CreateShareRequest): Promise<CreateShareResponse> {
  const { data } = await api.post<CreateShareResponse>('/shares', body);
  return data;
}

export async function listShares(): Promise<DoctorShare[]> {
  const { data } = await api.get<DoctorShare[]>('/shares');
  return data;
}

export async function revokeShare(id: string): Promise<void> {
  await api.delete(`/shares/${id}`);
}

// --- Exports (still pending Supabase Edge Function migration) ---

export async function createPdfExportUrl(
  profileId?: string,
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const { data, error } = await supabase.functions.invoke('export-health-summary', {
    body: { ...(profileId ? { profileId } : {}) },
  });
  if (error) throw error;
  const payload = data as { downloadUrl?: string; expiresAt?: string } | null;
  if (!payload?.downloadUrl || !payload.expiresAt) {
    throw new Error('Export function did not return a download URL.');
  }
  return { downloadUrl: payload.downloadUrl, expiresAt: payload.expiresAt };
}

/** Returns the legacy full PDF download URL for opening in a browser/share sheet. */
export function getPdfExportUrl(profileId?: string): string {
  const base = api.defaults.baseURL ?? '';
  return profileId
    ? `${base}/exports/pdf?profileId=${encodeURIComponent(profileId)}`
    : `${base}/exports/pdf`;
}
