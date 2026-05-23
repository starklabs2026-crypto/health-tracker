import { z } from 'zod';

/** Biological sex — drives sex-specific reference ranges in the catalog. */
export enum Sex {
  Male = 'male',
  Female = 'female',
  Other = 'other',
}

/** Units preference for display (metric vs imperial). */
export enum UnitsPreference {
  Metric = 'metric',
  Imperial = 'imperial',
}

export enum BloodGroup {
  APos = 'A+',
  ANeg = 'A-',
  BPos = 'B+',
  BNeg = 'B-',
  ABPos = 'AB+',
  ABNeg = 'AB-',
  OPos = 'O+',
  ONeg = 'O-',
}

/** Data-residency region set at signup (PRD §9.6). */
export enum ResidencyRegion {
  EU = 'EU',
  US = 'US',
  IN = 'IN',
}

export const sexSchema = z.nativeEnum(Sex);
export const unitsPreferenceSchema = z.nativeEnum(UnitsPreference);
export const bloodGroupSchema = z.nativeEnum(BloodGroup);
export const residencyRegionSchema = z.nativeEnum(ResidencyRegion);

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  dob: string; // ISO date
  sex: Sex;
  unitsPreference: UnitsPreference;
  bloodGroup: BloodGroup | null;
  residencyRegion: ResidencyRegion;
  createdAt: string;
  deletedAt: string | null;
}

export interface HealthProfile {
  userId: string;
  height: number | null; // cm
  weight: number | null; // kg
  knownConditions: string[];
  allergies: string[];
  currentMedications: string[];
}
