ALTER TABLE "Document"
ALTER COLUMN "sourceDate" SET DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "ocrProgress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ocrStage" TEXT,
ADD COLUMN IF NOT EXISTS "ocrQueuedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ocrStartedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ocrCompletedAt" TIMESTAMP(3);

UPDATE "Document"
SET
  "ocrProgress" = CASE
    WHEN "ocrStatus" = 'pending_upload' THEN 0
    WHEN "ocrStatus" = 'queued' THEN 5
    WHEN "ocrStatus" = 'processing' THEN 50
    WHEN "ocrStatus" = 'ready_for_review' THEN 100
    WHEN "ocrStatus" = 'failed' THEN 100
    ELSE "ocrProgress"
  END,
  "ocrStage" = COALESCE(
    "ocrStage",
    CASE
      WHEN "ocrStatus" = 'pending_upload' THEN 'awaiting_upload'
      WHEN "ocrStatus" = 'queued' THEN 'queued'
      WHEN "ocrStatus" = 'processing' THEN 'processing'
      WHEN "ocrStatus" = 'ready_for_review' THEN 'ready_for_review'
      WHEN "ocrStatus" = 'failed' THEN 'failed'
      ELSE NULL
    END
  );
