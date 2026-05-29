import type { AuthTokens } from './auth.js';
import type { Document, DocType, OcrStatus } from './document.js';
import type { FamilyLink } from './family.js';
import type { ParameterReading, RangeFlag } from './parameter.js';
import type { HealthProfile, User } from './user.js';

/**
 * Request/response DTOs for API endpoints. One type per endpoint; this file
 * grows phase-by-phase as endpoints are implemented. Phase 0 covers the
 * health check and the auth/profile contract shapes that Phase 1 will fill in.
 */

// --- Health (Phase 0) ---
export type ServiceStatus = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: ServiceStatus;
  redis: ServiceStatus;
}

// --- Auth (Phase 1) ---
export interface OtpRequestResponse {
  ok: true;
  expiresIn: number;
}

export interface OtpVerifyResponse extends AuthTokens {
  user: User;
  isNewUser: boolean;
}

export type RefreshResponse = AuthTokens;

// --- Profile (Phase 1) ---
export interface MeResponse {
  user: User;
  healthProfile: HealthProfile | null;
}

/** Generic paginated envelope used by list endpoints. */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

// --- Documents (Phase 2) ---
export interface CreateDocumentResponse {
  documentId: string;
  uploadUrl: string;
  fileKey: string;
}

export interface CreateDocumentBatchResponse {
  documents: CreateDocumentResponse[];
}

export interface DocumentSummary {
  id: string;
  docType: DocType;
  sourceDate: string;
  labName: string | null;
  ocrStatus: OcrStatus;
  ocrProgress: number;
  ocrStage: string | null;
  createdAt: string;
}

export interface DocumentDetail {
  document: Document;
  readings: ParameterReading[];
}

// --- Readings (Phase 3) ---

export interface TrendPoint {
  readingId: string;
  documentId: string | null;
  value: number;
  unit: string;
  recordedAt: string;
  rangeFlag: RangeFlag;
  isUserVerified: boolean;
  confidenceScore: number;
  sourceDocument: {
    id: string;
    docType: DocType;
    sourceDate: string;
    labName: string | null;
  } | null;
}

export interface TrendResponse {
  parameterId: string;
  canonicalName: string;
  unit: string;
  /** Human-readable range label, e.g. "13.5–17.5" or "< 200", for the user's sex/age. */
  rangeLabel: string;
  data: TrendPoint[];
}

// --- Doctor Share (Phase 5) ---

export interface CreateShareResponse {
  share: import('./share.js').DoctorShare;
  shareUrl: string;
}

// --- Family (Phase 4) ---

export interface FamilyMemberView {
  link: FamilyLink;
  memberName: string;
  memberEmail: string | null;
  memberPhone: string | null;
}

export interface FamilyMembershipView {
  link: FamilyLink;
  ownerName: string;
  ownerEmail: string | null;
}

export interface CreateInviteResponse {
  link: FamilyLink;
  inviteToken: string;
}
