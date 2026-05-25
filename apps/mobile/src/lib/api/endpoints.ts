import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  CreateReadingRequest,
  DevicePlatform,
  DocumentDetail,
  DocumentSummary,
  DocType,
  MeResponse,
  OtpRequestResponse,
  OtpVerifyResponse,
  Paginated,
  ParameterReading,
  PatchDocumentRequest,
  PatchReadingRequest,
  TrendResponse,
  UpdateHealthProfileRequest,
  UpdateMeRequest,
} from '@medical-tracker/shared-types';
import axios from 'axios';

import { api } from './client';

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

export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/me');
  return data;
}

export async function updateMe(body: UpdateMeRequest): Promise<MeResponse> {
  const { data } = await api.put<MeResponse>('/me', body);
  return data;
}

export async function updateHealthProfile(body: UpdateHealthProfileRequest): Promise<MeResponse> {
  const { data } = await api.put<MeResponse>('/me/health-profile', body);
  return data;
}

export async function pairBiometric(): Promise<void> {
  await api.post('/auth/biometric/pair');
}

// --- Documents (Phase 2) ---

export async function createDocument(
  body: CreateDocumentRequest,
): Promise<CreateDocumentResponse> {
  const { data } = await api.post<CreateDocumentResponse>('/documents', body);
  return data;
}

/** Upload the actual file bytes to the presigned URL returned by createDocument. */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: { uri: string; mimeType: string },
): Promise<void> {
  const form = new FormData();
  form.append('file', { uri: file.uri, type: file.mimeType, name: 'upload' } as unknown as Blob);
  // Use bare axios — presigned URL is token-gated, no Bearer needed
  await axios.post(uploadUrl, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  });
}

export async function markUploaded(
  documentId: string,
  fileKey: string,
): Promise<void> {
  await api.post(`/documents/${documentId}/mark-uploaded`, { fileKey });
}

export async function listDocuments(params: {
  docType?: DocType;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<DocumentSummary>> {
  const { data } = await api.get<Paginated<DocumentSummary>>('/documents', { params });
  return data;
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const { data } = await api.get<DocumentDetail>(`/documents/${id}`);
  return data;
}

export async function patchDocument(
  id: string,
  body: PatchDocumentRequest,
): Promise<DocumentDetail> {
  const { data } = await api.patch<DocumentDetail>(`/documents/${id}`, body);
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`);
}

export async function getDownloadUrl(
  id: string,
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const { data } = await api.get<{ downloadUrl: string; expiresAt: string }>(
    `/documents/${id}/download-url`,
  );
  return data;
}

// --- Readings (Phase 3) ---

export async function listReadings(params: {
  parameterId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<ParameterReading>> {
  const { data } = await api.get<Paginated<ParameterReading>>('/readings', { params });
  return data;
}

export async function createReading(body: CreateReadingRequest): Promise<ParameterReading> {
  const { data } = await api.post<ParameterReading>('/readings', body);
  return data;
}

export async function getTrend(
  parameterId: string,
  opts?: { dateFrom?: string; dateTo?: string },
): Promise<TrendResponse> {
  const { data } = await api.get<TrendResponse>('/readings/trend', {
    params: { parameterId, ...opts },
  });
  return data;
}

export async function patchReading(
  id: string,
  body: PatchReadingRequest,
): Promise<ParameterReading> {
  const { data } = await api.patch<ParameterReading>(`/readings/${id}`, body);
  return data;
}

export async function deleteReading(id: string): Promise<void> {
  await api.delete(`/readings/${id}`);
}
