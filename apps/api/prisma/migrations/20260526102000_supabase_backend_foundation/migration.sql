-- Supabase backend foundation for HealthFolio.
-- Adds Supabase Auth mapping metadata plus OCR bookkeeping fields.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "authUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_authUserId_key" ON "User"("authUserId");

ALTER TABLE "Document"
ADD COLUMN IF NOT EXISTS "ocrModel" TEXT,
ADD COLUMN IF NOT EXISTS "ocrError" TEXT;
