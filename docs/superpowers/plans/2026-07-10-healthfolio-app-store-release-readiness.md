# HealthFolio App Store Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auditable consent and complete account deletion, align HealthFolio's legal and App Store materials with tested behavior, then ship reviewed iOS build `1.0.0 (73)` through EAS and App Store Connect.

**Architecture:** Supabase stores immutable versioned consent and owns destructive account deletion. The active SwiftUI app gates new-account creation and signed-in access on current consent, exposes privacy controls and account deletion in Profile, and clears local state after deletion. Public legal pages and App Store metadata are generated from version-controlled sources, while live credentials and reviewer passwords remain outside git.

**Tech Stack:** SwiftUI, Swift concurrency, Supabase Auth/Postgres/Storage/Edge Functions, PostgreSQL migrations and RLS, Deno TypeScript, Node.js 20, Expo/EAS, Xcode/iOS Simulator, GitHub Pages, App Store Connect.

## Global Constraints

- Work in the real checkout at `/Users/nalinadityachaganti/Documents/health tracker`; do not create or replay the previously failed worktree.
- The active shipped iOS surface is `apps/mobile/ios/HealthFolio/SwiftUIPrototype`.
- Keep React Native compatibility code typechecking, but do not implement the primary UI in Expo Router.
- Use version `1.0.0` and next iOS build number `73`.
- Use Apple's standard EULA at `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`; do not add a custom EULA.
- Use consent version and privacy-policy version `2026-07-10`.
- Never commit credentials, service-role keys, reviewer passwords, PHI, real medical documents, or real patient screenshots.
- Use synthetic, clearly fictional data for tests, reviewer setup, and screenshots.
- Do not deploy migrations or Edge Functions until local tests and an independent backend review pass.
- Do not submit a build until P0/P1 review findings are fixed and the no-space release gate passes.
- Do not guess Digital Services Act trader status, Apple legal-entity enrollment, App Review phone number, or release-country declarations.
- Stage explicit paths and commit by ownership boundary.
- Create every new Supabase migration with `supabase migration new`; do not invent migration timestamps.

---

## File Map

### Backend consent

- Create `supabase/migrations/*_user_consent.sql` with `supabase migration new user_consent`: consent table, immutable RLS policies, and explicit grants.
- Modify `apps/api/prisma/schema.prisma`: mirror `UserConsent` and its cascade relationship.
- Create `scripts/test-healthfolio-consent-migration.mjs`: source-contract tests for table, RPCs, RLS, and grants.

### SwiftUI consent

- Create `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioConsentPolicy.swift`: versions, URLs, source enum, consent status, and gate policy.
- Create `apps/mobile/ios/HealthFolio/SwiftUIPrototype/ConsentNativeView.swift`: new-account disclosure and signed-in blocking consent view.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift`: read and record current consent.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`: consent state machine and authenticated-flow coordination.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AuthNativeView.swift`: gate email/Apple/Google account creation on explicit consent.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift`: block tabs until consent is current.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift`: privacy and consent status/settings.
- Modify `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`: compile the two new Swift files.
- Create `scripts/test-healthfolio-consent-policy.swift`: executable policy tests.

### Account deletion

- Create `supabase/functions/delete-account/deletion-utils.ts`: pure identity/storage/idempotency helpers.
- Create `supabase/functions/delete-account/deletion-utils.test.ts`: Deno unit tests.
- Modify `supabase/functions/delete-account/index.ts`: retry-safe deletion orchestration.
- Create `supabase/migrations/*_harden_storage_after_account_deletion.sql` with `supabase migration new harden_storage_after_account_deletion`: require a current app-user mapping in Storage RLS.
- Create `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AccountDeletionNativeView.swift`: destructive confirmation UI.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift`: invoke deletion.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`: deletion state and local cleanup.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanLocalStore.swift`: clear local care data.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift`: present deletion flow.
- Modify `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`: compile the deletion view.
- Create `scripts/smoke-test-account-deletion.mjs`: reproducible synthetic-user live test.

### Legal site and App Store package

- Create `docs/app-store-site/index.html`, `privacy/index.html`, `support/index.html`, and `privacy-choices/index.html`: public sources.
- Create `scripts/test-app-store-site.mjs`: local legal-page link/content tests.
- Create `scripts/publish-app-store-site.mjs`: deterministic temporary-clone publisher for `gh-pages`.
- Create `docs/app-store/1.0.0/metadata.md`, `privacy-label.md`, `age-rating.md`, `regulated-medical-device.md`, `review-notes.md`, `submission-checklist.md`, `testflight-notes.md`, and `screenshots/manifest.md`.
- Modify `docs/app-store-release.md`: replace the stale build-1 baseline with the build-73 process and exact package paths.

### Screenshot and release automation

- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioPreviewData.swift`: fictional screenshot-safe content.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`: `#if DEBUG` screenshot fixture mode.
- Modify `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift`: `#if DEBUG` initial screenshot tab selection.
- Create `scripts/capture-healthfolio-app-store-screenshots.sh`: build, launch, and capture each tab in the simulator.
- Create `scripts/test-healthfolio-build73-regressions.mjs`: release source-contract tests.
- Modify `package.json`: expose all new tests.
- Modify `apps/mobile/app.json`, `apps/mobile/ios/HealthFolio/Info.plist`, and `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`: remove unused microphone permission and synchronize build 73.
- Modify `docs/healthfolio-build60-functionality-restoration-handoff.md`: final evidence and links.

---

### Task 1: Add The Versioned Consent Schema

**Files:**
- Create: `scripts/test-healthfolio-consent-migration.mjs`
- Create: the timestamped `supabase/migrations/*_user_consent.sql` emitted by `supabase migration new user_consent`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `package.json`

**Interfaces:**
- Produces: immutable `public."UserConsent"` rows readable and insertable only by the matching authenticated app user.
- Produces: explicit Data API `SELECT` and column-limited `INSERT` grants for `authenticated`, with no `UPDATE` or `DELETE` grant.
- Produces: Prisma model `UserConsent` with `userId`, `consentVersion`, `privacyPolicyVersion`, `eulaType`, `healthDataProcessingAccepted`, `source`, `acceptedAt`, and `createdAt`.

- [ ] **Step 1: Write the failing migration contract test**

Create `scripts/test-healthfolio-consent-migration.mjs` with assertions that read the migration and Prisma schema, then require these exact contracts:

```js
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const migrationName = readdirSync('supabase/migrations').find((name) =>
  name.endsWith('_user_consent.sql'),
);
assert.ok(migrationName, 'user consent migration must be generated by the Supabase CLI');
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const prisma = readFileSync('apps/api/prisma/schema.prisma', 'utf8');

assert.match(migration, /CREATE TABLE public\."UserConsent"/);
assert.match(migration, /UNIQUE \("userId", "consentVersion"\)/);
assert.match(migration, /ALTER TABLE public\."UserConsent" ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /CREATE POLICY "user_consent_select_own"/);
assert.match(migration, /CREATE POLICY "user_consent_insert_current"/);
assert.match(migration, /GRANT SELECT ON TABLE public\."UserConsent" TO authenticated/);
assert.match(migration, /GRANT INSERT \("userId", "consentVersion", "privacyPolicyVersion", "eulaType", "healthDataProcessingAccepted", source\)/);
assert.doesNotMatch(migration, /GRANT (UPDATE|DELETE)/);
assert.doesNotMatch(migration, /SECURITY DEFINER/);
assert.match(prisma, /model UserConsent \{/);
assert.match(prisma, /onDelete: Cascade/);

console.log('HealthFolio consent migration contract tests passed.');
```

Add this script to the root `package.json`:

```json
"test:consent-migration": "node scripts/test-healthfolio-consent-migration.mjs"
```

- [ ] **Step 2: Run the test and confirm the intended failure**

Run:

```bash
npm run test:consent-migration
```

Expected: failure because no generated `_user_consent.sql` migration or Prisma model exists.

- [ ] **Step 3: Implement the migration**

Generate the migration first:

```bash
supabase migration new user_consent
```

In the emitted timestamped file, create the table with UUID primary key, a cascade reference to `public."User"(id)`, immutable acceptance timestamps, and this unique constraint:

```sql
CREATE TABLE public."UserConsent" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" text NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  "consentVersion" text NOT NULL,
  "privacyPolicyVersion" text NOT NULL,
  "eulaType" text NOT NULL CHECK ("eulaType" = 'apple_standard'),
  "healthDataProcessingAccepted" boolean NOT NULL CHECK ("healthDataProcessingAccepted"),
  source text NOT NULL CHECK (source IN ('ios_email', 'ios_apple', 'ios_google', 'ios_existing_user')),
  "acceptedAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("userId", "consentVersion")
);
```

Enable RLS and add a `SELECT` policy using `"userId" = (SELECT public.current_app_user_id())`. Add an `INSERT` policy using the same ownership check plus exact checks for consent/privacy version `2026-07-10`, EULA type `apple_standard`, accepted health-data processing, and the four supported iOS sources. Revoke all table privileges from `PUBLIC` and `anon`; grant `SELECT` plus `INSERT` only on the six user-supplied columns to `authenticated`. Do not grant `UPDATE` or `DELETE`, and do not create a consent `SECURITY DEFINER` function.

- [ ] **Step 4: Mirror the table in Prisma**

Add this relation to `User`:

```prisma
consents UserConsent[]
```

Add the model:

```prisma
model UserConsent {
  id                           String   @id @default(uuid()) @db.Uuid
  userId                       String
  consentVersion               String
  privacyPolicyVersion         String
  eulaType                     String
  healthDataProcessingAccepted Boolean
  source                       String
  acceptedAt                   DateTime @default(now())
  createdAt                    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, consentVersion])
  @@index([userId, acceptedAt(sort: Desc)])
}
```

- [ ] **Step 5: Run focused checks**

Run:

```bash
npm run test:consent-migration
npm -w apps/api run prisma:generate
git diff --check
```

Expected: all commands exit 0 and the generated Prisma client accepts the new relationship.

- [ ] **Step 6: Commit the consent schema**

```bash
git add package.json scripts/test-healthfolio-consent-migration.mjs supabase/migrations/*_user_consent.sql apps/api/prisma/schema.prisma
git commit -m "feat: add versioned health data consent"
```

---

### Task 2: Add Native Consent Policy And API Contracts

**Files:**
- Create: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioConsentPolicy.swift`
- Create: `scripts/test-healthfolio-consent-policy.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift`
- Modify: `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- Modify: `package.json`

**Interfaces:**
- Produces: `NativeConsentSource: String` with cases `email`, `apple`, `google`, and `existingUser` mapped to the SQL source values.
- Produces: `NativeConsentStatus` with `consentVersion`, `acceptedAt`, and `isCurrent`.
- Produces: `HealthFolioConsentPolicy.requiresBlockingGate(isSignedIn:hasCurrentConsent:isPasswordResetRequired:) -> Bool`.
- Produces: `NativeSupabaseAPI.currentConsentStatus(userId:) async throws -> NativeConsentStatus`.
- Produces: `NativeSupabaseAPI.recordCurrentConsent(userId:source:) async throws -> NativeConsentStatus`.

- [ ] **Step 1: Write the failing Swift policy test**

Create an executable `@main` test that asserts:

```swift
expect(HealthFolioConsentPolicy.consentVersion == "2026-07-10", "consent version changed unexpectedly")
expect(HealthFolioConsentPolicy.privacyPolicyVersion == "2026-07-10", "privacy version changed unexpectedly")
expect(NativeConsentSource.apple.rawValue == "ios_apple", "Apple source must match SQL")
expect(
    HealthFolioConsentPolicy.requiresBlockingGate(
        isSignedIn: true,
        hasCurrentConsent: false,
        isPasswordResetRequired: false
    ),
    "signed-in users without consent must be blocked"
)
expect(
    !HealthFolioConsentPolicy.requiresBlockingGate(
        isSignedIn: true,
        hasCurrentConsent: false,
        isPasswordResetRequired: true
    ),
    "password recovery must remain usable"
)
```

Add:

```json
"test:ios-consent": "swiftc apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioConsentPolicy.swift scripts/test-healthfolio-consent-policy.swift -o /tmp/healthfolio-consent-policy-tests && /tmp/healthfolio-consent-policy-tests"
```

- [ ] **Step 2: Run the test and confirm failure**

Run `npm run test:ios-consent`.

Expected: Swift compilation fails because `HealthFolioConsentPolicy.swift` is absent.

- [ ] **Step 3: Implement the policy types**

Create the file with these stable constants and behavior:

```swift
import Foundation

enum NativeConsentSource: String {
    case email = "ios_email"
    case apple = "ios_apple"
    case google = "ios_google"
    case existingUser = "ios_existing_user"
}

struct NativeConsentStatus: Decodable, Equatable {
    let consentVersion: String?
    let acceptedAt: Date?

    var isCurrent: Bool {
        consentVersion == HealthFolioConsentPolicy.consentVersion && acceptedAt != nil
    }

    static let missing = NativeConsentStatus(consentVersion: nil, acceptedAt: nil)
}

enum HealthFolioConsentPolicy {
    static let consentVersion = "2026-07-10"
    static let privacyPolicyVersion = "2026-07-10"
    static let privacyURL = URL(string: "https://starklabs2026-crypto.github.io/health-tracker/privacy/")!
    static let privacyChoicesURL = URL(string: "https://starklabs2026-crypto.github.io/health-tracker/privacy-choices/")!
    static let standardEULAURL = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!

    static func requiresBlockingGate(
        isSignedIn: Bool,
        hasCurrentConsent: Bool,
        isPasswordResetRequired: Bool
    ) -> Bool {
        isSignedIn && !hasCurrentConsent && !isPasswordResetRequired
    }
}
```

- [ ] **Step 4: Add NativeSupabaseAPI consent methods**

GET `/rest/v1/UserConsent` with the signed-in app user ID supplied as the `userId=eq.` filter, `consentVersion=eq.2026-07-10`, an explicit `select=consentVersion,acceptedAt`, and `limit=1`; decode the returned array and return `.missing` when empty. To record acceptance, first return an existing current row when present; otherwise POST one row to `/rest/v1/UserConsent` with the six granted columns and `Prefer: resolution=ignore-duplicates,return=representation`. If a concurrent insert makes the response empty, GET the current row again. Use the existing ISO-8601 decoder and authenticated session helper. The database supplies `id`, `acceptedAt`, and `createdAt`.

- [ ] **Step 5: Add the policy file to the Xcode target**

Add a `PBXFileReference`, `PBXBuildFile`, SwiftUIPrototype group entry, and Sources build-phase entry for `HealthFolioConsentPolicy.swift`. Do not alter unrelated project settings.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run test:ios-consent
swiftc -parse apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioConsentPolicy.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift
plutil -lint apps/mobile/ios/HealthFolio/Info.plist
git diff --check
```

Expected: all commands exit 0.

Commit:

```bash
git add package.json scripts/test-healthfolio-consent-policy.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioConsentPolicy.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj
git commit -m "feat: add native consent contract"
```

---

### Task 3: Implement The SwiftUI Consent State Machine

**Files:**
- Create: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/ConsentNativeView.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AuthNativeView.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift`
- Modify: `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- Create: `scripts/test-healthfolio-build73-regressions.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 2 policy types and Supabase methods.
- Produces: `HealthFolioAppModel.hasCurrentConsent`, `isRecordingConsent`, `consentStatus`, `acceptCurrentConsent(source:)`, and `refreshConsentStatus()`.
- Produces: `ConsentNativeView(mode:onAccept:onSignOut:)` with `.newAccount` and `.existingAccount` modes.

- [ ] **Step 1: Write failing build-73 source-contract tests**

Create `scripts/test-healthfolio-build73-regressions.mjs` and assert that:

```js
assert.match(authView, /hasAcceptedNewAccountConsent/);
assert.match(authView, /Privacy Policy/);
assert.match(authView, /Standard EULA/);
assert.match(authView, /mode == \.signUp && !hasAcceptedNewAccountConsent/);
assert.match(rootView, /HealthFolioConsentPolicy\.requiresBlockingGate/);
assert.match(rootView, /ConsentNativeView/);
assert.match(appModel, /func acceptCurrentConsent/);
assert.match(profileView, /Privacy & consent/);
```

Add:

```json
"test:build73-regressions": "node scripts/test-healthfolio-build73-regressions.mjs"
```

- [ ] **Step 2: Run and confirm failure**

Run `npm run test:build73-regressions`.

Expected: failure on the first missing consent UI contract.

- [ ] **Step 3: Add new-account consent disclosure**

In `AuthNativeView`, add `@State private var hasAcceptedNewAccountConsent = false`. Reset it whenever auth mode changes or the draft resets. For `.signUp`, render a `Toggle` and linked policy text. Disable all three account-creation actions when unchecked:

```swift
private func isAuthActionDisabled(_ mode: NativeAuthMode) -> Bool {
    model.isLoadingData || (mode == .signUp && !hasAcceptedNewAccountConsent)
}
```

Email signup calls `model.signUp(email:password:consentSource: .email)`. Apple and Google account creation pass `.apple` and `.google`. Returning-user actions do not pre-record consent.

- [ ] **Step 4: Implement model consent coordination**

Add published state initialized to `.missing`. After every authenticated dashboard response:

```swift
private func finishAuthenticatedFlow(
    _ snapshot: NativeDashboardSnapshot,
    acceptedConsentSource: NativeConsentSource?
) async throws {
    if let acceptedConsentSource {
        consentStatus = try await supabase.recordCurrentConsent(
            userId: snapshot.signedInProfile.id,
            source: acceptedConsentSource
        )
    } else {
        consentStatus = try await supabase.currentConsentStatus(
            userId: snapshot.signedInProfile.id
        )
    }
    apply(snapshot)
}
```

If recording new-account consent fails, preserve the session, apply the snapshot, set `.missing`, and present the blocking gate with a retry message. Signed-out reset restores `.missing`.

`acceptCurrentConsent(source:)` sets `isRecordingConsent`, records through the API, verifies `isCurrent`, clears the session message, and schedules the first-launch guide only after success.

- [ ] **Step 5: Add the blocking signed-in consent view**

Create `ConsentNativeView` as a full-screen SwiftUI view with:

- HealthFolio title and shield icon
- Health-data processing explanation
- Medical/emergency disclaimer
- Privacy Policy and Standard EULA links
- Required acknowledgement toggle
- `Agree and continue` button disabled until acknowledged or while saving
- `Sign out` secondary action for existing accounts

Use symbols, standard controls, 8-point-or-smaller card radii, Dynamic Type, and minimum 44-point targets. Do not allow swipe dismissal.

- [ ] **Step 6: Gate the root view and first-launch guide**

In `HealthFolioRootView`, order states as bootstrap, signed out, signed in with missing consent, and signed in with current consent. Use `HealthFolioConsentPolicy.requiresBlockingGate`. Prevent `FirstLaunchGuideOverlay` from appearing while the consent gate or password reset is active.

- [ ] **Step 7: Add Profile consent status**

Add a `Privacy & consent` section that shows the accepted date/version, opens privacy, privacy choices, and standard EULA URLs, and explains that withdrawing consent requires account deletion because the service cannot operate without processing account and health data.

- [ ] **Step 8: Add ConsentNativeView to Xcode and run tests**

Update the project file, then run:

```bash
npm run test:ios-consent
npm run test:ios-onboarding
npm run test:build72-regressions
npm run test:build73-regressions
swiftc -parse apps/mobile/ios/HealthFolio/SwiftUIPrototype/ConsentNativeView.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/AuthNativeView.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit the SwiftUI consent flow**

```bash
git add package.json scripts/test-healthfolio-build73-regressions.mjs apps/mobile/ios/HealthFolio/SwiftUIPrototype/ConsentNativeView.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/AuthNativeView.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj
git commit -m "feat: require health data consent"
```

---

### Task 4: Make Backend Account Deletion Retry-Safe

**Files:**
- Create: `supabase/functions/delete-account/deletion-utils.ts`
- Create: `supabase/functions/delete-account/deletion-utils.test.ts`
- Modify: `supabase/functions/delete-account/index.ts`
- Create: the timestamped `supabase/migrations/*_harden_storage_after_account_deletion.sql` emitted by `supabase migration new harden_storage_after_account_deletion`
- Modify: `scripts/test-healthfolio-build73-regressions.mjs`

**Interfaces:**
- Produces: `DeletionIdentity` containing auth identity and optional app user.
- Produces: `managedIdentityCanBeDeleted(identity) -> boolean`.
- Preserves: `POST /functions/v1/delete-account` response `{ ok: true }`.
- Produces: Storage RLS that requires both the matching auth-user path and a non-null `current_app_user_id()`.

- [ ] **Step 1: Write failing Deno unit tests**

Test pure helpers without network access:

```ts
Deno.test('managed profiles with independent identities are preserved', () => {
  assertEquals(managedIdentityCanBeDeleted({ authUserId: 'auth-1', email: null, phone: null }), false);
});

Deno.test('anonymous managed profiles are deletable', () => {
  assertEquals(managedIdentityCanBeDeleted({ authUserId: null, email: null, phone: null }), true);
});

Deno.test('storage references normalize storage URLs', () => {
  assertEquals(parseStorageReference('storage://medical-documents/u/report.pdf', 'exports'), {
    bucket: 'medical-documents',
    path: 'u/report.pdf',
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run:

```bash
deno test supabase/functions/delete-account/deletion-utils.test.ts
```

Expected: failure because the utility module does not exist.

- [ ] **Step 3: Extract pure helpers**

Move `unique` and `parseStorageReference` into `deletion-utils.ts`, add `managedIdentityCanBeDeleted`, and type all inputs explicitly. Keep the module free of environment reads, network calls, and `Deno.serve` so tests remain deterministic.

- [ ] **Step 4: Make identity resolution tolerate missing app rows**

Replace the required app-user resolver with:

```ts
type DeletionIdentity = {
  authUserId: string;
  authEmail: string | null;
  authPhone: string | null;
  appUser: AppUser | null;
};
```

The bearer token and Supabase auth user remain mandatory. If no app user exists, continue with `userIds = []`, remove storage under the auth-user prefix, and delete the auth user. This makes retry possible after a prior attempt removed database rows but failed at auth deletion.

- [ ] **Step 5: Keep independently authenticated family members**

Use `managedIdentityCanBeDeleted` when selecting managed profile IDs. Add a source-contract assertion that requires this helper in `managedProfileIds`.

- [ ] **Step 6: Revoke refresh sessions before deleting auth**

After storage and app-data deletion, call `admin.auth.admin.signOut(token, 'global')` and fail the request if session revocation fails for a still-existing auth user. Then call `admin.auth.admin.deleteUser(authUserId)`. The mobile client clears its saved access/refresh tokens after success; app-table RLS denies the old access token because its app-user mapping no longer exists.

- [ ] **Step 7: Harden Storage RLS against stale access tokens**

Generate the migration:

```bash
supabase migration new harden_storage_after_account_deletion
```

In the generated file, drop and recreate `medical_documents_owner_all` and `exports_owner_all`. Preserve their bucket/path checks and add `(SELECT public.current_app_user_id()) IS NOT NULL` to both `USING` and `WITH CHECK`. Add source-contract assertions that find the generated migration and require this predicate in both policies.

- [ ] **Step 8: Run backend checks**

Run:

```bash
deno test supabase/functions/delete-account/deletion-utils.test.ts
supabase functions serve delete-account --env-file supabase/.env.local
```

For the second command, confirm the function bundles and starts, then stop it without invoking live deletion. If `supabase/.env.local` is absent, run `supabase functions serve delete-account --no-verify-jwt` only to prove bundling and stop before requests.

- [ ] **Step 9: Commit backend hardening**

```bash
git add supabase/functions/delete-account/index.ts supabase/functions/delete-account/deletion-utils.ts supabase/functions/delete-account/deletion-utils.test.ts supabase/migrations/*_harden_storage_after_account_deletion.sql scripts/test-healthfolio-build73-regressions.mjs
git commit -m "fix: make account deletion retry safe"
```

---

### Task 5: Add SwiftUI Account Deletion

**Files:**
- Create: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AccountDeletionNativeView.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanLocalStore.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift`
- Modify: `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- Modify: `scripts/test-healthfolio-build73-regressions.mjs`

**Interfaces:**
- Produces: `NativeSupabaseAPI.deleteAccount() async throws`.
- Produces: `HealthFolioAppModel.deleteAccount() async -> Bool` and `isDeletingAccount`.
- Produces: `CarePlanLocalStore.clear()`.

- [ ] **Step 1: Extend failing source-contract tests**

Require these contracts:

```js
assert.match(nativeAPI, /func deleteAccount\(\) async throws/);
assert.match(appModel, /func deleteAccount\(\) async -> Bool/);
assert.match(profileView, /Delete account and data/);
assert.match(deletionView, /Permanently delete account/);
assert.match(deletionView, /This cannot be undone/);
assert.match(careStore, /static func clear\(\)/);
```

Run `npm run test:build73-regressions` and confirm failure.

- [ ] **Step 2: Add the native deletion API**

Use the existing authenticated session and request helper:

```swift
func deleteAccount() async throws {
    let session = try await authenticatedSession()
    let data = try await request(
        path: "/functions/v1/delete-account",
        method: "POST",
        session: session,
        body: ["confirm": true]
    )
    let response = try decoder.decode(DeleteAccountResponse.self, from: data)
    guard response.ok else {
        throw NativeSupabaseError.backend("Account deletion did not complete.")
    }
}
```

- [ ] **Step 3: Implement local cleanup in the model**

Guard duplicate submissions, invoke the API, then clear session-backed and local stores. Add `CarePlanLocalStore.clear()`, call existing assistant clearing, cancel pending local notifications for care items, and reset the model with `sessionMessage = "Your account and HealthFolio data were deleted."`. Always clear the saved Supabase session after a successful server response.

- [ ] **Step 4: Build the destructive confirmation view**

Create a dedicated view with a concise data-removal list, an acknowledgement toggle, support link, progress state, cancel button, and destructive button. Disable interactive dismissal and all duplicate actions while deletion runs. Use an alert for failure and keep the user in the confirmation screen so they can retry.

- [ ] **Step 5: Present deletion from Profile**

Add a separate `Delete account` section after `Privacy & consent`, not inside general Actions. Present the view only for signed-in users. Do not duplicate sign-out actions in the same section.

- [ ] **Step 6: Add the file to Xcode and verify**

Run:

```bash
npm run test:build73-regressions
swiftc -parse apps/mobile/ios/HealthFolio/SwiftUIPrototype/AccountDeletionNativeView.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanLocalStore.swift
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit the native deletion flow**

```bash
git add apps/mobile/ios/HealthFolio/SwiftUIPrototype/AccountDeletionNativeView.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanLocalStore.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj scripts/test-healthfolio-build73-regressions.mjs
git commit -m "feat: add in-app account deletion"
```

---

### Task 6: Add A Reproducible Live Deletion Test

**Files:**
- Create: `scripts/smoke-test-account-deletion.mjs`
- Modify: `package.json`
- Modify: `.gitignore` only if the test creates a named local evidence directory.

**Interfaces:**
- Consumes: `HEALTHFOLIO_SUPABASE_URL`, `HEALTHFOLIO_SUPABASE_ANON_KEY`, and optional `HEALTHFOLIO_SUPABASE_SERVICE_ROLE_KEY`.
- Produces: process exit 0 only after signup, consent, seeded records, deletion, failed reauthentication, and optional administrative residual-data checks.

- [ ] **Step 1: Write the black-box smoke test**

The script must:

```js
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const email = `healthfolio-delete-${runId}@example.com`;
const password = `${crypto.randomUUID()}Aa1!`;
```

It reads the URL/key from environment or the public `app.json` configuration, signs up, calls `upsert_app_user_profile`, records consent `2026-07-10`, creates one managed profile, inserts a synthetic document, creates one share and export where RLS permits, uploads a small non-PHI storage object, invokes `delete-account`, and asserts that password sign-in no longer succeeds. It never prints `password`, access tokens, or keys.

When the optional service-role key is present, create an admin client and assert zero rows for all synthetic IDs in `User`, `UserConsent`, `FamilyLink`, `Document`, `ParameterReading`, `DoctorShare`, `DoctorShareAccess`, `Export`, and `AuditLog`, plus no matching storage objects. In a `finally` block, use the admin client to clean any residual synthetic account and rows after failures.

- [ ] **Step 2: Add the npm command**

```json
"test:account-deletion-live": "node scripts/smoke-test-account-deletion.mjs"
```

- [ ] **Step 3: Run lint-only validation before production**

Run:

```bash
node --check scripts/smoke-test-account-deletion.mjs
npm run test:consent-migration
npm run test:build73-regressions
```

Expected: all exit 0. Do not point the script at production until Task 9 deploys the reviewed backend.

- [ ] **Step 4: Commit the live test harness**

```bash
git add package.json scripts/smoke-test-account-deletion.mjs .gitignore
git commit -m "test: add account deletion smoke pipeline"
```

Skip `.gitignore` from staging when no ignore rule was needed.

---

### Task 7: Publish Accurate Legal And Privacy-Choices Pages

**Files:**
- Create: `docs/app-store-site/index.html`
- Create: `docs/app-store-site/privacy/index.html`
- Create: `docs/app-store-site/support/index.html`
- Create: `docs/app-store-site/privacy-choices/index.html`
- Create: `scripts/test-app-store-site.mjs`
- Create: `scripts/publish-app-store-site.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: public HTTPS pages under `https://starklabs2026-crypto.github.io/health-tracker/`.
- Produces: `npm run test:app-store-site` and `npm run publish:app-store-site`.

- [ ] **Step 1: Write failing page tests**

Require all pages to exist; require privacy to mention consent withdrawal, deletion, service providers, health data, retention, and the medical disclaimer; require privacy choices to contain the exact in-app path `Profile > Privacy & consent > Delete account and data`; require support to contain the support email and emergency notice. Verify every internal `href` resolves to another source file and every external URL uses HTTPS or `mailto:`.

- [ ] **Step 2: Run and confirm failure**

Run `npm run test:app-store-site` after adding the script entry.

Expected: failure because source pages do not exist.

- [ ] **Step 3: Implement the static pages**

Use semantic HTML, responsive CSS, no scripts, no tracking pixels, and no third-party fonts. Keep the existing visual identity but update the policy date to July 10, 2026. State that account deletion removes application data and auth records except information legally required to be retained; do not claim zero retention under every circumstance.

- [ ] **Step 4: Implement deterministic publication**

`publish-app-store-site.mjs` creates a temporary directory with `mkdtemp`, clones only the `gh-pages` branch, copies the four source page trees, runs the page test, commits only changed page files with message `docs: update HealthFolio legal pages`, pushes `gh-pages`, and removes the temporary clone in `finally`. It must refuse to run when `gh auth status` fails or source tests fail. It must not create a git worktree.

- [ ] **Step 5: Test and commit sources before publishing**

Run:

```bash
npm run test:app-store-site
node --check scripts/publish-app-store-site.mjs
git diff --check
```

Commit:

```bash
git add package.json docs/app-store-site scripts/test-app-store-site.mjs scripts/publish-app-store-site.mjs
git commit -m "docs: add App Store legal site sources"
```

Do not publish until the release-policy reviewer in Task 10 approves the wording.

---

### Task 8: Create App Store Metadata And Screenshot Automation

**Files:**
- Create: `docs/app-store/1.0.0/metadata.md`
- Create: `docs/app-store/1.0.0/privacy-label.md`
- Create: `docs/app-store/1.0.0/age-rating.md`
- Create: `docs/app-store/1.0.0/regulated-medical-device.md`
- Create: `docs/app-store/1.0.0/review-notes.md`
- Create: `docs/app-store/1.0.0/submission-checklist.md`
- Create: `docs/app-store/1.0.0/testflight-notes.md`
- Create: `docs/app-store/1.0.0/screenshots/manifest.md`
- Create: `scripts/capture-healthfolio-app-store-screenshots.sh`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioPreviewData.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- Modify: `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift`
- Modify: `docs/app-store-release.md`

**Interfaces:**
- Produces: exact App Store field values with character/byte counts.
- Produces: debug-only `-healthfolioScreenshotMode -healthfolioScreenshotTab today|records|trends|care|assistant` launch arguments.
- Produces: screenshot PNGs containing fictional data only.

- [ ] **Step 1: Write exact metadata**

Use these fixed values unless App Store Connect rejects a field length:

```text
Name: HealthFolio
Subtitle: Your health records, organized
Promotional text: Store medical records, extract readings, follow trends, manage reminders, and create secure summaries you control.
Keywords: medical records,lab reports,health tracker,OCR,medications,health trends,doctor summary
Primary category: Medical
Secondary category: Health & Fitness
Support URL: https://starklabs2026-crypto.github.io/health-tracker/support/
Privacy Policy URL: https://starklabs2026-crypto.github.io/health-tracker/privacy/
Privacy Choices URL: https://starklabs2026-crypto.github.io/health-tracker/privacy-choices/
```

Write a plain-text description under 4,000 characters that describes records, OCR, trends, care reminders, assistant sourcing, export, family profiles, and user-controlled sharing without promising diagnosis or treatment.

- [ ] **Step 2: Write form answer sheets**

The privacy label declares Name, Email Address, User ID, Health, Photos or Videos, and Other User Content as collected, linked to identity, used only for App Functionality, and not used for tracking. Diagnostics remains unselected unless a code scan finds persistent diagnostics collection.

The age-rating sheet selects Frequent Medical or Treatment Information, no advertising, no gambling, no violence, no sexual content, no unrestricted web access, and no public user-generated-content feed. Record the expected current global rating as 16+.

The medical-device sheet answers No for US, UK, and EU/EEA and explains that HealthFolio organizes user-provided records, displays ranges from source materials/catalog data, and provides no diagnosis, treatment recommendation, dosing decision, emergency service, or medical-device hardware interface.

- [ ] **Step 3: Add screenshot fixture mode**

Replace preview names and institutions with `Demo User`, `Example Health Lab`, and clearly synthetic filenames. Under `#if DEBUG`, when `-healthfolioScreenshotMode` is present, initialize the model with preview records, care items, assistant source messages, signed-in state, and current consent without contacting Supabase. Read `-healthfolioScreenshotTab` to choose Today, Records, Trends, Care, or Assistant at root initialization. Release builds must not recognize these arguments.

- [ ] **Step 4: Add screenshot capture script**

The script accepts an output directory, selects an available current iPhone Pro Max simulator, builds the workspace in Debug from a no-space snapshot, installs the app, launches each tab with screenshot arguments, waits for stable rendering, and captures PNGs using `xcrun simctl io booted screenshot`. It validates each PNG with `sips` and writes SHA-256 hashes into the screenshot manifest. It fails if OCR finds `TestFlight`, a real configured email, or known real profile names in screenshot metadata/source fixtures.

- [ ] **Step 5: Generate and inspect screenshots**

Run the capture script, then inspect every PNG at original resolution. Reject screenshots with clipping, empty states, privacy-sensitive values, keyboard overlays, system alerts, or overlapping UI. Capture replacements until all six are clean.

- [ ] **Step 6: Update the release runbook and commit**

Run:

```bash
git diff --check
rg -n -i "password|service_role|secret|real patient" docs/app-store/1.0.0 docs/app-store-site
```

Expected: no credential values or real-person data.

Commit explicit paths:

```bash
git add docs/app-store/1.0.0 docs/app-store-release.md scripts/capture-healthfolio-app-store-screenshots.sh apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioPreviewData.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift
git commit -m "docs: prepare HealthFolio App Store submission"
```

---

### Task 9: Run Independent Reviews Before Production Deployment

**Files:**
- Review the complete diff since commit `f9a4916`.
- Modify only files implicated by concrete findings.
- Add focused tests beside each fix.

**Interfaces:**
- Produces: three independent review reports and a zero-P0/P1 release gate.

- [ ] **Step 1: Dispatch the SwiftUI reviewer**

Ask a read-only reviewer to inspect active-target wiring, concurrency, consent transitions, password recovery, first-launch guide ordering, account-deletion behavior, local-data clearing, accessibility, and screenshot-only debug isolation. Require file/line findings ordered by severity.

- [ ] **Step 2: Dispatch the Supabase reviewer**

Ask a read-only reviewer to inspect migration safety, RLS, security-definer search paths, function grants, consent immutability, deletion authorization, independently authenticated family-member protection, storage cleanup, partial-failure retry behavior, and test cleanup safety.

- [ ] **Step 3: Dispatch the release-policy reviewer**

Ask a read-only reviewer to compare app permissions, public legal copy, privacy-label answers, medical-device rationale, age rating, reviewer notes, screenshot fixtures, build/version configuration, and current Apple requirements. Require source links for policy findings.

- [ ] **Step 4: Fix P0/P1 findings test-first**

For each accepted finding, add or strengthen the smallest failing regression test, run it to confirm failure, implement the fix, rerun focused tests, and commit with a message naming the behavior. Do not combine unrelated refactors.

- [ ] **Step 5: Record residual findings**

Document any deferred P2/P3 item and rationale in `docs/app-store/1.0.0/submission-checklist.md`. The gate fails if any P0/P1 remains unresolved.

---

### Task 10: Deploy And Smoke-Test The Reviewed Backend

**Files:**
- Deploy: generated `supabase/migrations/*_user_consent.sql`
- Deploy: generated `supabase/migrations/*_harden_storage_after_account_deletion.sql`
- Deploy: `supabase/functions/delete-account/`
- Update after evidence: `docs/healthfolio-build60-functionality-restoration-handoff.md`

**Interfaces:**
- Produces: production consent RPCs and retry-safe `delete-account` function in project `qojdeuacwkmlxmodeabt`.

- [ ] **Step 1: Verify linked project and migration drift**

Run:

```bash
supabase projects list
supabase migration list --linked
supabase functions list --project-ref qojdeuacwkmlxmodeabt
```

Expected: linked project is `qojdeuacwkmlxmodeabt`, prior migrations align, and `delete-account` already exists.

- [ ] **Step 2: Deploy the migration**

Run:

```bash
supabase db push --linked
supabase migration list --linked
```

Expected: the generated `user_consent` and `harden_storage_after_account_deletion` migration versions appear in both local and remote columns.

- [ ] **Step 3: Deploy the deletion function**

Run:

```bash
supabase functions deploy delete-account --project-ref qojdeuacwkmlxmodeabt --use-api
```

Expected: deployment succeeds and function listing shows an updated deployment timestamp.

- [ ] **Step 4: Run the live synthetic deletion test**

Supply the publishable URL/key without printing them. If a service-role key is available through the approved local secret store, also enable residual-data verification:

```bash
npm run test:account-deletion-live
```

Expected: signup, consent, seed, delete, reauthentication rejection, residual audit, and cleanup all pass. Query the production database for the test run ID afterward and confirm no synthetic rows remain.

- [ ] **Step 5: Smoke-test related production paths**

Using synthetic accounts/data only, verify:

- Manual PDF/image upload reaches OCR and produces a ready or explicit unsupported-document result.
- Email ingestion creates one document and suppresses a duplicate replay.
- Doctor share opens and then stops opening after revoke.
- Export returns a valid signed URL and downloadable PDF.

Delete every synthetic account and object after verification.

- [ ] **Step 6: Publish approved legal pages**

Run:

```bash
npm run publish:app-store-site
curl -fI https://starklabs2026-crypto.github.io/health-tracker/privacy/
curl -fI https://starklabs2026-crypto.github.io/health-tracker/support/
curl -fI https://starklabs2026-crypto.github.io/health-tracker/privacy-choices/
```

Expected: all URLs return HTTPS 200 and display the July 10, 2026 content.

---

### Task 11: Run The Full No-Space Release Gate

**Files:**
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/ios/HealthFolio/Info.plist`
- Modify: `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- Modify: `package.json`
- Modify: `docs/healthfolio-build60-functionality-restoration-handoff.md`

**Interfaces:**
- Produces: synchronized build `73` and a clean releasable commit.

- [ ] **Step 1: Remove unused permissions and bump build**

Remove `NSMicrophoneUsageDescription` from native `Info.plist` and `android.permission.RECORD_AUDIO` from `app.json` because no microphone feature exists. Set:

```text
apps/mobile/app.json ios.buildNumber = "73"
apps/mobile/ios/HealthFolio/Info.plist CFBundleVersion = "73"
apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj CURRENT_PROJECT_VERSION = 73
```

Extend build-73 regression tests to reject microphone permission strings and require all three build values.

- [ ] **Step 2: Run repository checks**

Run:

```bash
git diff --check
plutil -lint apps/mobile/ios/HealthFolio/Info.plist
npm run test:consent-migration
npm run test:ios-consent
npm run test:ios-onboarding
npm run test:build72-regressions
npm run test:build73-regressions
npm run test:app-store-site
npm run lint --workspace mobile
npm run typecheck --workspace mobile
npm -w @medical-tracker/shared-types run build
npm -w @medical-tracker/parameter-catalog run build
npm -w @medical-tracker/phi-scrubber run build
deno test supabase/functions/delete-account/deletion-utils.test.ts
```

Expected: every command exits 0.

- [ ] **Step 3: Create a no-space release clone**

Create `/tmp/healthfolio-b73-clone` from the current committed branch, ensure its absolute path contains no spaces, install with Node 20 and the lockfile, then run the same focused checks inside the clone. Run `pod install` inside `apps/mobile/ios`.

- [ ] **Step 4: Run the native workspace build**

Run from the no-space clone:

```bash
xcodebuild -workspace apps/mobile/ios/HealthFolio.xcworkspace -scheme HealthFolio -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 5: Scan staged release scope**

Stage explicit paths, then run:

```bash
git diff --cached --check
git diff --cached --stat
git diff --cached | rg -n -i "service_role|password[[:space:]]*[:=]|secret[[:space:]]*[:=]|bearer [a-z0-9._-]{20,}"
```

Expected: no secret values, no dependency folders, no DerivedData, and no unrelated generated files.

- [ ] **Step 6: Commit build 73 readiness**

```bash
git commit -m "chore: prepare HealthFolio build 73"
```

---

### Task 12: Build, Submit, And Complete App Store Connect

**Files:**
- Update after success: `docs/healthfolio-build60-functionality-restoration-handoff.md`
- Update form state: `docs/app-store/1.0.0/submission-checklist.md`

**Interfaces:**
- Produces: EAS production build `1.0.0 (73)`, exact build URL/IPA URL, App Store Connect submission URL, and recorded form completion state.

- [ ] **Step 1: Build from the clean snapshot with EAS**

From `/tmp/healthfolio-b73-clone/apps/mobile`, run:

```bash
npm exec --yes --package eas-cli@20.5.1 -- eas build --platform ios --profile production --non-interactive --wait --message "Build 73: consent, account deletion, and App Store readiness"
```

Expected: EAS reports `FINISHED`, `appVersion` `1.0.0`, and `appBuildVersion` `73`. Record the exact EAS build ID, URL, fingerprint, and IPA URL.

- [ ] **Step 2: Submit the exact build ID**

Set `EAS_BUILD_ID` to the exact ID recorded from Step 1, then run:

```bash
read -r EAS_BUILD_ID
test -n "$EAS_BUILD_ID"
npm exec --yes --package eas-cli@20.5.1 -- eas submit --platform ios --profile production --id "$EAS_BUILD_ID" --non-interactive
```

Do not use `--latest`. Expected: Apple accepts the upload for processing and EAS returns a submission URL.

- [ ] **Step 3: Verify App Store Connect processing**

Open app `6773293787`, confirm build 73 appears under TestFlight and has no export-compliance or binary-processing errors. Do not select build 72.

- [ ] **Step 4: Create and seed the reviewer account**

Create a dedicated fictional email/password reviewer account, accept current consent, and seed only synthetic records. Store its password in macOS Keychain under service `HealthFolio App Review`; do not write it to a file or terminal output. Verify login from build 73 before entering it into App Store Connect.

- [ ] **Step 5: Fill non-legal App Store fields**

Enter metadata, screenshots, support/privacy/privacy-choices URLs, category, privacy nutrition answers, age rating, standard EULA selection, encryption answer, reviewer account, and review notes from `docs/app-store/1.0.0/`. Verify character limits and save each section.

- [ ] **Step 6: Resolve account-holder declarations**

Inspect, then obtain the user's factual confirmation for any unresolved Digital Services Act trader status, Apple legal-entity enrollment, App Review contact phone, country availability, and regulated-device declaration authority. Do not accept agreements or submit guessed declarations.

- [ ] **Step 7: Submit to App Review when all gates are true**

Select build 73, choose the intended release mode, click `Add for Review`, inspect the draft submission, and click `Submit for Review` only after every required field is complete and account-holder declarations are confirmed. Record the resulting App Review status.

- [ ] **Step 8: Update handoff and commit evidence**

Record commits, migration/function deployments, live test run IDs without credentials, legal-page commit, screenshot manifest, EAS build/IPA/submission URLs, App Store form state, and residual manual actions. Run `git diff --check`, stage only documentation, and commit:

```bash
git add docs/healthfolio-build60-functionality-restoration-handoff.md docs/app-store/1.0.0/submission-checklist.md
git commit -m "docs: record HealthFolio build 73 release"
```

- [ ] **Step 9: Confirm final repository state**

Run:

```bash
git status --short --branch
git log -8 --oneline
```

Expected: clean worktree, coherent release commits, and no untracked artifacts.

---

## Completion Evidence

The final handoff must include:

- Commit hashes by batch
- Exact staged scope for each commit
- Automated check results
- Independent reviewer findings and resolutions
- Supabase migration and Edge Function deployment evidence
- Synthetic deletion/OCR/email/share/export smoke-test evidence and cleanup confirmation
- Public legal-page URLs and deployment commit
- Screenshot paths and SHA-256 manifest
- EAS build ID, build URL, fingerprint, IPA URL, and submission URL
- App Store Connect build-processing state
- Completed form sections and account-holder-only unresolved fields
- Final App Review submission state
- Residual uncommitted files, expected to be none
