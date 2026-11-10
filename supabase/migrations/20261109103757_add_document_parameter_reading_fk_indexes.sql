-- Mirror of the migration applied to the live HealthFolio project.
-- Cover the foreign keys that were missing a leading index.

CREATE INDEX IF NOT EXISTS "Document_uploadedByUserId_idx"
  ON public."Document" ("uploadedByUserId");

CREATE INDEX IF NOT EXISTS "ParameterReading_createdByUserId_idx"
  ON public."ParameterReading" ("createdByUserId");

CREATE INDEX IF NOT EXISTS "ParameterReading_documentId_idx"
  ON public."ParameterReading" ("documentId");

CREATE INDEX IF NOT EXISTS "ParameterReading_parameterId_idx"
  ON public."ParameterReading" ("parameterId");
