-- Supabase backend foundation for HealthFolio.
-- This migration prepares the hosted project for Supabase Auth, Storage, RLS,
-- and Edge Functions while keeping the current Prisma-shaped public schema.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "authUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_authUserId_key" ON "User"("authUserId");

ALTER TABLE "Document"
ADD COLUMN IF NOT EXISTS "ocrModel" TEXT,
ADD COLUMN IF NOT EXISTS "ocrError" TEXT;

-- Private buckets used by the Supabase-backed MVP.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-documents',
  'medical-documents',
  false,
  26214400,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  26214400,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Helper: resolve the current app-level user id from Supabase Auth.
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM "User" u
  WHERE u."authUserId" = auth.uid()::text
     OR u.id = auth.uid()::text
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.increment_document_ocr_attempts(p_document_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE "Document"
  SET "ocrAttempts" = "ocrAttempts" + 1
  WHERE id = p_document_id
$$;

-- Parameter catalog is read-only reference data for authenticated clients.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ParameterCatalog'
      AND policyname = 'parameter_catalog_read_authenticated'
  ) THEN
    CREATE POLICY "parameter_catalog_read_authenticated"
    ON "ParameterCatalog"
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

-- App profile rows: a user can read/update their own app profile.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'User'
      AND policyname = 'user_select_own'
  ) THEN
    CREATE POLICY "user_select_own"
    ON "User"
    FOR SELECT
    TO authenticated
    USING ("authUserId" = auth.uid()::text OR id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'User'
      AND policyname = 'user_insert_own'
  ) THEN
    CREATE POLICY "user_insert_own"
    ON "User"
    FOR INSERT
    TO authenticated
    WITH CHECK ("authUserId" = auth.uid()::text OR id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'User'
      AND policyname = 'user_update_own'
  ) THEN
    CREATE POLICY "user_update_own"
    ON "User"
    FOR UPDATE
    TO authenticated
    USING ("authUserId" = auth.uid()::text OR id = auth.uid()::text)
    WITH CHECK ("authUserId" = auth.uid()::text OR id = auth.uid()::text);
  END IF;
END $$;

-- Health profile: owner-only for MVP.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'HealthProfile'
      AND policyname = 'health_profile_owner_all'
  ) THEN
    CREATE POLICY "health_profile_owner_all"
    ON "HealthProfile"
    FOR ALL
    TO authenticated
    USING ("userId" = public.current_app_user_id())
    WITH CHECK ("userId" = public.current_app_user_id());
  END IF;
END $$;

-- Documents and readings: owner-only for MVP. Family permissions can expand this later.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Document'
      AND policyname = 'document_owner_all'
  ) THEN
    CREATE POLICY "document_owner_all"
    ON "Document"
    FOR ALL
    TO authenticated
    USING ("ownerUserId" = public.current_app_user_id())
    WITH CHECK (
      "ownerUserId" = public.current_app_user_id()
      AND "uploadedByUserId" = public.current_app_user_id()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ParameterReading'
      AND policyname = 'reading_owner_all'
  ) THEN
    CREATE POLICY "reading_owner_all"
    ON "ParameterReading"
    FOR ALL
    TO authenticated
    USING ("userId" = public.current_app_user_id())
    WITH CHECK (
      "userId" = public.current_app_user_id()
      AND "createdByUserId" = public.current_app_user_id()
    );
  END IF;
END $$;

-- Family links: visible to either side. Writes remain constrained to the owner for MVP.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'FamilyLink'
      AND policyname = 'family_link_select_related'
  ) THEN
    CREATE POLICY "family_link_select_related"
    ON "FamilyLink"
    FOR SELECT
    TO authenticated
    USING (
      "ownerUserId" = public.current_app_user_id()
      OR "memberUserId" = public.current_app_user_id()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'FamilyLink'
      AND policyname = 'family_link_owner_write'
  ) THEN
    CREATE POLICY "family_link_owner_write"
    ON "FamilyLink"
    FOR ALL
    TO authenticated
    USING ("ownerUserId" = public.current_app_user_id())
    WITH CHECK ("ownerUserId" = public.current_app_user_id());
  END IF;
END $$;

-- Shares and exports: owner-only app access. Public share reads should go through an Edge Function.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'DoctorShare'
      AND policyname = 'doctor_share_owner_all'
  ) THEN
    CREATE POLICY "doctor_share_owner_all"
    ON "DoctorShare"
    FOR ALL
    TO authenticated
    USING ("ownerUserId" = public.current_app_user_id())
    WITH CHECK ("ownerUserId" = public.current_app_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'DoctorShareAccess'
      AND policyname = 'doctor_share_access_owner_read'
  ) THEN
    CREATE POLICY "doctor_share_access_owner_read"
    ON "DoctorShareAccess"
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM "DoctorShare" s
        WHERE s.id = "DoctorShareAccess"."shareId"
          AND s."ownerUserId" = public.current_app_user_id()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Export'
      AND policyname = 'export_owner_all'
  ) THEN
    CREATE POLICY "export_owner_all"
    ON "Export"
    FOR ALL
    TO authenticated
    USING ("userId" = public.current_app_user_id())
    WITH CHECK ("userId" = public.current_app_user_id());
  END IF;
END $$;

-- Storage policies use auth.uid() as the first path segment:
-- medical-documents/<auth-user-id>/...
-- exports/<auth-user-id>/...
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'medical_documents_owner_all'
  ) THEN
    CREATE POLICY "medical_documents_owner_all"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'medical-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'medical-documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'exports_owner_all'
  ) THEN
    CREATE POLICY "exports_owner_all"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'exports'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'exports'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
