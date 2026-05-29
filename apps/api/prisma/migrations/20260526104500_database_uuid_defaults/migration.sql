-- Prisma's @default(uuid()) is generated client-side in the original migration.
-- Direct Supabase inserts need database-side defaults.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "HealthProfile" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "OtpCode" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Device" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "RefreshToken" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "FamilyLink" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Document" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "ParameterReading" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "DoctorShare" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "DoctorShareAccess" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "AuditLog" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Export" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

ALTER TABLE "HealthProfile" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
