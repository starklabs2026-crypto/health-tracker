CREATE OR REPLACE FUNCTION public.can_access_user(p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN p_user_id = public.current_app_user_id() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM "FamilyLink" fl
      WHERE fl.status = 'active'
        AND (
          (fl."ownerUserId" = public.current_app_user_id() AND fl."memberUserId" = p_user_id)
          OR (fl."memberUserId" = public.current_app_user_id() AND fl."ownerUserId" = p_user_id)
        )
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user(p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN p_user_id = public.current_app_user_id() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM "FamilyLink" fl
      WHERE fl.status = 'active'
        AND fl."ownerUserId" = public.current_app_user_id()
        AND fl."memberUserId" = p_user_id
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.create_managed_profile(
  p_name text,
  p_dob timestamptz,
  p_sex text,
  p_units_preference text DEFAULT 'metric',
  p_blood_group text DEFAULT NULL,
  p_residency_region text DEFAULT 'US'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_user_id text;
  v_profile_user_id text;
BEGIN
  v_owner_user_id := public.current_app_user_id();
  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  v_profile_user_id := gen_random_uuid()::text;

  INSERT INTO "User" (
    id,
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
    v_profile_user_id,
    NULL,
    NULL,
    btrim(p_name),
    p_dob,
    p_sex,
    p_units_preference,
    p_blood_group,
    p_residency_region
  );

  INSERT INTO "HealthProfile" (
    "userId",
    height,
    weight,
    "knownConditions",
    allergies,
    "currentMedications"
  )
  VALUES (
    v_profile_user_id,
    NULL,
    NULL,
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  );

  INSERT INTO "FamilyLink" (
    "ownerUserId",
    "memberUserId",
    role,
    permissions,
    status,
    "acceptedAt"
  )
  VALUES (
    v_owner_user_id,
    v_profile_user_id,
    'guardian',
    '{"docTypes":["lab_report","prescription","imaging_report","discharge_summary","vaccination_record","other"]}'::jsonb,
    'active',
    timezone('utc', now())
  );

  RETURN v_profile_user_id;
END;
$$;

DROP POLICY IF EXISTS "user_select_own" ON "User";
CREATE POLICY "user_select_accessible"
ON "User"
FOR SELECT
TO authenticated
USING (public.can_access_user(id));

DROP POLICY IF EXISTS "user_update_own" ON "User";
CREATE POLICY "user_update_manageable"
ON "User"
FOR UPDATE
TO authenticated
USING (public.can_manage_user(id))
WITH CHECK (public.can_manage_user(id));

DROP POLICY IF EXISTS "health_profile_owner_all" ON "HealthProfile";
CREATE POLICY "health_profile_select_accessible"
ON "HealthProfile"
FOR SELECT
TO authenticated
USING (public.can_access_user("userId"));

CREATE POLICY "health_profile_insert_manageable"
ON "HealthProfile"
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_user("userId"));

CREATE POLICY "health_profile_update_manageable"
ON "HealthProfile"
FOR UPDATE
TO authenticated
USING (public.can_manage_user("userId"))
WITH CHECK (public.can_manage_user("userId"));

CREATE POLICY "health_profile_delete_manageable"
ON "HealthProfile"
FOR DELETE
TO authenticated
USING (public.can_manage_user("userId"));

DROP POLICY IF EXISTS "document_owner_all" ON "Document";
CREATE POLICY "document_select_accessible"
ON "Document"
FOR SELECT
TO authenticated
USING (public.can_access_user("ownerUserId"));

CREATE POLICY "document_insert_manageable"
ON "Document"
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_user("ownerUserId")
  AND "uploadedByUserId" = public.current_app_user_id()
);

CREATE POLICY "document_update_manageable"
ON "Document"
FOR UPDATE
TO authenticated
USING (public.can_manage_user("ownerUserId"))
WITH CHECK (public.can_manage_user("ownerUserId"));

CREATE POLICY "document_delete_manageable"
ON "Document"
FOR DELETE
TO authenticated
USING (public.can_manage_user("ownerUserId"));

DROP POLICY IF EXISTS "reading_owner_all" ON "ParameterReading";
CREATE POLICY "reading_select_accessible"
ON "ParameterReading"
FOR SELECT
TO authenticated
USING (public.can_access_user("userId"));

CREATE POLICY "reading_insert_manageable"
ON "ParameterReading"
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_user("userId")
  AND "createdByUserId" = public.current_app_user_id()
);

CREATE POLICY "reading_update_manageable"
ON "ParameterReading"
FOR UPDATE
TO authenticated
USING (public.can_manage_user("userId"))
WITH CHECK (public.can_manage_user("userId"));

CREATE POLICY "reading_delete_manageable"
ON "ParameterReading"
FOR DELETE
TO authenticated
USING (public.can_manage_user("userId"));
