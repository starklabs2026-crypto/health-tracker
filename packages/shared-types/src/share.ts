import { z } from 'zod';

import { RangeFlag } from './parameter.js';

/** Allowed expiry windows for a doctor-share link (PRD §7.6). */
export enum ShareExpiry {
  OneHour = '1h',
  OneDay = '24h',
  OneWeek = '7d',
  OneMonth = '30d',
}

export const shareExpirySchema = z.nativeEnum(ShareExpiry);

export interface DoctorShare {
  id: string;
  ownerUserId: string;
  profileUserId: string;
  shareToken: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  parameterSet: string[]; // catalog parameter ids; empty => all
  includeDocuments: boolean;
  expiresAt: string;
  singleUse: boolean;
  revokedAt: string | null;
  customNote: string | null;
  createdAt: string;
}

export interface DoctorShareAccess {
  id: string;
  shareId: string;
  accessedAt: string;
  ipCity: string | null;
  ipCountry: string | null;
  userAgent: string | null;
}

/** Public, privacy-scoped payload rendered by the doctor-share web view. */
export interface PublicShareView {
  patient: {
    firstName: string;
    ageBand: string; // e.g. "38y"
    sex: string;
    bloodGroup: string | null;
  };
  parameters: Array<{
    canonical: string;
    unit: string;
    normalRange: string;
    readings: Array<{ date: string; value: number; rangeFlag: RangeFlag }>;
  }>;
  documents: Array<{ docType: string; sourceDate: string; downloadUrl: string }>;
  customNote: string | null;
}
