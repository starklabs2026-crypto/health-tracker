-- App profiles are created through upsert_app_user_profile, which verifies the
-- backing Auth identity. Direct inserts would let a revoked-but-unexpired JWT
-- recreate its public profile after account deletion.

DROP POLICY IF EXISTS user_insert_own ON public."User";
