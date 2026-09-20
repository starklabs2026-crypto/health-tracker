-- REVIEWED ROLLOUT ONLY. Do not auto-apply this migration to a populated project.
-- Before rollout, independently audit every active relationship and the deployed
-- create/merge RPC definitions and owners. Mutable FamilyLink/User fields, names,
-- null authUserId, and matching timestamps are NOT creation/acceptance evidence.
-- In the SAME trusted postgres session, prepare the reviewed manifest:
--   CREATE TEMP TABLE hf_family_grant_review (
--     "linkId" text PRIMARY KEY, "expectedGrant" jsonb NOT NULL,
--     decision text NOT NULL, "evidenceRef" text NOT NULL, "reviewedBy" text NOT NULL
--   );
-- Populate expectedGrant with the full pre-migration to_jsonb(FamilyLink) snapshot.
-- decision is managed (verified managed creation), accepted (independent evidence
-- of member acceptance of these exact permissions), or revoke (explicitly reviewed
-- rejection/re-invitation). evidenceRef points to retained evidence, NOT a PHI dump.
-- By default unresolved relationships block rollout; never infer/bulk approve provenance.
-- Verified grants retain their IDs/status/permissions and all associated records.
-- No absent-manifest quarantine or automatic backfill is performed.
-- Explicit staged alternative (trusted session only):
--   SET healthfolio.family_rollout = 'defer_legacy';
-- With no manifest, this snapshots every active grant as defer/unverified without
-- changing its status or deleting data. Existing family access is unavailable;
-- self access and newly verified grants work. Disclose that limitation to users.
-- This mode also withholds the new client invitation-acceptance RPC grant. Keep
-- backend acceptance fenced until independent sharing/document-type RLS is reviewed;
-- enabling client acceptance later requires an explicit trusted EXECUTE grant.
-- BEFORE enabling traffic, every service-role reader must reject unverified grants
-- too; service_role bypasses RLS and legacy status='active' checks are insufficient.
-- Later recovery requires independent evidence: issue a fresh trusted managed grant
-- to the SAME profile ID (or a fresh member-accepted invite for independent users),
-- retire the old unverified link, and update its restricted review entry with the
-- actual reviewer/evidence reference. Preserve expectedGrant; never flip provenance
-- on an old row or recreate/move the profile's medical records to recover access.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public."FamilyLink" IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  v_mode text := coalesce(nullif(current_setting('healthfolio.family_rollout', true), ''), 'reviewed');
BEGIN
  IF v_mode NOT IN ('reviewed', 'defer_legacy') THEN
    RAISE EXCEPTION 'Unknown family authorization rollout mode';
  END IF;
  -- Unknown platform/definer owners need review, not a wider privileged allowlist.
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Family authorization migration requires reviewed postgres ownership';
  END IF;
  IF to_regprocedure('public.create_managed_profile(text,timestamptz,text,text,text,text)') IS NULL
    OR to_regprocedure('public.merge_managed_profile(text,text)') IS NULL
    OR EXISTS (
      SELECT 1 FROM pg_proc p WHERE p.oid IN (
        to_regprocedure('public.create_managed_profile(text,timestamptz,text,text,text,text)'),
        to_regprocedure('public.merge_managed_profile(text,text)')
      ) AND (NOT p.prosecdef OR pg_get_userbyid(p.proowner) <> 'postgres')
    ) THEN
    RAISE EXCEPTION 'Review deployed create/merge RPC definitions and definer owners before rollout';
  END IF;
  IF to_regclass('pg_temp.hf_family_grant_review') IS NULL THEN
    IF v_mode <> 'defer_legacy' AND EXISTS (SELECT 1 FROM public."FamilyLink" WHERE status = 'active') THEN
      RAISE EXCEPTION 'Active family grants require a complete audited recovery manifest; no changes applied';
    END IF;
    CREATE TEMP TABLE hf_family_grant_review (
      "linkId" text PRIMARY KEY, "expectedGrant" jsonb NOT NULL,
      decision text NOT NULL, "evidenceRef" text NOT NULL, "reviewedBy" text NOT NULL
    );
    IF v_mode = 'defer_legacy' THEN
      INSERT INTO pg_temp.hf_family_grant_review ("linkId", "expectedGrant", decision, "evidenceRef", "reviewedBy")
      SELECT fl.id, to_jsonb(fl), 'defer', 'rollout:deferred-without-authorization-evidence', current_user
      FROM public."FamilyLink" fl WHERE fl.status = 'active';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM (SELECT * FROM public."FamilyLink" WHERE status = 'active') fl
    FULL JOIN pg_temp.hf_family_grant_review r ON r."linkId" = fl.id
    WHERE fl.id IS NULL OR r."linkId" IS NULL
      OR r."expectedGrant" IS DISTINCT FROM to_jsonb(fl)
      OR r.decision IS NULL OR r.decision NOT IN ('managed', 'accepted', 'revoke', 'defer')
      OR (r.decision = 'defer' AND v_mode <> 'defer_legacy')
      OR nullif(btrim(r."evidenceRef"), '') IS NULL
      OR nullif(btrim(r."reviewedBy"), '') IS NULL
  ) OR EXISTS (
    SELECT 1 FROM pg_temp.hf_family_grant_review GROUP BY "linkId" HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'Family recovery manifest is incomplete, stale, or lacks an audited decision';
  END IF;
END
$$;

ALTER TABLE public."FamilyLink"
  ADD COLUMN "accessOrigin" text NOT NULL DEFAULT 'unverified'
  CHECK ("accessOrigin" IN ('unverified', 'managed', 'accepted'));

CREATE FUNCTION public.profile_has_auth_identity(p_user_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public."User" WHERE id = p_user_id)
    OR EXISTS (
      SELECT 1 FROM public."User" u
      WHERE u.id = p_user_id AND (
        u."authUserId" IS NOT NULL
        OR EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = u.id)
      )
    )
$$;
REVOKE ALL ON FUNCTION public.profile_has_auth_identity(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_has_auth_identity(text) TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_temp.hf_family_grant_review r
    JOIN public."FamilyLink" fl ON fl.id = r."linkId"
    JOIN public."User" u ON u.id = fl."memberUserId"
    WHERE r.decision IN ('managed', 'accepted') AND (
      fl."ownerUserId" = fl."memberUserId" OR fl."acceptedAt" IS NULL OR fl."revokedAt" IS NOT NULL
      OR fl."inviteToken" IS NOT NULL
      OR jsonb_typeof(fl.permissions) IS DISTINCT FROM 'object'
      OR jsonb_typeof(fl.permissions -> 'docTypes') IS DISTINCT FROM 'array'
      OR (r.decision = 'managed' AND (public.profile_has_auth_identity(u.id) OR u.email IS NOT NULL OR u.phone IS NOT NULL))
      OR (r.decision = 'accepted' AND NOT public.profile_has_auth_identity(u.id))
    )
  ) THEN
    RAISE EXCEPTION 'Reviewed grant is inconsistent with safe managed/accepted recovery; re-invite instead';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp.hf_family_grant_review r
    JOIN public."FamilyLink" fl ON fl.id = r."linkId",
    LATERAL jsonb_array_elements(CASE
      WHEN r.decision IN ('managed', 'accepted') AND jsonb_typeof(fl.permissions -> 'docTypes') = 'array'
      THEN fl.permissions -> 'docTypes' ELSE '[]'::jsonb END) d
    WHERE jsonb_typeof(d) <> 'string'
      OR d #>> '{}' NOT IN ('lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'vaccination_record', 'other')
  ) THEN
    RAISE EXCEPTION 'Reviewed grant has invalid document permissions';
  END IF;
END
$$;

-- Keep the reviewed snapshot and evidence reference after the temporary manifest
-- disappears. No client policy or write grant is created for this audit table.
CREATE TABLE public."FamilyGrantReview" (
  "linkId" text PRIMARY KEY,
  "expectedGrant" jsonb NOT NULL,
  decision text NOT NULL CHECK (decision IN ('managed', 'accepted', 'revoke', 'defer')),
  "evidenceRef" text NOT NULL,
  "reviewedBy" text NOT NULL,
  "appliedAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."FamilyGrantReview" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."FamilyGrantReview" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public."FamilyGrantReview" TO service_role;
INSERT INTO public."FamilyGrantReview" ("linkId", "expectedGrant", decision, "evidenceRef", "reviewedBy")
SELECT "linkId", "expectedGrant", decision, "evidenceRef", "reviewedBy" FROM pg_temp.hf_family_grant_review;

UPDATE public."FamilyLink" fl
SET "accessOrigin" = CASE WHEN r.decision IN ('revoke', 'defer') THEN 'unverified' ELSE r.decision END,
  status = CASE WHEN r.decision = 'revoke' THEN 'revoked' ELSE fl.status END,
  "revokedAt" = CASE WHEN r.decision = 'revoke' THEN coalesce(fl."revokedAt", now()) ELSE fl."revokedAt" END
FROM pg_temp.hf_family_grant_review r WHERE r."linkId" = fl.id;

-- Invoker security is intentional: a client cannot impersonate the effective
-- database role of create_managed_profile / accept_family_invite or the backend.
CREATE FUNCTION public.guard_family_authorization()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_trusted boolean := current_user IN ('postgres', 'service_role');
BEGIN
  IF NEW."ownerUserId" = NEW."memberUserId" THEN
    RAISE EXCEPTION 'A family grant must target another profile';
  END IF;
  IF jsonb_typeof(NEW.permissions) IS DISTINCT FROM 'object'
    OR jsonb_typeof(NEW.permissions -> 'docTypes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Family grant requires document permissions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.permissions -> 'docTypes') d
    WHERE jsonb_typeof(d) <> 'string'
      OR d #>> '{}' NOT IN ('lab_report', 'prescription', 'imaging_report', 'discharge_summary', 'vaccination_record', 'other')
  ) THEN
    RAISE EXCEPTION 'Invalid family document permissions';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."accessOrigin" <> 'unverified' OR NEW."revokedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Family provenance is server-owned';
    END IF;
    IF NEW.status = 'pending' AND NEW."acceptedAt" IS NULL
      AND nullif(btrim(NEW."inviteToken"), '') IS NOT NULL THEN
      RETURN NEW;
    END IF;
    IF NOT v_trusted THEN
      RAISE EXCEPTION 'Family activation requires trusted creation or member acceptance';
    END IF;
    IF NEW.status = 'active' AND NEW."acceptedAt" IS NOT NULL
      AND NEW."inviteToken" IS NULL
      AND NOT public.profile_has_auth_identity(NEW."memberUserId")
      AND EXISTS (SELECT 1 FROM public."User" u WHERE u.id = NEW."memberUserId" AND u.email IS NULL AND u.phone IS NULL) THEN
      NEW."accessOrigin" := 'managed';
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Family activation requires trusted creation or member acceptance';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW."ownerUserId" IS DISTINCT FROM OLD."ownerUserId"
    OR NEW."memberUserId" IS DISTINCT FROM OLD."memberUserId"
    OR NEW.permissions IS DISTINCT FROM OLD.permissions
    OR NEW."accessOrigin" IS DISTINCT FROM OLD."accessOrigin" THEN
    RAISE EXCEPTION 'Family grant identity and permissions are immutable; issue a new invitation';
  END IF;

  IF NEW.status = 'revoked' AND OLD.status <> 'revoked'
    AND NEW."revokedAt" IS NOT NULL
    AND NEW."acceptedAt" IS NOT DISTINCT FROM OLD."acceptedAt"
    AND NEW."inviteToken" IS NOT DISTINCT FROM OLD."inviteToken" THEN
    RETURN NEW;
  END IF;
  IF v_trusted THEN
    IF OLD.status = 'pending' AND NEW.status = 'active'
      AND OLD."accessOrigin" = 'unverified'
      AND OLD."revokedAt" IS NULL AND NEW."revokedAt" IS NULL
      AND OLD."acceptedAt" IS NULL AND NEW."acceptedAt" IS NOT NULL
      AND nullif(btrim(OLD."inviteToken"), '') IS NOT NULL AND NEW."inviteToken" IS NULL
      AND public.profile_has_auth_identity(NEW."memberUserId") THEN
      NEW."accessOrigin" := 'accepted';
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW."acceptedAt" IS DISTINCT FROM OLD."acceptedAt"
    OR NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt"
    OR NEW."inviteToken" IS DISTINCT FROM OLD."inviteToken" THEN
    RAISE EXCEPTION 'Family activation and acceptance are server-owned';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.guard_family_authorization() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_family_authorization
BEFORE INSERT OR UPDATE ON public."FamilyLink"
FOR EACH ROW EXECUTE FUNCTION public.guard_family_authorization();

CREATE OR REPLACE FUNCTION public.can_access_user(p_user_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN p_user_id = public.current_app_user_id() THEN true
    ELSE EXISTS (
      SELECT 1 FROM public."FamilyLink" fl
      WHERE fl.status = 'active' AND fl."revokedAt" IS NULL
        AND fl."acceptedAt" IS NOT NULL
        AND (fl."accessOrigin" = 'accepted' OR (fl."accessOrigin" = 'managed'
          AND NOT public.profile_has_auth_identity(fl."memberUserId")))
        -- Relationship membership is not reciprocal permission to read health data.
        AND fl."ownerUserId" = public.current_app_user_id() AND fl."memberUserId" = p_user_id
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user(p_user_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN p_user_id = public.current_app_user_id() THEN true
    ELSE EXISTS (
      SELECT 1 FROM public."FamilyLink" fl
      WHERE fl.status = 'active' AND fl."revokedAt" IS NULL
        AND fl."acceptedAt" IS NOT NULL
        AND (fl."accessOrigin" = 'accepted' OR (fl."accessOrigin" = 'managed'
          AND NOT public.profile_has_auth_identity(fl."memberUserId")))
        AND fl."ownerUserId" = public.current_app_user_id() AND fl."memberUserId" = p_user_id
    )
  END
$$;

-- Only the authenticated backend may ask about an explicit requester. Public
-- clients must not supply arbitrary requester IDs to a SECURITY DEFINER RPC.
CREATE FUNCTION public.assistant_profile_access(p_requester_id text, p_target_id text)
RETURNS TABLE ("docTypes" jsonb, "requiresTargetConsent" boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT fl.permissions -> 'docTypes', fl."accessOrigin" = 'accepted'
  FROM public."FamilyLink" fl
  JOIN public."User" requester ON requester.id = fl."ownerUserId" AND requester."deletedAt" IS NULL
  JOIN public."User" target ON target.id = fl."memberUserId" AND target."deletedAt" IS NULL
  WHERE fl."ownerUserId" = p_requester_id AND fl."memberUserId" = p_target_id
    AND fl.status = 'active' AND fl."revokedAt" IS NULL AND fl."acceptedAt" IS NOT NULL
    AND (fl."accessOrigin" = 'accepted' OR (fl."accessOrigin" = 'managed'
      AND NOT public.profile_has_auth_identity(fl."memberUserId")))
  ORDER BY fl."acceptedAt" DESC, fl.id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.assistant_profile_access(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_profile_access(text, text) TO service_role;

CREATE FUNCTION public.accept_family_invite(p_invite_token text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_member_id text := public.current_app_user_id();
  v_link_id text;
BEGIN
  IF auth.uid() IS NULL OR v_member_id IS NULL
    OR NOT public.profile_has_auth_identity(v_member_id)
    OR nullif(btrim(p_invite_token), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid family invitation';
  END IF;
  SELECT fl.id INTO v_link_id FROM public."FamilyLink" fl
  WHERE fl."memberUserId" = v_member_id AND fl."inviteToken" = p_invite_token
    AND fl.status = 'pending' AND fl."revokedAt" IS NULL AND fl."accessOrigin" = 'unverified'
  FOR UPDATE;
  IF v_link_id IS NULL THEN RAISE EXCEPTION 'Invalid family invitation'; END IF;
  UPDATE public."FamilyLink" SET status = 'active', "acceptedAt" = now(), "inviteToken" = NULL
  WHERE id = v_link_id;
  RETURN v_link_id;
END
$$;
REVOKE ALL ON FUNCTION public.accept_family_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_family_invite(text) FROM authenticated;
DO $$
BEGIN
  IF current_setting('healthfolio.family_rollout', true) IS DISTINCT FROM 'defer_legacy' THEN
    GRANT EXECUTE ON FUNCTION public.accept_family_invite(text) TO authenticated;
  END IF;
END
$$;

-- Retain the shipped record-moving/deduplication algorithm behind a private RPC.
-- Its old null-authUserId check alone did not exclude legacy independent Auth users.
ALTER FUNCTION public.merge_managed_profile(text, text) RENAME TO _merge_managed_profile_records;
REVOKE ALL ON FUNCTION public._merge_managed_profile_records(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.merge_managed_profile(p_source_user_id text, p_target_user_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner_id text := public.current_app_user_id();
  v_target_id text;
  v_full_doc_types constant jsonb := '["lab_report","prescription","imaging_report","discharge_summary","vaccination_record","other"]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_owner_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF nullif(btrim(p_source_user_id), '') IS NULL THEN
    RAISE EXCEPTION 'source_profile_required' USING ERRCODE = '22023';
  END IF;
  v_target_id := coalesce(nullif(btrim(p_target_user_id), ''), v_owner_id);
  IF p_source_user_id = v_target_id THEN
    RAISE EXCEPTION 'source_and_target_match' USING ERRCODE = '22023';
  END IF;

  -- Keep revocation/identity changes from racing the authorization and merge.
  PERFORM 1 FROM public."User" WHERE id IN (p_source_user_id, v_target_id) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public."FamilyLink"
    WHERE "ownerUserId" = v_owner_id AND "memberUserId" IN (p_source_user_id, v_target_id)
    ORDER BY id FOR UPDATE;
  IF public.profile_has_auth_identity(p_source_user_id) OR NOT EXISTS (
    SELECT 1 FROM public."FamilyLink" fl
    WHERE fl."ownerUserId" = v_owner_id AND fl."memberUserId" = p_source_user_id
      AND fl.status = 'active' AND fl."accessOrigin" = 'managed'
      AND fl."revokedAt" IS NULL AND fl."acceptedAt" IS NOT NULL
      AND (fl.permissions -> 'docTypes') @> v_full_doc_types
  ) THEN
    RAISE EXCEPTION 'source_profile_not_manageable' USING ERRCODE = '42501';
  END IF;
  -- The private algorithm moves every document type, unlinked reading, share,
  -- and export. A limited grant or an independent share cannot authorize it.
  IF v_target_id <> v_owner_id AND (
    public.profile_has_auth_identity(v_target_id) OR NOT EXISTS (
      SELECT 1 FROM public."FamilyLink" fl
      WHERE fl."ownerUserId" = v_owner_id AND fl."memberUserId" = v_target_id
        AND fl.status = 'active' AND fl."accessOrigin" = 'managed'
        AND fl."revokedAt" IS NULL AND fl."acceptedAt" IS NOT NULL
        AND (fl.permissions -> 'docTypes') @> v_full_doc_types
    )
  ) THEN
    RAISE EXCEPTION 'target_profile_not_manageable' USING ERRCODE = '42501';
  END IF;
  RETURN public._merge_managed_profile_records(p_source_user_id, v_target_id);
END
$$;
REVOKE ALL ON FUNCTION public.merge_managed_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_managed_profile(text, text) TO authenticated;

COMMIT;
