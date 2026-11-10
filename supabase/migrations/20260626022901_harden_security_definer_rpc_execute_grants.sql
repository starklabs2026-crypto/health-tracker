-- Lock down security-definer helpers so they are not callable by anonymous
-- Data API clients. Client-facing profile helpers remain available only to
-- authenticated users; the OCR attempt counter is service-role only.

REVOKE EXECUTE ON FUNCTION public.current_app_user_id()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id()
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_user(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_user(text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_manage_user(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_user(text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_app_user_profile(
  text,
  timestamp with time zone,
  text,
  text,
  text,
  boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_app_user_profile(
  text,
  timestamp with time zone,
  text,
  text,
  text,
  boolean
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_managed_profile(
  text,
  timestamp with time zone,
  text,
  text,
  text,
  text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_managed_profile(
  text,
  timestamp with time zone,
  text,
  text,
  text,
  text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_inbound_email_alias()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_inbound_email_alias()
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.claim_inbound_email_alias(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_inbound_email_alias(text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.increment_document_ocr_attempts(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_document_ocr_attempts(text)
  TO service_role;
