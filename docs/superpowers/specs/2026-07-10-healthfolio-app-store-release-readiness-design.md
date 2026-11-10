# HealthFolio App Store Release Readiness Design

Date: 2026-07-10

## Objective

Prepare HealthFolio for its first App Store review by adding verifiable user consent and account deletion, aligning public legal pages and App Store metadata with actual behavior, testing the highest-risk user and backend paths, and shipping a reviewed iOS build through EAS.

The active iOS product surface is the SwiftUI app under `apps/mobile/ios/HealthFolio/SwiftUIPrototype`. React Native compatibility files must continue to typecheck, but they are not the source of truth for App Store screenshots or reviewer flows.

## Release Posture

- Version: `1.0.0`
- Next iOS build: `73`
- Bundle identifier: `com.starklabs.healthfolio`
- App Store Connect app ID: `6773293787`
- Primary category: Medical
- Secondary category: Health & Fitness
- Medical or treatment information: Frequent, yielding the current Apple 16+ global rating unless App Store Connect calculates a stricter regional rating
- Regulated medical device declaration: No for the US, UK, and EU/EEA
- EULA: Apple's standard EULA; no custom EULA
- Advertising: None
- Cross-app tracking: None
- App purpose: Personal health-record organization, OCR, trends, medication/reminder organization, export, and user-controlled sharing
- Medical position: Not a diagnostic, treatment-recommendation, emergency, or clinical decision-support product
- Encryption declaration: Uses only exempt encryption provided by the operating system and HTTPS libraries; `ITSAppUsesNonExemptEncryption` remains false

The Digital Services Act trader status, App Review contact identity, phone number, release countries, and legal-entity enrollment must be confirmed from the Apple account before the final App Review submission action. These are account-holder facts and must not be guessed from source code.

## Scope

### Included

- Versioned privacy and health-data consent for new and existing accounts
- SwiftUI consent UI for email, Apple, and Google account creation
- A blocking consent gate for signed-in users who have not accepted the current version
- Privacy and consent settings with policy links and accepted-version status
- SwiftUI account deletion with explicit confirmation and clear consequences
- A retryable, authenticated Supabase account-deletion function
- A reproducible deletion test plus a live synthetic-account verification
- Public privacy, support, and privacy-choices/account-deletion pages
- App Store product metadata and form answer sheets
- App Store screenshot generation from the real SwiftUI app
- Reviewer account and reviewer instructions without committing credentials
- OCR, email ingestion, sharing, export, authentication, and deletion smoke coverage
- Independent code review by SwiftUI, backend/data-integrity, and release-policy reviewers
- Build 73 EAS production build and App Store Connect upload

### Excluded

- New medical analysis features
- A custom legal agreement or jurisdiction-specific legal drafting
- Subscription or in-app purchase work
- Android release work
- Broad redesigns unrelated to consent, deletion, submission, or bugs found by release review
- Rewriting the app or replacing the current Supabase architecture

## Consent Design

### Consent Contract

The current consent bundle has one immutable version identifier, initially `2026-07-10`. It covers:

- HealthFolio Privacy Policy
- Processing and storage of user-provided health information for app functionality
- User-controlled sharing through doctor-share links and managed profiles
- Use of service providers for authentication, storage, OCR, and app operation
- Apple's standard EULA
- The medical and emergency disclaimer

Consent is required for account creation and continued signed-in use. It is not requested for returning-user sign-in before authentication because the app must first determine whether the account already has current consent.

### Data Model

Add a `UserConsent` table keyed by app user and consent version. Each record contains:

- `id`
- `userId`
- `consentVersion`
- `privacyPolicyVersion`
- `eulaType`
- `healthDataProcessingAccepted`
- `acceptedAt`
- `source` (`ios_email`, `ios_apple`, `ios_google`, or `ios_existing_user`)
- `createdAt`

The table uses a unique constraint on `(userId, consentVersion)`, cascades when the user is deleted, and has row-level security limited to the authenticated account owner. Authenticated users receive explicit `SELECT` and column-limited `INSERT` grants only; they cannot update or delete consent rows. RLS resolves the authenticated user through `current_app_user_id()`, acceptance timestamps are database-generated, and checks restrict writes to the current consent/privacy versions, Apple's standard EULA, accepted health-data processing, and the four supported iOS sources. No public `SECURITY DEFINER` consent RPC is added.

The current consent status is fetched before the app exposes signed-in health data. Repeated acceptance is idempotent and does not create duplicate rows.

### New Account UX

On the `I'm new` screen:

- Show an unchecked consent control below the authentication fields and above account-creation actions.
- Link `Privacy Policy` to the public HealthFolio policy.
- Link `Standard EULA` to Apple's official standard EULA.
- State that HealthFolio stores and processes health records to provide app functionality and is not a medical or emergency service.
- Disable email, Apple, and Google account-creation actions until consent is checked.
- Keep returning-user sign-in independent from this pre-auth control.

After successful account creation, the app records the accepted consent version before showing the dashboard or first-launch guide. If recording consent fails, the app shows a retryable blocking consent screen; it does not silently continue.

### Existing Account UX

After authentication, HealthFolio checks for the current consent version. If it is missing, a non-dismissible consent screen appears before the main tabs. The user can:

- Review the Privacy Policy and Standard EULA
- Accept and continue
- Sign out

Password recovery remains available and is not obstructed by the consent gate. The first-launch guide starts only after consent is current.

### Withdrawal

Profile contains a `Privacy & consent` section showing the current accepted version and links to both policies. Because HealthFolio cannot provide its account-based health-record functionality without processing account and health data, withdrawing consent routes to the account-deletion flow. The public privacy-choices page also explains export, correction, consent withdrawal, and deletion options.

## Account Deletion Design

### SwiftUI Flow

Profile includes an easy-to-find `Delete account and data` action. Opening it presents a dedicated confirmation view that lists the data removed:

- Authentication account
- Main and managed profiles
- Uploaded and emailed documents
- Extracted and manually entered readings
- Doctor-share links and access records
- Exports and stored files
- Consent and app-specific account records

The user must enable an acknowledgement and then choose `Permanently delete account`. The destructive action displays progress and cannot be submitted twice. Cancel remains available until deletion starts.

On success, all local session, profile, upload, care, and assistant state is cleared immediately and the app returns to the signed-out welcome screen. On failure, the user remains signed in where possible and receives a retryable error with a support link.

### Backend Guarantees

The `delete-account` Edge Function remains authenticated with the caller's bearer token and performs these phases:

1. Resolve the Supabase auth user and any matching app user.
2. Collect main and managed profile IDs, identifiers, and referenced storage objects.
3. Remove storage objects from known prefixes and explicit database references.
4. Delete application data through controlled database operations and cascades.
5. Revoke all refresh sessions for the authenticated user.
6. Delete the Supabase auth user.
7. Return a success response without personal data.

The function must be retryable after a partial failure. In particular, a retry must still delete the auth user if application rows were already removed. Missing storage paths and already-removed rows are treated as successful no-ops. Authentication, authorization, and unexpected database failures remain errors.

The function must never delete an independently authenticated family member. Only managed profiles without their own auth identity, email, or phone are included.

Because a revoked or deleted Supabase user's access-token JWT remains valid until its expiry, Storage RLS must also require a current app-user mapping in addition to the matching auth-user path. This prevents a stale token from creating new storage objects after account deletion. App-table policies already resolve ownership through `current_app_user_id()`.

### Deletion Verification

A reproducible test script creates a uniquely named synthetic user and verifies:

- Signup and session creation
- App user and current consent creation
- Synthetic document/readings/share/export/storage data creation where credentials permit
- Successful invocation of `delete-account`
- Reauthentication failure after deletion
- No residual app user, managed profile, consent, document, reading, share, export, audit, or storage records when service-role verification is available
- Idempotent handling of a simulated partial-deletion state

The script accepts credentials only through environment variables, never logs passwords or service-role keys, uses a unique run ID, and cleans up any residual synthetic data after a failed test.

## Public Legal Pages

The GitHub Pages site on the `gh-pages` branch remains the public legal host. Source copies and a deterministic publish script are added to the main code branch so future updates are reproducible.

Required pages:

- `/privacy/`: data collected, purposes, service providers, sharing, retention, security, consent withdrawal, deletion, medical disclaimer, and contact information
- `/support/`: support contact, reviewer/user help, privacy requests, and emergency notice
- `/privacy-choices/`: export, correction, consent withdrawal, and account deletion instructions, including the in-app path

The pages must not promise stronger deletion or retention behavior than the tested backend provides. All links are checked for HTTPS success before release.

## App Store Submission Package

Add a version-controlled package under `docs/app-store/1.0.0/` containing no credentials:

- `metadata.md`: name, subtitle, promotional text, description, keywords, categories, URLs, copyright, and release settings
- `privacy-label.md`: each collected data type, whether linked to identity, purpose, and tracking answer
- `age-rating.md`: questionnaire answers and expected 16+ result
- `regulated-medical-device.md`: non-device rationale and declarations for US, UK, and EU/EEA
- `review-notes.md`: reviewer navigation, consent, OCR, email ingestion, sharing, export, deletion, and medical disclaimer instructions
- `submission-checklist.md`: App Information, pricing/availability, DSA, content rights, encryption, screenshots, build selection, and review submission status
- `testflight-notes.md`: concise beta description and test focus
- `screenshots/`: final approved PNGs and a manifest describing device size, screen, and data provenance

### Privacy Label

The expected declaration is data collected and linked to the user for app functionality, with no tracking:

- Name
- Email address
- User ID/account identifier
- Health data
- Photos or videos selected as medical records
- User content/files and document metadata
- Other data supplied in profile, reminders, notes, and support interactions where applicable
- Diagnostics only if the shipped binary or service actually stores diagnostic data

No advertising, marketing, data-broker sharing, or cross-app tracking is declared. Third-party authentication, hosting, storage, and OCR processing are described as service providers acting for app functionality.

### Screenshots

Generate screenshots from the real SwiftUI build using synthetic, non-PHI demo data. The minimum set covers:

- Today health overview
- Records and upload status
- Trends
- Care reminders
- Grounded assistant response with sources
- Profile/privacy/sharing controls

Use Apple's required highest-resolution iPhone portrait size supported by the current submission form, and let App Store Connect scale down where permitted. Screenshots must not show TestFlight chrome, real names, real health documents, email addresses, or credentials.

### Reviewer Account

Create a dedicated synthetic reviewer account with non-sensitive data. Store its password outside git, preferably in macOS Keychain, and enter it directly into App Store Connect. The account must not expire during review. Review notes explain that Apple and Google sign-in are available but the supplied email/password account is the deterministic path.

## Release Test Matrix

### Automated Gates

- `git diff --check`
- `plutil -lint apps/mobile/ios/HealthFolio/Info.plist`
- Swift parse/type checks for changed SwiftUI files
- Existing onboarding and build 72 regression tests
- New consent-policy unit tests
- New account-deletion regression tests
- Mobile TypeScript typecheck and lint
- Relevant workspace package builds
- Supabase migration checks and Edge Function bundle/check
- Secret and generated-artifact scan of staged files
- Native workspace build from a no-space `/tmp` snapshot

### Backend Smoke Tests

- Email/password auth and session restoration
- Consent create/read/idempotency
- Manual document upload and OCR
- Forwarded-email ingestion and deduplication
- Unsupported-document error path
- Doctor-share create/open/revoke
- Health-summary export
- Full account deletion and residual-data audit

All live tests use synthetic data and remove it afterward.

### Device/TestFlight Checks

- `I'm new` consent gating for email, Apple, and Google
- Existing-user consent gate and sign-out option
- First-launch guide after consent
- Camera, Photos, and Files upload permissions
- OCR result visibility in Records and Trends
- Email forwarding alias and ingested record visibility
- Share sheet and doctor-share access
- Account deletion confirmation, progress, success, and relaunch state
- Privacy, support, EULA, and privacy-choices links
- No microphone permission prompt
- VoiceOver labels, Dynamic Type, keyboard avoidance, and destructive-action accessibility

## Code Review Process

After implementation, use independent read-only reviewers with non-overlapping focus:

- SwiftUI reviewer: state transitions, consent/deletion UX, accessibility, concurrency, and active-target wiring
- Supabase reviewer: authorization, RLS, SQL grants, deletion completeness, idempotency, storage cleanup, and synthetic test safety
- Release reviewer: App Store metadata consistency, privacy claims, permissions, screenshots, version/build alignment, and secret/generated-file audit

All P0 and P1 findings are fixed and receive targeted regression coverage before release. P2 findings that are deferred are documented explicitly with rationale.

## Commit And Deployment Strategy

Use explicit staging and coherent commits:

1. Design and implementation plan
2. Supabase consent and account-deletion hardening with tests
3. SwiftUI consent and account-deletion UX with tests
4. Public legal pages and deterministic publishing support
5. App Store metadata, screenshots, and release documentation
6. Build 73 version bump and final release notes

Deploy Supabase migrations and Edge Functions before the mobile build so TestFlight exercises the final backend contract. Publish legal pages before filling URLs in App Store Connect.

Create the EAS build from a clean no-space snapshot under `/tmp`, verify the returned binary is `1.0.0 (73)`, and submit that exact EAS build ID to App Store Connect. EAS upload does not replace the App Store metadata and App Review submission steps.

## Acceptance Criteria

- New accounts cannot be created without explicit current consent.
- Existing accounts without current consent cannot access health data until they accept or sign out.
- Consent acceptance is versioned, server-recorded, idempotent, and deleted with the account.
- Account deletion is easy to find, transparent, permanent, and retryable.
- The live synthetic deletion test proves auth removal and verifies residual data where administrative verification is available.
- Public legal pages match tested app and backend behavior.
- App Store privacy, age rating, medical-device, EULA, encryption, and metadata answers are internally consistent.
- No credential, reviewer password, service-role key, PHI, or real patient screenshot is committed.
- Independent reviewers report no unresolved P0/P1 findings.
- All automated release gates pass from the no-space snapshot.
- EAS produces and submits HealthFolio `1.0.0 (73)` to App Store Connect.
- The final handoff records commit hashes, backend deployments, test evidence, build and submission URLs, form completion state, and any account-holder-only actions remaining.
