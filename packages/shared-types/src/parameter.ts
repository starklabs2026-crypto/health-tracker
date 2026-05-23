import { z } from 'zod';

/** Range classification for a single reading (PRD §7.3 stage 3). */
export enum RangeFlag {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Critical = 'critical',
  Unknown = 'unknown',
}

/** Review lifecycle of an extracted/manual reading. */
export enum ReadingStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Dismissed = 'dismissed',
}

export const rangeFlagSchema = z.nativeEnum(RangeFlag);
export const readingStatusSchema = z.nativeEnum(ReadingStatus);

/**
 * A numeric reference range. `min`/`max` are inclusive bounds; either may be
 * null for one-sided ranges (e.g. "< 200" => { min: null, max: 200 }).
 */
export interface NumericRange {
  min: number | null;
  max: number | null;
}

/**
 * Reference-range definition for a catalog parameter. Supports a default range
 * plus optional sex-specific overrides. Age-specific bands are modelled but
 * sparsely populated in the seed (the PRD only gives single adult values for
 * most age-variant parameters — see medical-tracker-build notes).
 */
export interface RangeDefinition {
  default: NumericRange | null;
  bySex?: Partial<Record<'male' | 'female', NumericRange>>;
  byAge?: Array<{ minAge: number; maxAge: number; range: NumericRange }>;
  /** For qualitative parameters (e.g. urine), the expected normal text value. */
  qualitativeNormal?: string;
}

export interface ParameterCatalogEntry {
  id: string;
  canonicalName: string;
  aliases: string[];
  unit: string;
  panel: string;
  rangeDefault: RangeDefinition;
  criticalLow: number | null;
  criticalHigh: number | null;
}

export interface ParameterReading {
  id: string;
  userId: string;
  documentId: string | null;
  parameterId: string;
  value: number;
  unit: string;
  recordedAt: string; // ISO date
  status: ReadingStatus;
  isUserVerified: boolean;
  confidenceScore: number;
  rangeFlag: RangeFlag;
  sourceRegion: BoundingBox | null;
  createdByUserId: string;
  lastEditedAt: string | null;
}

/** Pixel-space crop of a source document page where a value was extracted. */
export interface BoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
