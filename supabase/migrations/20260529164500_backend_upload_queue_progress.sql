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

CREATE OR REPLACE FUNCTION public.parameter_timeline(
  p_parameter_id text,
  p_profile_user_id text DEFAULT NULL,
  p_date_from timestamp(3) DEFAULT NULL,
  p_date_to timestamp(3) DEFAULT NULL
)
RETURNS TABLE (
  "readingId" text,
  "documentId" text,
  "value" double precision,
  "unit" text,
  "recordedAt" timestamp(3),
  "rangeFlag" text,
  "isUserVerified" boolean,
  "confidenceScore" double precision,
  "documentDocType" text,
  "documentSourceDate" timestamp(3),
  "documentLabName" text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    r.id AS "readingId",
    r."documentId" AS "documentId",
    r.value::double precision AS "value",
    r.unit AS "unit",
    r."recordedAt" AS "recordedAt",
    r."rangeFlag" AS "rangeFlag",
    r."isUserVerified" AS "isUserVerified",
    r."confidenceScore" AS "confidenceScore",
    d."docType" AS "documentDocType",
    d."sourceDate" AS "documentSourceDate",
    d."labName" AS "documentLabName"
  FROM "ParameterReading" r
  LEFT JOIN "Document" d ON d.id = r."documentId"
  WHERE r."userId" = COALESCE(p_profile_user_id, public.current_app_user_id())
    AND r."parameterId" = p_parameter_id
    AND (p_date_from IS NULL OR r."recordedAt" >= p_date_from)
    AND (p_date_to IS NULL OR r."recordedAt" <= p_date_to)
  ORDER BY r."recordedAt" ASC, r."createdAt" ASC
  LIMIT 500
$$;

GRANT EXECUTE ON FUNCTION public.parameter_timeline(text, text, timestamp, timestamp)
TO authenticated;
