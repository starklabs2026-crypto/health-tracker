-- Allow a newly authenticated Supabase user to claim an existing app profile
-- with the same email during migration from the custom OTP backend.

DROP POLICY IF EXISTS "user_select_own" ON "User";
CREATE POLICY "user_select_own"
ON "User"
FOR SELECT
TO authenticated
USING (
  "authUserId" = auth.uid()::text
  OR id = auth.uid()::text
  OR email = auth.jwt() ->> 'email'
);

DROP POLICY IF EXISTS "user_update_own" ON "User";
CREATE POLICY "user_update_own"
ON "User"
FOR UPDATE
TO authenticated
USING (
  "authUserId" = auth.uid()::text
  OR id = auth.uid()::text
  OR email = auth.jwt() ->> 'email'
)
WITH CHECK (
  "authUserId" = auth.uid()::text
  OR id = auth.uid()::text
);
