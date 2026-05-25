import type {
  BloodGroup,
  HealthProfile as HealthProfileDto,
  ResidencyRegion,
  Sex,
  UnitsPreference,
  User as UserDto,
} from '@medical-tracker/shared-types';
import type { HealthProfile, User } from '@prisma/client';

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
