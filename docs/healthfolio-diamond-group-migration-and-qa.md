# HealthFolio: Diamond Group Migration and QA

Updated: 2026-09-20. Pre-merge checkpoint for a final-tree-only draft PR; the local historical branch is preserved. This document is not evidence that the draft security rollout has been deployed.

Completed on 2026-09-15: the owner resumed the existing Supabase project, authenticated synthetic upload/OCR/preview QA passed with verified cleanup, and build 76 plus its automatic Apple submission finished successfully. Apple/TestFlight tester availability and public App Store approval were not independently verified. See [build 76 upload hotfix](healthfolio-build76-upload-hotfix.md). The September 14 paused-project, build 75, and restore-pending notes below are historical; they do not override this checkpoint. Organization enrollment and the reviewed security rollout remain separate unfinished work.

## Historical release blockers (2026-09-14)

1. Diamond Group has not yet enrolled in the Apple Developer Program as an organization. Its Team ID and exact D-U-N-S legal entity name are not yet confirmed.
2. Supabase project `qojdeuacwkmlxmodeabt` remained paused at this checkpoint. It was successfully transferred to the destination organization on 2026-09-14. A post-transfer restore request returned HTTP 403 because the source CLI account had Developer, not Owner/Admin, access. The destination Owner needed to resume the project; no role expansion was made. Before transfer, restoration was blocked by the source administrator's two-active-free-project limit. No other project was paused, no data was deleted, and no billing plan was changed.
3. Authenticated live QA cannot pass while the backend is inactive. A fresh iOS build alone will not repair this outage.
4. Whether HealthFolio has ever had a publicly released App Store version is still unconfirmed. TestFlight availability is not sufficient for a standard app transfer.

Backend action: complete the authorization/deletion fixes and independent regression review described below, then restore [the existing HealthFolio Supabase project](https://supabase.com/dashboard/project/qojdeuacwkmlxmodeabt) under its new organization and verify connectivity. Do not repoint the app to the new Singapore project or pause another production project merely to make room.

The user authorized stopping `GLP_Tracker`, but it was already `INACTIVE` when checked. Two unrelated projects occupied the source account's active-project quota. Neither was changed. The approved organization transfer was completed instead; owner-level resume was still pending at this historical checkpoint.

## Backend account migration checkpoint

The user redirected work to a confirmed destination Owner account. A new project was already created by the user; no new backend was created by the agent and the app still targets the existing HealthFolio project.

Destination verified from the user's screenshot and native Chrome accessibility state: destination organization (`uxzllmvstkglyqvnwnlw`), project `osfepusoqudvbspobiue`, status Healthy, Free/Nano, region `ap-southeast-1` (Singapore). The dashboard showed no migrations and no backups; table contents were not inspected. This is a different region from the existing HealthFolio project (`ap-south-1`, Mumbai). Project transfer keeps the existing project's region; using the new project instead requires a separate data migration and app configuration update.

### Transfer completed on 2026-09-14

The user explicitly approved transferring HealthFolio and its health data to the destination organization and inviting the source developer account as Developer. The following actions completed through Supabase's supported dashboard flow:

1. Verified the destination Owner account was the destination organization's Owner and sole member.
2. Invited the source developer account with the **Developer** role, then accepted the matching Supabase invitation while signed in as that account.
3. Transferred HealthFolio from the source organization (`riesiuclsmghazkcszjc`) to the destination organization (`uxzllmvstkglyqvnwnlw`). The dashboard reported `Successfully transferred project HealthFolio.`
4. Verified the resulting project-access table: the destination account is **Owner** and the source developer account is **Developer**. No separate source-organization membership removal was performed.
5. Verified project ID `qojdeuacwkmlxmodeabt` and region `ap-south-1` (Mumbai) are unchanged. The app connection URL is unchanged. This was an ownership transfer, not an export/import into the Singapore database.

The new Singapore project was not modified. No billing changes, credential creation, data deletion, SQL migrations, Edge Function deployments, app configuration changes or Apple transfers were performed. HealthFolio still shows **Resume project**; the transfer did not restore it. Database row counts and Storage objects cannot yet be reconciled while it remains paused.

The new Chrome profile is `StarkLabs (Work)` and is accessible through native UI. The old account's connected browser profile was used to accept the invitation and submit the transfer. The source General Settings page now links to the verified destination organization.

Before transfer, browser verification showed HealthFolio in the source organization with two Owner accounts. Its paused-project screen said data/backups/storage remain safe and dashboard resume is available until 2027-09-01. Those source-organization facts are historical; use the destination and project-access table above for current ownership.

Prefer evaluating a supported [project transfer](https://supabase.com/docs/guides/platform/project-transfer) before rebuilding: confirm destination ownership, membership and quota first. A new email alone does not settle quota; Supabase counts free-project usage across Owners/Admins as described in its [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq). Do not remove owners or change access without explicit authorization.

If a separate project is chosen, inventory and privately back up Auth users, database records and Storage objects before migration. Reconfigure Edge Functions, secrets, OAuth/reset redirects, SMTP/mail ingestion and app/EAS environment values. Reconcile row/object counts and run the live QA matrix before cutover. A database-only clone does not copy Storage objects or Edge Functions; see [restore-to-new-project limitations](https://supabase.com/docs/guides/platform/clone-project). Keep the existing project intact until recovery and cutover are verified.

Code work is preserved but uncommitted. **Do not run `supabase db push` yet.** Migration `20260914120000_trusted_family_authorization.sql` now requires a complete audited grant manifest by default. Explicit `healthfolio.family_rollout = 'defer_legacy'` instead snapshots historical grants without deleting or changing their status, denies unverified family access, and withholds client invitation acceptance. Neither mode has been applied. Actual local PostgreSQL merge compatibility and reviewed/deferred recovery tests pass; live RPC definitions/owners and historical grant evidence still need inspection.

Independent review reproduced P1 issues in outgoing FamilyLink deletion targets, mutable User identity bindings, and document-type restrictions missing from direct Document/ParameterReading/Storage access. Local fixes and executable regressions now exist in deletion, OCR/export, Assistant, and migration `20260914130000_profile_document_access_hardening.sql`. They are not production fixes until the reviewed changes are deployed and live QA passes. No live exploitation or production data changes were attempted.

### Restore and deployment checkpoint

1. In the destination Owner session, open [HealthFolio](https://supabase.com/dashboard/project/qojdeuacwkmlxmodeabt) and select **Resume project**. At this historical checkpoint, native browser navigation was interrupted by window focus changes and no successful restore action had been observed. Do not upgrade a plan or grant the source CLI account broader access merely to resume. Resumption subsequently completed as recorded at the top of this document.
2. Verify `ACTIVE_HEALTHY`, DNS, Auth and database connectivity. The paused database read-only query returned HTTP 544, so its schema and row counts have not been verified. The backups API returned an empty list; that does not establish whether the paused project's underlying data is absent or intact.
3. Privately capture the live schema, applied migration history, RPC definitions/owners, aggregate row/object counts and an appropriate recovery snapshot. Never put health records, tokens or passwords in this repository.
4. Review the two authorization migrations together with all service-role readers. Select audited recovery or the explicitly disclosed deferred-family mode. Apply only the reviewed migration set in a trusted postgres session; do not blindly push every migration in a dirty checkout.
5. Deploy the reviewed Edge Functions with the matching database RPCs. Existing deployed sources were downloaded to `/tmp/healthfolio-live-audit.3CwUvt` for comparison; OCR and inbound-email sources matched the pre-edit checkout. Retain this reference until verification completes.
6. Run synthetic authenticated tests: self/managed access, revoked and restricted sharing, upload -> OCR -> category -> original preview, forwarded mail, export, Assistant scope/consent, and account deletion. Clean up only the generated fixtures. Offline stubs do not prove delivery, OCR/model quality or Storage behavior in production.
7. Check Auth redirect and email settings after restoration. The management API currently reports `site_url = http://localhost:3000`, empty redirect allow-list, and no custom SMTP host. The app expects `healthfolio://auth/callback` and its recovery flow. Confirm the real configured sender/provider before changing SMTP; the user has been asked to name it without sharing secrets. Password-reset email delivery is not verified.

The inbound-email patch accepts only the configured mailbox/domain, verifies an independent Auth identity and processing consent, and prevents provider errors from leaking upstream details. Managed/unbound profile aliases intentionally return 403 until a trusted guardian-ingestion path exists. The current default mailbox matches the app; changing the Supabase account email does not change this forwarding mailbox or its external provider wiring.

Six existing functions remain registered: OCR v26, export v5, deletion v5, inbound email v14, Assistant config v1 and Assistant response v2. An `ACTIVE` function registration does not mean the paused database is available. No Edge Function or SQL migration has been deployed in this recovery pass.

## Historical release and access (2026-09-14)

EAS was queried on 2026-09-14. The newest successful iOS build in the configured project is **1.0.0 (75)**, completed 2026-07-19.

| Item | Current value |
| --- | --- |
| EAS owner / project | `starklabs` / `healthfolio` |
| EAS project ID | `b06f1d7e-8692-4995-9a4f-8641dbffadbf` |
| Successful build ID | `89f06920-24b5-4264-8bc0-edc14c979afb` |
| Build source commit | `f5b63edab15015c007c2fbb83ee4ed038009014c` |
| App Store Connect app ID | `6773293787` |
| Bundle ID | `com.starklabs.healthfolio` |
| Existing signing team (release records) | `WN432B5HS6`, individual |
| Target organization | Diamond Group; exact legal entity name to verify against D-U-N-S |
| Organization enrollment contact | Authorized organization enrollment contact; personal contact details held privately |
| New Team ID / App Store ID | Not available yet |

[EAS build 75](https://expo.dev/accounts/starklabs/projects/healthfolio/builds/89f06920-24b5-4264-8bc0-edc14c979afb) and [existing TestFlight app](https://appstoreconnect.apple.com/apps/6773293787/testflight/ios).

EAS access worked through the already-authenticated CLI. This confirmed EAS's build state, not what was installed on a particular phone. Native browser accessibility later exposed the existing App Store Connect rejection page: version 1.0, build 73, reviewed 2026-07-20 under guideline 5.1.1(ix), submitted through an individual membership. No Apple-side mutation was performed; build 75's processing state was not independently verified there.

The real app is SwiftUI in `apps/mobile/ios/HealthFolio/SwiftUIPrototype`. RN compatibility still needs to build and typecheck. The Assistant is already a remote Supabase Edge Function calling OpenAI, not an on-device LLM. No model key belongs in the app.

## Step 1: Organization enrollment contact completes enrollment

1. Confirm Diamond Group's exact registered legal entity name, registered address, and D-U-N-S record agree. Use the registered entity, not only a trading name.
2. Confirm the organization enrollment contact has authority to bind the entity to Apple's agreements. Job title and account access alone do not establish that authority. Apple may ask an authorized senior employee to verify it.
3. The enrollment contact must use their own Apple Account with two-factor authentication, legal personal name, and company-domain email. Do not share Apple passwords with developers.
4. Start [organization enrollment](https://developer.apple.com/programs/enroll/). Supply the entity details, D-U-N-S number, company website and contact information. If Apple directs enrollment through the Apple Developer app, complete it there.
5. The organization enrollment contact completes identity verification, Apple's agreements and membership payment personally.
6. Wait for membership activation. Record the new organization **Team ID**, Account Holder email, and legal seller name.
7. In App Store Connect, invite the developer's own Apple Account with the required app role and certificate/profile access. Avoid sharing the Account Holder login.

Apple documents legal authority, entity, D-U-N-S, company-domain email and website requirements in its [enrollment requirements](https://developer.apple.com/programs/enroll/).

## Step 2: Choose the correct app move

### If HealthFolio has a publicly released version

Check all [app-transfer criteria](https://developer.apple.com/help/app-store-connect/transfer-an-app/app-transfer-criteria/). The current Account Holder initiates the transfer using the recipient Account Holder email and Team ID, and the recipient accepts it. Resolve blocking app states and agreements first. Inventory capabilities and Sign in with Apple before initiating.

### If HealthFolio has only TestFlight builds or rejected submissions

Standard transfer requires a released App Store version. Contact [Apple Developer Support](https://developer.apple.com/contact/) before deleting or recreating anything. Ask for the supported path for this unreleased app rejected under 5.1.1(ix), with the old/new teams and app ID.

Account conversion is a separate path, not a way to assign an unrelated company's identity to an individual membership. Apple's [membership update guidance](https://developer.apple.com/help/account/membership/updating-your-account-information/) describes eligibility and support review. If Apple instead requires a new app under Diamond Group, verify a new bundle ID and app registration on that team. Do not assume the old bundle ID can be reused or released.

Suggested support message, after filling the missing fields:

> HealthFolio (App Store Connect ID 6773293787, bundle com.starklabs.healthfolio) was rejected under 5.1.1(ix) because it handles sensitive health data and was submitted through an individual membership. Diamond Group is completing organization enrollment. The intended organization Team ID is [TEAM ID], and its Account Holder is [CONFIRMED NAME AND EMAIL]. The app has [CONFIRMED PUBLIC RELEASE STATUS]. Please confirm the supported migration path, including whether its existing app record and bundle ID can be retained. We have not deleted the app or revoked its credentials.

## Step 3: Technical migration checklist

1. Preserve the old app, signing information, build references, metadata, privacy answers and source commits.
2. Verify the receiving legal entity is actually the provider responsible for HealthFolio and its health-data processing. Update policy/operator information when ownership is established; do not change only the displayed seller name to evade the rejection.
3. Confirm old/new Team IDs, allowed bundle ID and destination ASC app ID before modifying EAS submit settings or signing.
4. Review Sign in with Apple identity migration with Apple's capability guidance. A new team or new app can affect identity mapping; do not link accounts just because email strings match.
5. Review Google iOS OAuth client registration, callback schemes, Supabase provider audience settings and allowed redirects against the final bundle ID/team.
6. Check keychain groups, entitlements, push credentials, universal links and local data migration. Do not assume existing installs or keychain sessions migrate to a new bundle ID.
7. Keep Supabase records intact. Apple membership migration does not require recreating the health database. Confirm operator access, consent and data-controller disclosures separately.
8. Set EAS credentials for the confirmed destination team. Verify the provisioning profile's team and bundle ID, and confirm the submit profile targets the new ASC app ID.
9. Run the release gates below, build from a no-space snapshot with EAS, then submit the exact successful build ID. Verify Apple processing and TestFlight installation before calling delivery complete.

## Changes prepared in this pass

- Session expiry margin, one shared refresh exchange, stale login/refresh invalidation, account-safe one-time 401 recovery and local-scope sign-out.
- Dashboard response guards, failed profile-switch record rollback, immediate profile-save completion and throttled Assistant configuration reads.
- Profile/settings grouping, retained failed drafts, discard confirmation, scoped loading indicators and separated security/deletion actions.
- Missing birth dates and sex stay unset instead of silently becoming 1970/Other. Pre-1970 birth dates remain valid. Concurrent profile edits block stale saves until the saved profile is reloaded with discard confirmation.
- Readable selectable Assistant replies, accessible composer controls and source navigation.
- Backend identity/consent/profile authorization, medical-only policy, bounded relevant retrieval and strict response/source validation. Existing JSON fields remain compatible.
- Real chronological chart data, unit separation, valid reference bands, neutral increase/decrease labels and no fabricated history.

## Reproducible checks for every change

1. Record the bug: build, screen, profile type, exact taps, network state, expected/actual result. Use synthetic data. Never commit medical records, login credentials or production tokens.
2. Inspect `git status --short`, `git diff --stat` and the actual diff before editing. Classify by native UI, networking, backend, RN compatibility and docs. If iCloud-offloaded artifacts stall Git, use scoped source diffs until files hydrate; do not discard them.
3. Write a regression that fails for the original behavior. Prefer actual helper/handler execution over regex checks. Include failure, cancellation, repeated taps, empty data and cross-profile cases.
4. Fix the smallest coherent scope. Request a read-only review from a reviewer who did not implement that area. Keep review findings and residuals explicit.
5. Verify from a fresh no-space `/tmp` source snapshot. Install locked dependencies, then build shared packages before mobile typecheck. Do not change the shipping native implementation to make a compatibility test pass.
6. Run `git diff --check` and `plutil -lint apps/mobile/ios/HealthFolio/Info.plist apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`.
7. Run `npm run test:ios-session`, `npm run test:ios-profile`, `npm run test:ios-trends`, `npm run test:assistant-behavior`, `npm run test:ingestion-security`, `npm run test:inbound-email-security`, `npm run test:deletion-behavior`, `npm run test:profile-document-access`, the existing auth/consent/onboarding/OCR/deletion suites, mobile typecheck, lint and tests. These eight suites are also part of `npm run cleanup:verify`. PostgreSQL tests require `initdb`, `pg_ctl` and `psql` on PATH (or `PG_BINDIR`) and create disposable local clusters. Typecheck deployed Edge Functions with `deno check --no-config --no-lock --node-modules-dir=none` from the no-space snapshot. Build the actual Xcode workspace for Simulator with code signing disabled.
8. Exercise the UI on a small and large iPhone, standard and accessibility text sizes. Check drafts, cancellation, keyboard, loading and source links. Screenshots alone do not verify button behavior.
9. Run live synthetic QA only against an active backend: password reset callback through a dedicated test mailbox, login/logout/refresh, self/family isolation, upload -> OCR -> category -> original preview, mail ingestion, share creation/open/revoke, consent and deletion. Verify cleanup of only the generated test data.
10. Scan the explicit staging set with `npm run cleanup:scan -- --staged`; inspect `git diff --cached`. Stage named paths, commit by ownership boundary, and record hashes. Never use `git add -A` for this release cleanup.
11. Submit with EAS only after verifying destination team and ASC ID. Record build ID, version, source commit, submission status and tests. A queued build is not a completed TestFlight delivery.

See also [the existing cleanup runbook](healthfolio-cleanup-pipeline.md) and [App Store Connect form text](app-store/1.0.0/app-store-connect-form.md). Revalidate old metadata against the final organization and tested feature set.

## QA evidence and remaining work

- Session expiry test failed on the original code, then passed after the fix. The executable suite also covers concurrent refresh, rejected-token reuse, logout races, stale login, account isolation, offline preservation and revoked tokens.
- Assistant behavior harness reproduced 27 failures before fixes; the final parent Node 20 run passed 72 tests, including temporary local PostgreSQL grant/merge/recovery checks, deleted-profile cases, forward-only health access, and full-scope managed-merge restrictions. The added review cases failed before their fixes. OpenAI transport is stubbed, so this does not establish live model quality. Temporary databases are cleaned up.
- Trend-data tests passed; a reversed-order mutation failed as expected. Cases cover fabricated history, dates, units, reference bands, direction and numeric overflow.
- Locked dependency installation, shared package builds, mobile typecheck, mobile lint, and the existing mobile test passed in `/tmp/healthfolio-qa.7pfVJs`. Typecheck first required the shared packages to be built, as documented above.
- Plist/project lint and whitespace checks passed.
- Full native Debug arm64 Simulator build passed from `/tmp/healthfolio-qa.7pfVJs`, with derived data in `/tmp/healthfolio-qa-dd`. Log: `/tmp/healthfolio-qa-xcodebuild-arm64.log`. CocoaPods warnings remain about old dependency deployment targets and script outputs; no compilation errors.
- iPhone 17 Simulator: the profile button and marker-detail button opened their screens. Profile draft DOB changes remained unsaved and enabled Save. Today, profile, chart overview/detail and Assistant rendered with synthetic data. Coordinate-based UI actions intermittently failed in the automation tool, so this does not establish complete button coverage.
- Session, profile, trend, auth/Assistant, build 72/73, OCR contract, chat-history, consent, onboarding, deletion-policy, remote-model decoding and deletion-harness checks passed on the current checkout. The deletion harness contains 5 offline tests; OCR contract checks do not prove live OCR.
- Cleanup pipeline regression first failed because the new suites were missing from the automated gate, then all 5 cleanup tests passed after wiring them in.
- Recovery review continued after the account transfer. Parent verification passed 35 deletion handler cases, 13 OCR/export cases (including identity collisions, revoked access, deleted profiles and caller-JWT export reads), and 96 PostgreSQL identity/document/Storage cases. The final 96-case run includes forwarding-alias hijack, uploader/ID forgery, orphan-file paths, atomic reassignment, and scoped sharing. Re-run final sources before deployment. No live rollout has passed.
- Final cross-review fixes restrict profile merging to full managed authority and remove reverse HealthProfile disclosure from a one-way invitation. Relationship display, if needed in the reverse direction, must use separate metadata-only access rather than health-data authorization. Existing family grants still require audited recovery or explicitly deferred access; concurrent service-role deletion/OCR authorization changes remain a residual live-concurrency risk.
- An isolated Deno check passed for all six Edge Functions after correcting generic client typing and OCR request/runtime declarations. All 24 inbound-email security cases passed in the parent run. Mobile typecheck/lint, plist/project lint and the five cleanup-gate tests were rerun successfully. The dirty-file secret scan passed; synthetic test fixtures are not real credentials. The older Assistant contract test now checks for the trusted authorization RPC rather than requiring the removed unsafe direct FamilyLink lookup.
- Live deletion smoke attempted but failed before signup with DNS `ENOTFOUND`; no test account or health data was created by that attempt. Other authenticated live checks remain blocked by inactive Supabase.
- No claim that every app bug is fixed, no new EAS release submitted, and no Apple account transfer performed in this preparation pass.
