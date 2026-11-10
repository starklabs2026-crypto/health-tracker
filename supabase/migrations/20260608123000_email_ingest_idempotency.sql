-- Prevent repeated Gmail/Apps Script runs from creating duplicate forwarded-email documents.

ALTER TABLE "Document"
ADD COLUMN IF NOT EXISTS "emailIngestKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Document_ownerUserId_emailIngestKey_key"
ON "Document"("ownerUserId", "emailIngestKey")
WHERE "emailIngestKey" IS NOT NULL;
