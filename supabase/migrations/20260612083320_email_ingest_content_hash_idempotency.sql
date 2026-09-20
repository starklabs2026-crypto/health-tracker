-- Keep forwarded-email ingestion idempotent for active documents while still allowing
-- a user to resend a file after they delete the previous copy.

ALTER TABLE "Document"
ADD COLUMN IF NOT EXISTS "emailIngestKey" TEXT;

DROP INDEX IF EXISTS "Document_ownerUserId_emailIngestKey_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Document_ownerUserId_emailIngestKey_active_key"
ON "Document"("ownerUserId", "emailIngestKey")
WHERE "emailIngestKey" IS NOT NULL AND "deletedAt" IS NULL;
