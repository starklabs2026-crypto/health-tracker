-- Normalize empty Supabase Auth claims before writing unique nullable fields.

CREATE OR REPLACE FUNCTION public.upsert_app_user_profile(
  p_name text DEFAULT NULL,
  p_dob timestamptz DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_units_preference text DEFAULT NULL,
  p_blood_group text DEFAULT NULL,
  p_has_blood_group boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id text := auth.uid()::text;
  v_email text := NULLIF(auth.jwt() ->> 'email', '');
  v_phone text := NULLIF(auth.jwt() ->> 'phone', '');
  v_user_id text;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT u.id
  INTO v_user_id
  FROM "User" u
  WHERE u."authUserId" = v_auth_user_id
     OR u.id = v_auth_user_id
  LIMIT 1;

  IF v_user_id IS NULL AND v_email IS NOT NULL THEN
    SELECT u.id
    INTO v_user_id
    FROM "User" u
    WHERE u.email = v_email
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    INSERT INTO "User" (
      id,
      "authUserId",
      email,
      phone,
      name,
      dob,
      sex,
      "unitsPreference",
      "bloodGroup",
      "residencyRegion"
    )
    VALUES (
      v_auth_user_id,
      v_auth_user_id,
      v_email,
      v_phone,
      COALESCE(NULLIF(TRIM(p_name), ''), ''),
      COALESCE(p_dob, to_timestamp(0)),
      COALESCE(p_sex, 'other'),
      COALESCE(p_units_preference, 'metric'),
      CASE WHEN p_has_blood_group THEN p_blood_group ELSE NULL END,
      'US'
    )
    RETURNING id INTO v_user_id;
  ELSE
    UPDATE "User"
    SET
      "authUserId" = v_auth_user_id,
      email = COALESCE("User".email, v_email),
      phone = COALESCE("User".phone, v_phone),
      name = COALESCE(NULLIF(TRIM(p_name), ''), "User".name),
      dob = COALESCE(p_dob, "User".dob),
      sex = COALESCE(p_sex, "User".sex),
      "unitsPreference" = COALESCE(p_units_preference, "User"."unitsPreference"),
      "bloodGroup" = CASE
        WHEN p_has_blood_group THEN p_blood_group
        ELSE "User"."bloodGroup"
      END
    WHERE id = v_user_id;
  END IF;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_app_user_profile(
  text,
  timestamptz,
  text,
  text,
  text,
  boolean
) TO authenticated;
