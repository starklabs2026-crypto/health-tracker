BEGIN;

-- Identity binding is not a family-profile editing capability. Invoker security
-- distinguishes direct Data API writes from the checked, postgres-owned RPCs.
-- The forwarding alias routes future medical records and must likewise be changed
-- only by the self-scoped claim/ensure RPCs or a trusted administrative operation.
CREATE FUNCTION public.guard_user_auth_identity()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW."authUserId" IS DISTINCT FROM OLD."authUserId"
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.phone IS DISTINCT FROM OLD.phone
    OR NEW."inboundEmailAlias" IS DISTINCT FROM OLD."inboundEmailAlias"
  ) THEN
    RAISE EXCEPTION 'Profile identity changes require verified account reconciliation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.guard_user_auth_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_user_auth_identity BEFORE UPDATE ON public."User"
FOR EACH ROW EXECUTE FUNCTION public.guard_user_auth_identity();

-- Fail closed on historical split/contradictory identity rows, not LIMIT 1.
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN count(*) = 1
    AND bool_and(u."authUserId" IS NULL OR u."authUserId" = auth.uid()::text)
    AND bool_and(u."deletedAt" IS NULL)
    AND bool_and(NOT EXISTS (SELECT 1 FROM auth.users other_auth
      WHERE other_auth.id::text = u.id AND other_auth.id <> auth.uid()))
    THEN min(u.id) END
  FROM public."User" u
  WHERE (u."authUserId" = auth.uid()::text OR u.id = auth.uid()::text)
    AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_app_user_profile(
  p_name text DEFAULT NULL,
  p_dob timestamptz DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_units_preference text DEFAULT NULL,
  p_blood_group text DEFAULT NULL,
  p_has_blood_group boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_auth_user_id text := auth.uid()::text;
  v_email text := NULLIF(auth.jwt() ->> 'email', '');
  v_phone text := NULLIF(auth.jwt() ->> 'phone', '');
  v_user_id text;
  v_user public."User"%ROWTYPE;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  -- Serialize profile creation for this auth identity, including concurrent RPCs.
  PERFORM 1 FROM auth.users WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_deleted' USING ERRCODE = '28000';
  END IF;

  FOR v_user IN
    SELECT * FROM public."User" u
    WHERE u."authUserId" = v_auth_user_id OR u.id = v_auth_user_id
    ORDER BY u.id FOR UPDATE
  LOOP
    IF v_user_id IS NOT NULL OR v_user."deletedAt" IS NOT NULL
      OR (v_user."authUserId" IS NOT NULL AND v_user."authUserId" <> v_auth_user_id)
      OR EXISTS (SELECT 1 FROM auth.users other_auth
        WHERE other_auth.id::text = v_user.id AND other_auth.id <> auth.uid()) THEN
      RAISE EXCEPTION 'profile_identity_conflict' USING ERRCODE = '42501';
    END IF;
    v_user_id := v_user.id;
  END LOOP;

  -- An email/phone collision is NOT proof that this auth user owns that profile.
  -- Legacy email-only rows must be reconciled by an independently verified admin.
  IF EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u.id IS DISTINCT FROM v_user_id AND (
      (u.email = v_email AND (v_user_id IS NULL OR v_user.email IS NULL))
      OR (u.phone = v_phone AND (v_user_id IS NULL OR v_user.phone IS NULL))
    )
  ) THEN
    RAISE EXCEPTION 'profile_identity_conflict' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    INSERT INTO public."User" (id, "authUserId", email, phone, name, dob, sex,
      "unitsPreference", "bloodGroup", "residencyRegion")
    VALUES (v_auth_user_id, v_auth_user_id, v_email, v_phone,
      COALESCE(NULLIF(TRIM(p_name), ''), ''), COALESCE(p_dob, to_timestamp(0)),
      COALESCE(p_sex, 'other'), COALESCE(p_units_preference, 'metric'),
      CASE WHEN p_has_blood_group THEN p_blood_group ELSE NULL END, 'US')
    RETURNING id INTO v_user_id;
  ELSE
    UPDATE public."User" SET
      "authUserId" = v_auth_user_id,
      email = COALESCE("User".email, v_email),
      phone = COALESCE("User".phone, v_phone),
      name = COALESCE(NULLIF(TRIM(p_name), ''), "User".name),
      dob = COALESCE(p_dob, "User".dob),
      sex = COALESCE(p_sex, "User".sex),
      "unitsPreference" = COALESCE(p_units_preference, "User"."unitsPreference"),
      "bloodGroup" = CASE WHEN p_has_blood_group THEN p_blood_group ELSE "User"."bloodGroup" END
    WHERE id = v_user_id;
  END IF;
  RETURN v_user_id;
END
$$;
REVOKE ALL ON FUNCTION public.upsert_app_user_profile(text, timestamptz, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_app_user_profile(text, timestamptz, text, text, text, boolean) TO authenticated, service_role;

-- Remove historical permissive email/identity policies as well as the current
-- named policies. Restrictive identity guard above also covers unexpected grants.
DROP POLICY IF EXISTS user_insert_own ON public."User";
DROP POLICY IF EXISTS user_select_own ON public."User";
DROP POLICY IF EXISTS user_update_own ON public."User";
DROP POLICY IF EXISTS user_select_accessible ON public."User";
DROP POLICY IF EXISTS user_update_manageable ON public."User";
CREATE POLICY user_select_accessible ON public."User" FOR SELECT TO authenticated
USING (public.can_access_user(id));
CREATE POLICY user_update_manageable ON public."User" FOR UPDATE TO authenticated
USING (public.can_manage_user(id)) WITH CHECK (public.can_manage_user(id));

-- Private primitive shared by JWT-bound RLS and the service-only OCR check.
-- A null type means unclassified data, allowed only to self or a full managed
-- grant. Accepted docTypes grants never authorize unlinked readings/orphan files.
CREATE FUNCTION public.profile_document_grant(p_requester_id text, p_target_id text, p_doc_type text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" requester
    WHERE requester.id = p_requester_id AND requester."deletedAt" IS NULL
      AND EXISTS (SELECT 1 FROM auth.users a
        WHERE a.id::text = COALESCE(requester."authUserId", requester.id))
      AND NOT EXISTS (SELECT 1 FROM auth.users other_auth
        WHERE other_auth.id::text = requester.id
          AND other_auth.id::text <> COALESCE(requester."authUserId", requester.id))
      AND NOT EXISTS (SELECT 1 FROM public."User" other_profile
        WHERE (other_profile.id = COALESCE(requester."authUserId", requester.id)
          OR other_profile."authUserId" = COALESCE(requester."authUserId", requester.id))
          AND other_profile.id <> requester.id)
  ) AND EXISTS (SELECT 1 FROM public."User" target WHERE target.id = p_target_id AND target."deletedAt" IS NULL)
  AND (p_requester_id = p_target_id OR EXISTS (
    SELECT 1 FROM public."FamilyLink" fl
    WHERE fl."ownerUserId" = p_requester_id AND fl."memberUserId" = p_target_id
      AND fl.status = 'active' AND fl."revokedAt" IS NULL AND fl."acceptedAt" IS NOT NULL
      AND (fl."accessOrigin" = 'accepted' OR (fl."accessOrigin" = 'managed'
        AND NOT public.profile_has_auth_identity(fl."memberUserId")))
      AND CASE WHEN p_doc_type IS NULL THEN
        fl."accessOrigin" = 'managed' AND (fl.permissions -> 'docTypes') @>
          '["lab_report","prescription","imaging_report","discharge_summary","vaccination_record","other"]'::jsonb
      ELSE (fl.permissions -> 'docTypes') @> jsonb_build_array(p_doc_type) END
  ))
$$;
REVOKE ALL ON FUNCTION public.profile_document_grant(text, text, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.can_access_document_type(p_owner_id text, p_doc_type text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.profile_document_grant(public.current_app_user_id(), p_owner_id, p_doc_type)
$$;
REVOKE ALL ON FUNCTION public.can_access_document_type(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_document_type(text, text) TO authenticated;

CREATE FUNCTION public.can_access_reading(p_user_id text, p_document_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN p_document_id IS NULL THEN
    public.profile_document_grant(public.current_app_user_id(), p_user_id, NULL)
  ELSE EXISTS (
    SELECT 1 FROM public."Document" d WHERE d.id = p_document_id
      AND d."ownerUserId" = p_user_id
      AND (d."deletedAt" IS NULL OR p_user_id = public.current_app_user_id())
      AND public.profile_document_grant(public.current_app_user_id(), p_user_id, d."docType")
  ) END
$$;
REVOKE ALL ON FUNCTION public.can_access_reading(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_reading(text, text) TO authenticated;

CREATE FUNCTION public.can_manage_document_for_user(p_requester_id text, p_document_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (SELECT 1 FROM public."Document" d
    WHERE d.id = p_document_id AND d."deletedAt" IS NULL
      AND public.profile_document_grant(p_requester_id, d."ownerUserId", d."docType"))
$$;
REVOKE ALL ON FUNCTION public.can_manage_document_for_user(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_document_for_user(text, text) TO service_role;

-- A docTypes grant permits scoped edits, not appropriation of another account's
-- records. Ownership transfers remain available between self/fully managed users.
CREATE FUNCTION public.guard_document_owner_scope()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN RETURN NEW; END IF;
  -- Canonical storage authorization relies on this upload provenance, including
  -- while fileUrl is still null. A client must not forge a foreign object path.
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW."uploadedByUserId" IS DISTINCT FROM OLD."uploadedByUserId" THEN
    RAISE EXCEPTION 'Document identifiers and uploader provenance are server-owned'
      USING ERRCODE = '42501';
  END IF;
  IF NEW."ownerUserId" IS DISTINCT FROM OLD."ownerUserId"
    AND NOT (public.can_access_document_type(OLD."ownerUserId", NULL)
      AND public.can_access_document_type(NEW."ownerUserId", NULL)) THEN
    RAISE EXCEPTION 'Document ownership transfer requires self or managed-profile authority'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.guard_document_owner_scope() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_document_owner_scope BEFORE UPDATE ON public."Document"
FOR EACH ROW EXECUTE FUNCTION public.guard_document_owner_scope();

CREATE FUNCTION public.guard_reading_owner_scope()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role')
    AND NEW."userId" IS DISTINCT FROM OLD."userId"
    AND NOT (public.can_access_document_type(OLD."userId", NULL)
      AND public.can_access_document_type(NEW."userId", NULL)) THEN
    RAISE EXCEPTION 'Reading ownership transfer requires self or managed-profile authority'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.guard_reading_owner_scope() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_reading_owner_scope BEFORE UPDATE OF "userId" ON public."ParameterReading"
FOR EACH ROW EXECUTE FUNCTION public.guard_reading_owner_scope();

-- The native client currently PATCHes the document, then its readings. Keep
-- these consistent in the first transaction so RLS cannot strand the second
-- PATCH behind an owner mismatch. This trigger cannot be called as a client RPC.
CREATE FUNCTION public.sync_document_reading_owner()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public."ParameterReading" SET "userId" = NEW."ownerUserId"
  WHERE "documentId" = NEW.id AND "userId" = OLD."ownerUserId";
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.sync_document_reading_owner() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_document_reading_owner AFTER UPDATE OF "ownerUserId" ON public."Document"
FOR EACH ROW WHEN (OLD."ownerUserId" IS DISTINCT FROM NEW."ownerUserId")
EXECUTE FUNCTION public.sync_document_reading_owner();

DROP POLICY IF EXISTS document_owner_all ON public."Document";
DROP POLICY IF EXISTS document_select_accessible ON public."Document";
DROP POLICY IF EXISTS document_insert_manageable ON public."Document";
DROP POLICY IF EXISTS document_update_manageable ON public."Document";
DROP POLICY IF EXISTS document_delete_manageable ON public."Document";
CREATE POLICY document_select_accessible ON public."Document" FOR SELECT TO authenticated
USING (public.can_access_document_type("ownerUserId", "docType"));
CREATE POLICY document_insert_manageable ON public."Document" FOR INSERT TO authenticated
WITH CHECK (public.can_access_document_type("ownerUserId", "docType") AND "uploadedByUserId" = public.current_app_user_id());
CREATE POLICY document_update_manageable ON public."Document" FOR UPDATE TO authenticated
USING (public.can_access_document_type("ownerUserId", "docType"))
WITH CHECK (public.can_access_document_type("ownerUserId", "docType"));
CREATE POLICY document_delete_manageable ON public."Document" FOR DELETE TO authenticated
USING (public.can_access_document_type("ownerUserId", "docType"));

DROP POLICY IF EXISTS reading_owner_all ON public."ParameterReading";
DROP POLICY IF EXISTS reading_select_accessible ON public."ParameterReading";
DROP POLICY IF EXISTS reading_insert_manageable ON public."ParameterReading";
DROP POLICY IF EXISTS reading_update_manageable ON public."ParameterReading";
DROP POLICY IF EXISTS reading_delete_manageable ON public."ParameterReading";
CREATE POLICY reading_select_accessible ON public."ParameterReading" FOR SELECT TO authenticated
USING (public.can_access_reading("userId", "documentId"));
CREATE POLICY reading_insert_manageable ON public."ParameterReading" FOR INSERT TO authenticated
WITH CHECK (public.can_access_reading("userId", "documentId") AND "createdByUserId" = public.current_app_user_id());
CREATE POLICY reading_update_manageable ON public."ParameterReading" FOR UPDATE TO authenticated
USING (public.can_access_reading("userId", "documentId")) WITH CHECK (public.can_access_reading("userId", "documentId"));
CREATE POLICY reading_delete_manageable ON public."ParameterReading" FOR DELETE TO authenticated
USING (public.can_access_reading("userId", "documentId"));

CREATE FUNCTION public.medical_document_storage_path(p_pointer text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_pointer LIKE 'storage://medical-documents/%' THEN substr(p_pointer, length('storage://medical-documents/') + 1)
    WHEN p_pointer LIKE '%://%' THEN NULL
    WHEN ltrim(p_pointer, '/') LIKE 'medical-documents/%' THEN substr(ltrim(p_pointer, '/'), length('medical-documents/') + 1)
    ELSE ltrim(p_pointer, '/') END
$$;
REVOKE ALL ON FUNCTION public.medical_document_storage_path(text) FROM PUBLIC, anon, authenticated;
-- Index maintenance runs as the inserting client. This pure string normalizer
-- reads no database rows and is safe to execute directly.
GRANT EXECUTE ON FUNCTION public.medical_document_storage_path(text) TO authenticated, service_role;
CREATE INDEX "Document_medical_storage_path_idx" ON public."Document" (public.medical_document_storage_path("fileUrl"));

CREATE FUNCTION public.can_access_medical_object(p_path text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_requester text := public.current_app_user_id();
  v_found boolean := false;
  v_document record;
BEGIN
  IF v_requester IS NULL OR nullif(p_path, '') IS NULL THEN RETURN false; END IF;
  -- Files can be stored under the uploader rather than the patient's identity.
  -- Every referencing document must authorize access; a forged second pointer
  -- must not turn a forbidden prescription into an accessible lab report.
  FOR v_document IN SELECT d."ownerUserId", d."docType", d."deletedAt" FROM public."Document" d
    WHERE public.medical_document_storage_path(d."fileUrl") = p_path
      OR (split_part(p_path, '/', 2) IN ('documents', 'email')
        AND d.id = split_part(p_path, '/', 3)
        AND (split_part(p_path, '/', 1) = d."uploadedByUserId"
          OR (split_part(p_path, '/', 1) = d."ownerUserId"
            AND public.profile_document_grant(v_requester, d."ownerUserId", NULL))
          OR EXISTS (SELECT 1 FROM public."User" uploader
            WHERE uploader.id = d."uploadedByUserId"
              AND uploader."authUserId" = split_part(p_path, '/', 1))))
  LOOP
    v_found := true;
    IF (v_document."deletedAt" IS NOT NULL AND v_document."ownerUserId" <> v_requester)
      OR NOT public.profile_document_grant(v_requester, v_document."ownerUserId", v_document."docType") THEN
      RETURN false;
    END IF;
  END LOOP;
  IF v_found THEN RETURN true; END IF;
  -- Preserve upload-before-registration only within self/managed namespaces.
  RETURN split_part(p_path, '/', 1) = auth.uid()::text
    OR public.profile_document_grant(v_requester, split_part(p_path, '/', 1), NULL);
END
$$;
REVOKE ALL ON FUNCTION public.can_access_medical_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_medical_object(text) TO authenticated;

CREATE FUNCTION public.guard_document_storage_pointer()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_path text;
BEGIN
  IF current_user IN ('postgres', 'service_role') OR NEW."fileUrl" IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW."fileUrl" IS NOT DISTINCT FROM OLD."fileUrl" THEN RETURN NEW; END IF;
  -- Use the JWT-bound check before the new row can authorize its own pointer.
  v_path := public.medical_document_storage_path(NEW."fileUrl");
  IF NOT public.can_access_medical_object(v_path) THEN
    RAISE EXCEPTION 'Medical storage pointer is outside granted access' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.guard_document_storage_pointer() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_document_storage_pointer BEFORE INSERT OR UPDATE OF "fileUrl" ON public."Document"
FOR EACH ROW EXECUTE FUNCTION public.guard_document_storage_pointer();

DROP POLICY IF EXISTS medical_documents_owner_all ON storage.objects;
CREATE POLICY medical_documents_owner_all ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'medical-documents' AND public.can_access_medical_object(name))
WITH CHECK (bucket_id = 'medical-documents' AND public.can_access_medical_object(name));

COMMIT;
