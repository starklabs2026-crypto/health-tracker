-- Mirror of the migration applied to the live HealthFolio project.
-- Authenticated keeps EXECUTE on purpose: RLS and storage policies call
-- can_access_user, can_manage_user, and current_app_user_id, and the app
-- calls the other five as RPCs (including merge_managed_profile from Swift).

ALTER FUNCTION public.can_access_user(text) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.can_access_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_user(text) TO authenticated, service_role;

ALTER FUNCTION public.can_manage_user(text) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.can_manage_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_user(text) TO authenticated, service_role;

ALTER FUNCTION public.current_app_user_id() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, service_role;

ALTER FUNCTION public.upsert_app_user_profile(text, timestamptz, text, text, text, boolean) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.upsert_app_user_profile(text, timestamptz, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_app_user_profile(text, timestamptz, text, text, text, boolean) TO authenticated, service_role;

ALTER FUNCTION public.ensure_inbound_email_alias() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.ensure_inbound_email_alias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_inbound_email_alias() TO authenticated, service_role;

ALTER FUNCTION public.claim_inbound_email_alias(text) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.claim_inbound_email_alias(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_inbound_email_alias(text) TO authenticated, service_role;

ALTER FUNCTION public.create_managed_profile(text, timestamptz, text, text, text, text) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.create_managed_profile(text, timestamptz, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_managed_profile(text, timestamptz, text, text, text, text) TO authenticated, service_role;

ALTER FUNCTION public.merge_managed_profile(text, text) SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.merge_managed_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_managed_profile(text, text) TO authenticated, service_role;
