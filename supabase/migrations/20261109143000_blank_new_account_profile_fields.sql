-- New accounts must not store a fake birthday or sex.
-- Foreign-key indexes and SECURITY DEFINER EXECUTE grants are applied
-- separately by the owner. Do not add those statements here.

ALTER TABLE public."User" ALTER COLUMN dob DROP NOT NULL;
ALTER TABLE public."User" ALTER COLUMN sex DROP NOT NULL;

UPDATE public."User"
SET sex = NULL
WHERE lower(sex) = 'other'
  AND dob IN (
    timestamptz '2000-01-01 00:00:00+00',
    timestamptz '1970-01-01 00:00:00+00'
  );

UPDATE public."User"
SET dob = NULL
WHERE dob IN (
  timestamptz '2000-01-01 00:00:00+00',
  timestamptz '1970-01-01 00:00:00+00'
);

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
  v_sex text := NULLIF(lower(btrim(coalesce(p_sex, ''))), '');
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
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

  IF EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u.id IS DISTINCT FROM v_user_id AND (
      (u.email = v_email AND (v_user_id IS NULL OR v_user.email IS NULL))
      OR (u.phone = v_phone AND (v_user_id IS NULL OR v_user.phone IS NULL))
    )
  ) THEN
    RAISE EXCEPTION 'profile_identity_conflict' USING ERRCODE = '42501';
  END IF;

  IF v_sex = 'not set' THEN
    v_sex := NULL;
  END IF;

  IF v_user_id IS NULL THEN
    INSERT INTO public."User" (id, "authUserId", email, phone, name, dob, sex,
      "unitsPreference", "bloodGroup", "residencyRegion")
    VALUES (v_auth_user_id, v_auth_user_id, v_email, v_phone,
      COALESCE(NULLIF(TRIM(p_name), ''), ''), p_dob, v_sex,
      COALESCE(p_units_preference, 'metric'),
      CASE WHEN p_has_blood_group THEN p_blood_group ELSE NULL END, 'US')
    RETURNING id INTO v_user_id;
  ELSE
    UPDATE public."User" SET
      "authUserId" = v_auth_user_id,
      email = COALESCE("User".email, v_email),
      phone = COALESCE("User".phone, v_phone),
      name = COALESCE(NULLIF(TRIM(p_name), ''), "User".name),
      dob = COALESCE(p_dob, "User".dob),
      sex = COALESCE(v_sex, "User".sex),
      "unitsPreference" = COALESCE(p_units_preference, "User"."unitsPreference"),
      "bloodGroup" = CASE WHEN p_has_blood_group THEN p_blood_group ELSE "User"."bloodGroup" END
    WHERE id = v_user_id;
  END IF;
  RETURN v_user_id;
END
$$;
