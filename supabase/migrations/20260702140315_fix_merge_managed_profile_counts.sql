-- Correct merge_managed_profile result accounting so mobile feedback reports
-- source-profile rows moved, not pre-existing rows already on the target.

CREATE OR REPLACE FUNCTION public.merge_managed_profile(
  p_source_user_id text,
  p_target_user_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_user_id text;
  v_target_user_id text;
  v_source_link_id text;
  v_preserved_documents integer := 0;
  v_soft_deleted_documents integer := 0;
  v_moved_readings integer := 0;
  v_updated_documents integer := 0;
  v_updated_shares integer := 0;
  v_updated_exports integer := 0;
  v_rows integer := 0;
BEGIN
  v_owner_user_id := public.current_app_user_id();
  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_source_user_id IS NULL OR btrim(p_source_user_id) = '' THEN
    RAISE EXCEPTION 'source_profile_required' USING ERRCODE = '22023';
  END IF;

  v_target_user_id := COALESCE(NULLIF(btrim(p_target_user_id), ''), v_owner_user_id);

  IF p_source_user_id = v_target_user_id THEN
    RAISE EXCEPTION 'source_and_target_match' USING ERRCODE = '22023';
  END IF;

  SELECT fl.id
  INTO v_source_link_id
  FROM "FamilyLink" fl
  WHERE fl."ownerUserId" = v_owner_user_id
    AND fl."memberUserId" = p_source_user_id
    AND fl.status = 'active'
  LIMIT 1;

  IF v_source_link_id IS NULL THEN
    RAISE EXCEPTION 'source_profile_not_manageable' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "User" u
    WHERE u.id = p_source_user_id
      AND (
        u."authUserId" IS NOT NULL
        OR u.email IS NOT NULL
        OR u.phone IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'source_profile_not_synthetic' USING ERRCODE = '42501';
  END IF;

  IF v_target_user_id <> v_owner_user_id AND NOT EXISTS (
    SELECT 1
    FROM "FamilyLink" fl
    WHERE fl."ownerUserId" = v_owner_user_id
      AND fl."memberUserId" = v_target_user_id
      AND fl.status = 'active'
  ) THEN
    RAISE EXCEPTION 'target_profile_not_manageable' USING ERRCODE = '42501';
  END IF;

  DROP TABLE IF EXISTS pg_temp.hf_merge_ranked_docs;
  CREATE TEMP TABLE hf_merge_ranked_docs ON COMMIT DROP AS
  SELECT
    ranked.id,
    ranked."ownerUserId",
    ranked."emailIngestKey",
    ranked.rn,
    ranked.keeper_id
  FROM (
    SELECT
      candidate.*,
      row_number() OVER (
        PARTITION BY COALESCE(candidate."emailIngestKey", candidate.id)
        ORDER BY
          candidate.owner_rank ASC,
          candidate.reading_count DESC,
          candidate.has_real_source_date ASC,
          candidate."createdAt" ASC,
          candidate.id ASC
      ) AS rn,
      first_value(candidate.id) OVER (
        PARTITION BY COALESCE(candidate."emailIngestKey", candidate.id)
        ORDER BY
          candidate.owner_rank ASC,
          candidate.reading_count DESC,
          candidate.has_real_source_date ASC,
          candidate."createdAt" ASC,
          candidate.id ASC
      ) AS keeper_id
    FROM (
      SELECT
        d.id,
        d."ownerUserId",
        d."emailIngestKey",
        d."createdAt",
        COUNT(pr.id)::integer AS reading_count,
        CASE WHEN d."ownerUserId" = v_target_user_id THEN 0 ELSE 1 END AS owner_rank,
        CASE
          WHEN d."sourceDate" IS NOT NULL
            AND abs(extract(epoch from (d."sourceDate" - d."createdAt"))) > 86400
          THEN 0
          ELSE 1
        END AS has_real_source_date
      FROM "Document" d
      LEFT JOIN "ParameterReading" pr ON pr."documentId" = d.id
      WHERE d."deletedAt" IS NULL
        AND d."ownerUserId" IN (p_source_user_id, v_target_user_id)
      GROUP BY d.id, d."ownerUserId", d."emailIngestKey", d."createdAt", d."sourceDate"
    ) candidate
  ) ranked;

  SELECT COUNT(*) INTO v_preserved_documents
  FROM hf_merge_ranked_docs
  WHERE rn = 1
    AND "ownerUserId" = p_source_user_id;

  SELECT COUNT(*) INTO v_soft_deleted_documents
  FROM hf_merge_ranked_docs
  WHERE rn > 1
    AND "emailIngestKey" IS NOT NULL
    AND "ownerUserId" = p_source_user_id;

  UPDATE "ParameterReading" pr
  SET
    "userId" = v_target_user_id,
    "documentId" = ranked.keeper_id
  FROM hf_merge_ranked_docs ranked
  WHERE ranked.rn > 1
    AND ranked."emailIngestKey" IS NOT NULL
    AND ranked."ownerUserId" = p_source_user_id
    AND pr."documentId" = ranked.id
    AND (
      pr."userId" <> v_target_user_id
      OR pr."documentId" <> ranked.keeper_id
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_moved_readings := v_moved_readings + v_rows;

  UPDATE "ParameterReading" pr
  SET "userId" = v_target_user_id
  WHERE (
      pr."userId" = p_source_user_id
      OR pr."documentId" IN (
        SELECT id
        FROM hf_merge_ranked_docs
        WHERE "ownerUserId" = p_source_user_id
      )
    )
    AND pr."userId" <> v_target_user_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_moved_readings := v_moved_readings + v_rows;

  UPDATE "Document" d
  SET "deletedAt" = timezone('utc', now())
  FROM hf_merge_ranked_docs ranked
  WHERE ranked.rn > 1
    AND ranked."emailIngestKey" IS NOT NULL
    AND ranked."ownerUserId" = p_source_user_id
    AND d.id = ranked.id;

  UPDATE "Document" d
  SET "ownerUserId" = v_target_user_id
  WHERE d.id IN (
    SELECT id
    FROM hf_merge_ranked_docs
    WHERE rn = 1
      AND "ownerUserId" = p_source_user_id
  )
    AND d."ownerUserId" = p_source_user_id
    AND d."deletedAt" IS NULL;
  GET DIAGNOSTICS v_updated_documents = ROW_COUNT;

  UPDATE "DoctorShare"
  SET "profileUserId" = v_target_user_id
  WHERE "ownerUserId" = v_owner_user_id
    AND "profileUserId" = p_source_user_id;
  GET DIAGNOSTICS v_updated_shares = ROW_COUNT;

  UPDATE "Export"
  SET "profileUserId" = v_target_user_id
  WHERE "userId" = v_owner_user_id
    AND "profileUserId" = p_source_user_id;
  GET DIAGNOSTICS v_updated_exports = ROW_COUNT;

  UPDATE "FamilyLink"
  SET
    status = 'revoked',
    "revokedAt" = timezone('utc', now())
  WHERE id = v_source_link_id;

  RETURN jsonb_build_object(
    'sourceProfileId', p_source_user_id,
    'targetProfileId', v_target_user_id,
    'revokedFamilyLinkId', v_source_link_id,
    'preservedDocuments', v_preserved_documents,
    'movedDocuments', v_updated_documents,
    'softDeletedDuplicateDocuments', v_soft_deleted_documents,
    'movedReadings', v_moved_readings,
    'updatedShares', v_updated_shares,
    'updatedExports', v_updated_exports
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_managed_profile(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_managed_profile(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_managed_profile(text, text) TO authenticated;
