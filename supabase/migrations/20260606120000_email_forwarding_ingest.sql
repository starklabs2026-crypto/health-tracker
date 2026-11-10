-- Per-user forwarding aliases for inbound email document ingestion.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "inboundEmailAlias" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_inboundEmailAlias_key"
ON "User"(lower("inboundEmailAlias"))
WHERE "inboundEmailAlias" IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_inbound_email_alias()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text;
  v_existing text;
  v_alias text;
BEGIN
  v_user_id := public.current_app_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'HealthFolio profile not found for authenticated user'
      USING ERRCODE = '42501';
  END IF;

  SELECT "inboundEmailAlias"
  INTO v_existing
  FROM "User"
  WHERE id = v_user_id;

  IF v_existing IS NOT NULL AND length(trim(v_existing)) > 0 THEN
    RETURN lower(v_existing);
  END IF;

  LOOP
    v_alias := 'hf-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18));

    BEGIN
      UPDATE "User"
      SET "inboundEmailAlias" = v_alias
      WHERE id = v_user_id
        AND (
          "inboundEmailAlias" IS NULL
          OR length(trim("inboundEmailAlias")) = 0
        );

      RETURN v_alias;
    EXCEPTION
      WHEN unique_violation THEN
        -- Extremely unlikely; retry with a new random alias.
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_inbound_email_alias()
TO authenticated;
