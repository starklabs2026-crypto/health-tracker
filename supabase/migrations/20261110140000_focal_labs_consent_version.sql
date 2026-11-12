-- Allow the Focal Labs consent disclosure alongside the versions already accepted.
-- Existing 2026-07-10 and 2026-11-10 rows stay valid. The app asks again only
-- when its current version is 2026-11-10.2.

ALTER POLICY "user_consent_insert_current"
ON public."UserConsent"
WITH CHECK (
  "userId" = (SELECT public.current_app_user_id())
  AND "consentVersion" = "privacyPolicyVersion"
  AND "consentVersion" IN ('2026-07-10', '2026-11-10', '2026-11-10.2')
  AND "eulaType" = 'apple_standard'
  AND "healthDataProcessingAccepted"
  AND source IN ('ios_email', 'ios_apple', 'ios_google', 'ios_existing_user')
);
