import type {
  BloodGroup,
  BoundingBox,
  DocType,
  Document as DocumentDto,
  HealthProfile as HealthProfileDto,
  OcrStatus,
  ParameterReading as ParameterReadingDto,
  RangeFlag,
  ReadingStatus,
  ResidencyRegion,
  Sex,
  UnitsPreference,
  User as UserDto,
} from '@medical-tracker/shared-types';
import type { Document, HealthProfile, ParameterReading, User } from '@prisma/client';

/** Map a Prisma User row to the shared-types User DTO (Dates -> ISO strings). */
export function mapUser(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    dob: user.dob.toISOString(),
    sex: user.sex as Sex,
    unitsPreference: user.unitsPreference as UnitsPreference,
    bloodGroup: (user.bloodGroup as BloodGroup | null) ?? null,
    residencyRegion: user.residencyRegion as ResidencyRegion,
    createdAt: user.createdAt.toISOString(),
    deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
  };
}

export function mapHealthProfile(profile: HealthProfile): HealthProfileDto {
  return {
    userId: profile.userId,
    height: profile.height,
    weight: profile.weight,
    knownConditions: profile.knownConditions,
    allergies: profile.allergies,
    currentMedications: profile.currentMedications,
  };
}

export function mapDocument(doc: Document): DocumentDto {
  return {
    id: doc.id,
    ownerUserId: doc.ownerUserId,
    uploadedByUserId: doc.uploadedByUserId,
    fileUrl: doc.fileUrl,
    fileType: doc.fileType,
    docType: doc.docType as DocType,
    sourceDate: doc.sourceDate.toISOString(),
    labName: doc.labName,
    orderingPhysician: doc.orderingPhysician,
    notes: doc.notes,
    ocrStatus: doc.ocrStatus as OcrStatus,
    ocrAttempts: doc.ocrAttempts,
    createdAt: doc.createdAt.toISOString(),
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
  };
}

export function mapReading(r: ParameterReading): ParameterReadingDto {
  return {
    id: r.id,
    userId: r.userId,
    documentId: r.documentId,
    parameterId: r.parameterId,
    value: Number(r.value),
    unit: r.unit,
    recordedAt: r.recordedAt.toISOString(),
    status: r.status as ReadingStatus,
    isUserVerified: r.isUserVerified,
    confidenceScore: r.confidenceScore,
    rangeFlag: r.rangeFlag as RangeFlag,
    sourceRegion: (r.sourceRegion as BoundingBox | null) ?? null,
    createdByUserId: r.createdByUserId,
    lastEditedAt: r.lastEditedAt ? r.lastEditedAt.toISOString() : null,
  };
}
