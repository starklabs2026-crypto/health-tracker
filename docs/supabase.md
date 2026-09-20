# Supabase Backend Setup

HealthFolio is moving toward a Supabase-backed MVP:

- Supabase Auth for Apple, manual email/password auth, and backend session validation.
- Native Google Sign-In in mobile, with the Google ID token exchanged into a Supabase session.
- Supabase Postgres for app data.
- Supabase Storage for private medical documents and exports.
- Supabase Edge Functions for backend-only work such as OpenAI OCR.

The older Nest API/custom OTP backend still exists in the repo during migration, but the MVP target is to stop depending on it for the main mobile flow.

## Linked Project

This workspace is linked to the clean Supabase project:

- Project ref: `qojdeuacwkmlxmodeabt`
- Name: `starklabs85@gmail.com's Project`
- Region: South Asia (Mumbai)
- Public URL: `https://qojdeuacwkmlxmodeabt.supabase.co`
- Auth provider callback URL: `https://qojdeuacwkmlxmodeabt.supabase.co/auth/v1/callback`

The previously configured Codex Supabase MCP points at `gliprwhbrcfesfcmgxrp` (`GLP_Tracker`), which already has migrations and should not receive the HealthFolio schema.

## Auth Provider Setup

Configure only project `qojdeuacwkmlxmodeabt`.

Auth -> URL Configuration:

- Site URL: `healthfolio://auth/callback`
- Additional redirect URL: `healthfolio://auth/callback`

Auth -> Providers:

- Apple: enable the provider. Include native client ID `com.starklabs.healthfolio`. If browser OAuth fallback is used outside native iOS, also create an Apple Services ID such as `com.starklabs.healthfolio.web`, set its domain to `qojdeuacwkmlxmodeabt.supabase.co`, set its return URL to `https://qojdeuacwkmlxmodeabt.supabase.co/auth/v1/callback`, and configure the generated Apple client secret in Supabase.
- Google: enable the provider with a Google OAuth web client. In Google Cloud, add authorized redirect URI `https://qojdeuacwkmlxmodeabt.supabase.co/auth/v1/callback`. Because mobile uses native Google Sign-In, Supabase's Google `Client IDs` field should contain the Web client ID first, then the iOS client ID, comma-separated: `<web-client-id>,<ios-client-id>`. The `Client Secret` is the Web client secret only.

The iOS app uses native Sign in with Apple through `expo-apple-authentication`; Google uses Supabase OAuth and redirects back to `healthfolio://auth/callback` in production builds.

## Migration Model

The source schema lives in Prisma:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/`

The Supabase CLI applies mirrored SQL migrations from:

- `supabase/migrations/`

The seed file `supabase/seed.sql` loads the 80-parameter catalog into `ParameterCatalog`. Do not put demo users or PHI in the Supabase seed.

Current Supabase-specific backend additions:

- `User.authUserId` maps app profiles to Supabase Auth users.
- `medical-documents` private Storage bucket.
- `exports` private Storage bucket.
- Basic owner-only RLS policies for MVP tables.
- `process-document-ocr` Edge Function for OpenAI OCR.
- Database-side UUID defaults for direct Supabase inserts.
- Email-link RLS policy for claiming old OTP-created profiles by matching email.

## Apply To Supabase

```bash
npm run supabase:migrations
npm run supabase:push
```

`supabase:push` runs:

```bash
npx --yes supabase@2.101.0 db push --linked --include-seed
```

This applies all pending SQL migrations and the catalog seed to the linked Supabase project.

## Runtime Environment

For the older Nest API and worker, set:

```bash
DATABASE_URL=<Supabase pooled Postgres URL>
DIRECT_URL=<Supabase direct Postgres URL>
REDIS_URL=<managed Redis URL>
JWT_SECRET=<64+ random chars>
```

Use the pooled URL for `DATABASE_URL` at runtime. Keep `DIRECT_URL` available for Prisma migration workflows. Both values are secrets and should not be committed.

For Supabase Edge Functions, set:

```bash
npx --yes supabase@2.101.0 secrets set OPENAI_API_KEY=sk-...
npx --yes supabase@2.101.0 secrets set OPENAI_OCR_MODEL=gpt-4.1-mini
npx --yes supabase@2.101.0 secrets set DOCUMENT_BUCKET=medical-documents
```

`OPENAI_API_KEY` must stay server-side only. Do not put it in Expo config or `EXPO_PUBLIC_*` variables.

For Expo/mobile, set:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://qojdeuacwkmlxmodeabt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon/publishable key>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<Google iOS OAuth client id>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Google web OAuth client id>
```

The anon key is public by design. Get it from Supabase Dashboard -> Project Settings -> API.

Google sign-in should use the native Google SDK UI. Do not use `supabase.auth.signInWithOAuth({ provider: 'google' })` in mobile because that shows the Supabase-hosted OAuth flow. Native Google sign-in should call `supabase.auth.signInWithIdToken({ provider: 'google', token })` after receiving Google's ID token.

Google Cloud OAuth clients:

- iOS client Bundle ID: `com.starklabs.healthfolio`
- iOS client App Store ID: leave blank until App Store Connect creates the numeric Apple app ID.
- iOS client Team ID: optional unless enabling Google Identity for iOS App Check. If used, copy it from Apple Developer -> Membership details.
- Web client Authorized JavaScript origin: `https://qojdeuacwkmlxmodeabt.supabase.co`
- Web client Authorized redirect URI: `https://qojdeuacwkmlxmodeabt.supabase.co/auth/v1/callback`

For iOS builds, also replace the Google plugin placeholder in `apps/mobile/app.json`:

```json
[
  "@react-native-google-signin/google-signin",
  {
    "iosUrlScheme": "com.googleusercontent.apps.<reversed-google-ios-client-id>"
  }
]
```

## Storage Convention

Private medical documents should be stored at:

```text
medical-documents/<supabase-auth-user-id>/documents/<document-id>/<filename>
```

The matching `Document.fileUrl` should store either:

```text
<supabase-auth-user-id>/documents/<document-id>/<filename>
```

or:

```text
storage://medical-documents/<supabase-auth-user-id>/documents/<document-id>/<filename>
```

The OCR Edge Function accepts both forms.

## OCR Edge Function

Deploy:

```bash
npx --yes supabase@2.101.0 functions deploy process-document-ocr --project-ref qojdeuacwkmlxmodeabt
```

Invoke with a Supabase Auth bearer token:

```json
{
  "documentId": "document-row-id"
}
```

or queue a batch:

```json
{
  "documentIds": ["document-row-id-1", "document-row-id-2"]
}
```

The function:

1. Verifies the Supabase Auth user.
2. Resolves the HealthFolio `User` row through `authUserId`.
3. Marks each document queued and updates `ocrProgress`/`ocrStage` while processing.
4. Downloads the document from private Supabase Storage.
5. Sends the file to OpenAI with a strict JSON schema.
6. Validates results against `ParameterCatalog`.
7. Computes `rangeFlag` from backend catalog ranges.
8. Updates extracted report metadata such as `sourceDate` and `labName`.
9. Inserts pending readings and marks the document `ready_for_review`.

## Mobile Direct Supabase Flow

The mobile app now uses Supabase directly for the MVP profile/document/reading path:

1. Supabase Auth stores the session on-device.
2. New users create a HealthFolio `User` row during basic onboarding.
3. Document metadata is inserted into `Document`.
4. The file uploads directly to private Supabase Storage.
5. The app marks the document `queued`.
6. The app invokes `process-document-ocr`, either per document or with `documentIds` for a batch.
7. OCR writes pending readings into `ParameterReading`.
8. The document detail screen polls Supabase until status changes.

Remaining legacy API dependencies:

- Family invite/member flows.
- Doctor share link creation/revocation.
- PDF export.
- Old OTP screens, kept only during migration.

These should move to Edge Functions before removing the Nest API entirely.

## Security Defaults

All HealthFolio tables have row-level security enabled. The current MVP policies are owner-only, with family permissions intentionally kept simple until the family UX is finalized.

Public doctor-share reads and export generation should go through Edge Functions rather than direct anonymous table policies.
