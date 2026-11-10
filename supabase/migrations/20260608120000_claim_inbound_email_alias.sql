-- Let authenticated users claim a human-readable forwarding alias while keeping aliases unique.

ALTER TABLE "User"
DROP CONSTRAINT IF EXISTS "User_inboundEmailAlias_format_check";

ALTER TABLE "User"
ADD CONSTRAINT "User_inboundEmailAlias_format_check"
CHECK (
  "inboundEmailAlias" IS NULL
  OR "inboundEmailAlias" ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$'
);

CREATE OR REPLACE FUNCTION public.claim_inbound_email_alias(p_alias text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id text;
  v_alias text;
  v_conflict_user_id text;
BEGIN
  v_user_id := public.current_app_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'HealthFolio profile not found for authenticated user'
      USING ERRCODE = '42501';
  END IF;

  v_alias := lower(trim(coalesce(p_alias, '')));
  v_alias := regexp_replace(v_alias, '[._\s]+', '-', 'g');
  v_alias := regexp_replace(v_alias, '[^a-z0-9-]', '', 'g');
  v_alias := regexp_replace(v_alias, '-+', '-', 'g');
  v_alias := trim(both '-' from v_alias);

  IF v_alias !~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$' THEN
    RAISE EXCEPTION 'Alias must be 3 to 32 characters using lowercase letters, numbers, and hyphens'
      USING ERRCODE = '22023';
  END IF;

  SELECT id
  INTO v_conflict_user_id
  FROM "User"
  WHERE lower("inboundEmailAlias") = v_alias
    AND id <> v_user_id
  LIMIT 1;

  IF v_conflict_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'That forwarding alias is already taken'
      USING ERRCODE = '23505';
  END IF;

  BEGIN
    UPDATE "User"
    SET "inboundEmailAlias" = v_alias
    WHERE id = v_user_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'That forwarding alias is already taken'
        USING ERRCODE = '23505';
  END;

  RETURN v_alias;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_inbound_email_alias(text)
TO authenticated;
