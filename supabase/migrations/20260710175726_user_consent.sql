CREATE TABLE public."UserConsent" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  "consentVersion" text NOT NULL,
  "privacyPolicyVersion" text NOT NULL,
  "eulaType" text NOT NULL CHECK ("eulaType" = 'apple_standard'),
  "healthDataProcessingAccepted" boolean NOT NULL CHECK ("healthDataProcessingAccepted"),
  source text NOT NULL CHECK (
    source IN ('ios_email', 'ios_apple', 'ios_google', 'ios_existing_user')
  ),
  "acceptedAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("userId", "consentVersion")
);

CREATE INDEX "UserConsent_userId_acceptedAt_idx"
ON public."UserConsent" ("userId", "acceptedAt" DESC);

ALTER TABLE public."UserConsent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_consent_select_own"
ON public."UserConsent"
FOR SELECT
TO authenticated
USING ("userId" = (SELECT public.current_app_user_id()));

CREATE POLICY "user_consent_insert_current"
ON public."UserConsent"
FOR INSERT
TO authenticated
WITH CHECK (
  "userId" = (SELECT public.current_app_user_id())
  AND "consentVersion" = '2026-07-10'
  AND "privacyPolicyVersion" = '2026-07-10'
  AND "eulaType" = 'apple_standard'
  AND "healthDataProcessingAccepted"
  AND source IN ('ios_email', 'ios_apple', 'ios_google', 'ios_existing_user')
);

REVOKE ALL ON TABLE public."UserConsent" FROM PUBLIC;
REVOKE ALL ON TABLE public."UserConsent" FROM anon;
REVOKE ALL ON TABLE public."UserConsent" FROM authenticated;

GRANT SELECT ON TABLE public."UserConsent" TO authenticated;
GRANT INSERT ("userId", "consentVersion", "privacyPolicyVersion", "eulaType", "healthDataProcessingAccepted", source) ON TABLE public."UserConsent" TO authenticated;
