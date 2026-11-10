# HealthFolio Build 60 Functionality Restoration Handoff

## Current Preparation: September 2026

Latest verified successful EAS build: **1.0.0 (75)**. The restoration history below is historical. Current fixes, regression evidence, Supabase availability findings, and Diamond Group organization-enrollment steps are tracked in [the migration and QA handoff](healthfolio-diamond-group-migration-and-qa.md). No new Apple-team migration or release should be inferred from the old completed phases.

## Current objective

Restore build 53 functional completeness into the current build 60 codebase while preserving the newer build 60 UI direction. Work is batched so each phase can be checked independently and resumed by a future thread.

## Source docs used

- `docs/healthfolio-functionality-reference-build-53.md`
- `docs/healthfolio-functionality-reference-build-60.md`
- `docs/healthfolio-build-53-vs-60-functionality-diff.md`

## Current phase

Phase 6, final artifact QA, post-restoration live backend QA/hardening, and build 72 SwiftUI cleanup/feature QA are complete in the active SwiftUI app, with Phases 1 through 5 still preserved. Build 62 was superseded by build 63 because the final Google callback and React Native source-build fixes landed after build 62 uploaded. Build 63 was superseded by build 64 because the SwiftUI auth port decoded Supabase auth metadata too narrowly and lacked password reset recovery. Build 64 was superseded by build 65 because the follow-up cleanup added PDF preview hardening, richer trends charts/ranges, health-score explanations, manual profile correction persistence, medication reminder input polish, and signed-out/signed-in QA. Builds 65 through 71 were superseded by incremental fixes for auth recovery, preview downloads, profile merging, first-launch guide triggering, and build packaging drift. Build 72 has passed local QA from no-space snapshots, deployed the OCR unsupported-document backend path, completed EAS production build, and been submitted to App Store Connect/TestFlight for Apple processing.

## Completed phases

### Phase 1: Document verification and doctor-share existing-link actions

Completed in this handoff. The migration check found that the current user-facing iOS app is the SwiftUI target under `apps/mobile/ios/HealthFolio/SwiftUIPrototype`, so the Phase 1 work was restored there rather than stopping at the older React Native screens.

### Phase 2: Care reminders

Completed in this handoff against the active SwiftUI target.

### Phase 3: Assistant records-grounding and persistent chat history

Completed in this handoff against the active SwiftUI target.

### Phase 4: Family/profile role editing and document reassignment

Completed in this handoff against the active SwiftUI target.

### Phase 5: Email ingestion status and Today/profile polish

Completed in this handoff against the active SwiftUI target.

### Phase 6: Upload polish and final QA

Completed in this handoff against the active SwiftUI target.

### Final artifact QA: signed build 60 IPA

Completed in this handoff from the no-space build snapshot.

### Post-restoration live backend QA and hardening

Completed in this handoff against linked Supabase project `qojdeuacwkmlxmodeabt`.

## Remaining phases

No restoration phase remains. Live signed-in device smoke checks are still required for authenticated UI flows, permissions, notifications, uploads, OCR, sharing, export, email forwarding, profile reassignment, PDF preview, trends marker expansion, and health-score/biological-age display after App Store Connect processing completes for build `1.0.0 (66)`.

## Files changed in each phase

### Phase 1

- `packages/shared-types/src/share.ts`
- `packages/shared-types/dist/share.d.ts`
- `apps/api/src/shares/shares.service.ts`
- `apps/api/src/shares/shares.controller.ts`
- `apps/mobile/app/shares.tsx`
- `apps/mobile/app/documents/[id].tsx`
- `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthRecord.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseConfig.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/DoctorShareRecord.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/DocumentScoreCard.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/DocumentDetailNativeView.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/DoctorShareNativeView.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift`
- `apps/api/src/profile/profile.service.ts`
- `docs/healthfolio-build60-functionality-restoration-handoff.md`

### Phase 2

- `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanKind.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanDueState.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CareReminderScheduleResult.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanLocalStore.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CareReminderScheduler.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanItem.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanNativeView.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/CarePlanRow.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioPreviewData.swift`
- `docs/healthfolio-build60-functionality-restoration-handoff.md`

### Phase 3

- `apps/mobile/ios/HealthFolio/AppDelegate.swift`
- `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AssistantChatLocalStore.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AssistantMessage.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AssistantBubble.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/AssistantNativeView.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioRootView.swift`
- `docs/healthfolio-build60-functionality-restoration-handoff.md`

### Phase 4

- `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/FamilyProfileRole.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioProfile.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthRecord.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileNativeView.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/ProfileSwitcherNativeView.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/DocumentDetailNativeView.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/UploadRecordsNativeView.swift`
- `docs/healthfolio-build60-functionality-restoration-handoff.md`

### Phase 5

- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/TodayNativeView.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeRecordStatus.swift`
- `docs/healthfolio-build60-functionality-restoration-handoff.md`

### Phase 6

- `apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- `apps/mobile/ios/HealthFolio/AppDelegate.swift`
- `apps/mobile/ios/HealthFolio/Info.plist`
- `apps/mobile/ios/HealthFolio/SceneDelegate.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeUploadItem.swift`
- `apps/mobile/ios/HealthFolio/SwiftUIPrototype/UploadRecordsNativeView.swift`
- `docs/healthfolio-build60-functionality-restoration-handoff.md`

### Final artifact QA

- `build/ios/export/20260626-074324-swiftui-scene-b60/HealthFolio-1.0.0-60.ipa`
- `build/ios/export/20260626-074324-swiftui-scene-b60/archive.log`
- `build/ios/export/20260626-074324-swiftui-scene-b60/export.log`
- `build/ios/export/20260626-074324-swiftui-scene-b60/Packaging.log`
- `build/ios/export/20260626-074324-swiftui-scene-b60/DistributionSummary.plist`
- `build/ios/export/20260626-074324-swiftui-scene-b60/ExportOptions.plist`
- `build/ios/export/20260626-074324-swiftui-scene-b60/SHA256SUMS.txt`
- `docs/healthfolio-build60-functionality-restoration-handoff.md`

### Post-restoration live backend QA and hardening

- `supabase/migrations/20260626022901_harden_security_definer_rpc_execute_grants.sql`
- `supabase/migrations/20260626023127_optimize_rls_policy_performance.sql`
- `docs/healthfolio-build60-functionality-restoration-handoff.md`

## Features restored in each phase

### Phase 1

- Existing doctor-share links now have enough API data for practical reuse actions by returning an optional `shareUrl` on listed shares.
- Existing React Native share rows still expose Copy, Share, Open, and Revoke actions for any remaining RN route usage.
- The active SwiftUI app now has a Profile action for doctor-share links with create, list, copy, share again, open, and revoke actions.
- Opening a single-use share link warns that previewing can consume the single allowed access.
- The native doctor-share screen talks directly to Supabase REST for `DoctorShare` under the current user's auth session and builds links as `https://healthfolio.app/share/{token}`.
- SwiftUI document detail now fetches a signed storage URL, checks available file metadata, previews image uploads inline, previews PDF uploads inline with PDFKit, and keeps Open and Share actions for the original file.
- SwiftUI document detail shows stronger original-file verification details: type, remote content type when available, file size when available, source, record date, added date, and OCR status/timing.
- Document score explanation remains visible and now includes compact factor rows for OCR state, extracted values, and average trust.
- Phase 1 QA fixed the generated shared-types declaration so consumers of `@medical-tracker/shared-types` see `DoctorShare.shareUrl`.
- API typecheck uncovered and fixed a strict-null file URL filter in `profile.service.ts`.

### Phase 2

- Native care reminders are now real local user data loaded from and saved to `UserDefaults`, instead of preview-only seeded rows.
- Reminder kinds are typed as medicine, test, and visit, with kind-specific icons and labels.
- Saving a reminder requests local notification permission when needed, schedules a one-time `UNCalendarNotificationTrigger`, and stores a stable notification identifier.
- Completed reminders cancel their pending notification. Marking them due again reschedules if the due time is still in the future.
- Deleting a reminder is a row-level action with a confirmation dialog and cancels its pending notification.
- Rows now show due state: Done, Overdue, Due today, or Due.
- The add form can link a reminder to an existing ready document, with prescriptions sorted first for medicine reminders.
- Reminder rows can open the linked source record through the same native document detail route used by Records and Assistant.
- The care summary card now reports medicines, follow-ups, and currently due-today reminders.
- The clinical boundary remains visible: reminders organize records and do not change dosage or medical instructions.

### Phase 3

- Assistant chat history is now persisted locally as JSON under Application Support with complete file protection and a clear-history action.
- Assistant messages persist source record IDs instead of full record payloads, so saved history remains serializable and source rows resolve against the currently loaded profile records.
- Persisted source rows remain clickable when the source record is loaded; otherwise the bubble explains that sources are not loaded for the current profile.
- Quick prompts now send their actual prompt body instead of only the short display title.
- Native assistant answering now covers the Build 60 records-first flows: medication advice refusal, prescription summaries, flagged-marker concerns, imaging summaries, latest document, specific marker matching, record summaries, score/readiness explanation, upload/OCR help, and ranked relevant-record fallback.
- Assistant answers now explicitly state the raw-text boundary: it can use stored metadata, notes, OCR status, and extracted marker values, but not full raw PDF text unless that text is extracted into those fields.
- Runtime QA found and fixed a real SwiftUI lifecycle warning: `.onOpenURL` was invalid in this UIKit/Expo lifecycle. URL callbacks are now routed from `AppDelegate` through a NotificationCenter bridge, while Expo URL handling remains intact.

### Phase 4

- Added `FamilyProfileRole` for Owner, Viewer, Contributor, and Guardian labels, with editable managed-profile roles matching the backend family-link role values.
- `HealthFolioProfile` now carries `familyLinkId`, role metadata, display name, and relationship label so family rows no longer hardcode generic status text.
- The native Profile sheet now shows a real profile management row: tap to switch profiles, and use a role menu to update Viewer, Contributor, or Guardian for managed profiles.
- Native Supabase integration now loads family-link `id` and `role`, and can PATCH the `FamilyLink.role` for managed profiles.
- `HealthRecord` now carries `ownerProfileId` so document detail can show the current assignment.
- Native Supabase integration now supports document reassignment by PATCHing `Document.ownerUserId` and the linked `ParameterReading.userId` rows for that document.
- Document detail now has a Profile assignment section when multiple profiles are available, with a Move record action and explicit copy that the move updates document ownership and extracted readings.
- Completed uploads now expose a Move to profile menu in the upload queue so users can correct assignment immediately after OCR completes.
- The shared profile switcher now uses `profile.displayName`, keeping profile labels consistent across Today, Records, Trends, and upload.

### Phase 5

- The native app now derives an email-ingestion document list from records with `emailIngestKey`, email-like source labels, or forwarded-document notes, sorted by source date and creation time.
- Today now shows a signed-in Email ingestion card with the active profile's forwarding address, a copy action, the latest forwarded document status, OCR stage/progress where available, and total forwarded-document count.
- Today keeps the email-ingestion card hidden while signed out so forwarding addresses are not shown before a real session/profile is loaded.
- Today now has a dedicated Profile context card that makes the selected profile, relationship/role, record count, and marker count visible above the health score.
- The Profile context card includes a Manage profiles icon button that opens the native profile sheet.
- `NativeRecordStatus` now exposes a status icon so forwarded document rows can render ready, in-progress, failed, and all-record states consistently.
- Today gained extra bottom scroll reserve so the new content can scroll clear of the translucent tab bar.

### Phase 6

- The SwiftUI upload screen now uses `PhotosPicker` for real photo-library multi-select instead of routing Photos through the file importer.
- File imports are staged into the app cache before queue processing, so security-scoped picker URLs are copied before the backend creates a `Document` row.
- Photo imports are staged as local image files before upload, with readable generated names and partial-failure reporting when some selected photos cannot be read.
- Each queued upload now stores the target profile ID and display name at selection time, preventing profile drift if the user switches profiles while a multi-file batch is processing.
- Upload processing now sends the pinned queue-item owner profile to the Supabase upload/OCR flow instead of reading the current active profile at processing time.
- The upload screen now shows a visible Upload target card and each queue row shows its owner profile.
- The SwiftUI-only Manual source path was removed because it created local ready-looking records without backend upload/OCR persistence and did not exist in the original React Native upload flow.
- Analyzed upload rows now expose an Open action that navigates to the produced `HealthRecord`.
- The upload queue profile menu now marks the queued item's owner profile instead of the currently active profile.
- Failed uploads can be retried from the queue, and failed/analyzed queue rows can be removed. Removing failed rows also removes their local placeholder record and staged cache file.
- Successful uploads now clean their staged local file after the backend upload/OCR request completes.
- `activeProfileName` now uses `profile.displayName`, keeping upload, assistant, and profile copy aligned with managed-profile labels.
- `AppDelegate` now routes only `healthfolio://auth/callback` into native auth callback handling, instead of treating every `healthfolio://...` URL as an auth callback.
- The SwiftUI app now adopts a UIKit scene lifecycle through `SceneDelegate`, with URL/user-activity auth callback forwarding preserved for HealthFolio callback URLs.
- True live batch camera scanning remains deferred; Camera still directs users to choose an existing scan or image while Files and Photos support multi-select.

### Final artifact QA

- Build 60 now has a local signed App Store IPA artifact at `build/ios/export/20260626-074324-swiftui-scene-b60/HealthFolio-1.0.0-60.ipa`.
- The earlier `build/ios/export/20260626-071636/HealthFolio-1.0.0-60.ipa` artifact is superseded because it predates the SwiftUI migration follow-up fixes.
- The IPA is `com.starklabs.healthfolio`, version `1.0.0`, build `60`.
- The IPA is signed by `Apple Distribution: Aditi Somani (WN432B5HS6)` with the `HealthFolio App Store Apple Sign In 2026-05-28` provisioning profile.
- The exported app entitlements include `application-identifier = WN432B5HS6.com.starklabs.healthfolio`, `beta-reports-active = true`, and `get-task-allow = false`.
- SHA-256: `46f53b51a8ae03e9ca671f8f6f6aa5840916c004b42451694fb27587a16857a9`.

### Post-restoration live backend QA and hardening

- Linked Supabase project confirmed as `qojdeuacwkmlxmodeabt`.
- Deployed Edge Functions are active: `process-document-ocr` v18, `export-health-summary` v5, `delete-account` v4, and `inbound-email-ingest` v11.
- Supabase Auth settings endpoint confirmed Apple, Google, and email providers enabled, anonymous users disabled, and mailer autoconfirm enabled.
- Production table counts confirmed the active data surfaces exist without dumping user rows: `User` 49, `Document` 176, `ParameterReading` 1783, `FamilyLink` 35, `DoctorShare` 0.
- Live RLS metadata confirmed `Document`, `ParameterReading`, `FamilyLink`, `User`, and `DoctorShare` have RLS enabled and owner/manage policies covering the SwiftUI app's direct REST read, insert, update, delete, role PATCH, and reassignment paths.
- Storage bucket `medical-documents` is private, allows PDF/JPEG/PNG, has a 25 MB limit, and has owner-scoped authenticated all-access storage policy for the app's `authUser.id/documents/...` upload path.
- Anonymous REST probe against `Document` returned HTTP 200 with no rows; anonymous RPC probes after hardening return permission denied for exposed helper RPCs.
- Unauthenticated Edge Function probes reject public use: OCR/export/delete-account return missing bearer token; inbound email ingest returns invalid email ingest secret.
- Added and pushed `20260626022901_harden_security_definer_rpc_execute_grants.sql` to remove `PUBLIC`/`anon` execution from security-definer RPC helpers and make `increment_document_ocr_attempts` service-role only.
- Added and pushed `20260626023127_optimize_rls_policy_performance.sql` to remove duplicate `FamilyLink` SELECT policy coverage and optimize `user_insert_own` auth checks.
- Remote migration history now matches local through `20260626023127`.
- Supabase performance advisor now reports no issues.
- Supabase security advisor no longer reports anonymous security-definer function execution. Remaining warnings are signed-in execution for intentional authenticated app/RLS helper RPCs and Supabase Auth leaked-password protection disabled.

## Tests/builds run

### Phase 1 QA

- Stopped the stale original-workspace npm/typecheck/install attempts instead of leaving them running.
- `plutil -lint apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`: passed.
- `swiftc -parse` on the new SwiftUI model files: passed before full Xcode verification.
- Created a clean no-space snapshot at `/tmp/codex-xcode/healthfolio-phase1` because the original `Documents/health tracker` path showed slow/hanging native tool behavior.
- `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline --verbose` in the temp snapshot: passed.
- `pod install` in the temp snapshot iOS workspace: passed with 115 pods installed.
- Debug simulator build from the temp snapshot with `xcodebuild -workspace HealthFolio.xcworkspace -scheme HealthFolio -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`: passed.
- Release simulator build from the temp snapshot with `xcodebuild -workspace HealthFolio.xcworkspace -scheme HealthFolio -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`: passed.
- `npm -w @medical-tracker/shared-types run build` in the temp snapshot: passed.
- Generated package and Prisma prerequisites in the temp snapshot: `@medical-tracker/shared-types`, `@medical-tracker/parameter-catalog`, `@medical-tracker/phi-scrubber`, and `npx prisma generate --schema apps/api/prisma/schema.prisma` all passed.
- `npm -w api run typecheck` in the temp snapshot: passed after fixing the strict-null file URL filter.
- `npm -w mobile run typecheck` in the temp snapshot: passed.

### Phase 2 QA

- `plutil -lint apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`: passed.
- `swiftc -parse` on the new care model/scheduler files: passed.
- Targeted `git diff --check` for Phase 2 files: passed.
- Static requirement checks confirmed notification permission/scheduling/cancelation paths, local persistence, add/toggle/delete methods, linked-record picker, source-opening action, and delete confirmation are present.
- Reused the clean no-space snapshot at `/tmp/codex-xcode/healthfolio-phase1`; copied only Phase 2 native files into it.
- Initial Debug simulator build failed with `No space left on device`; this was fixed by deleting generated `/tmp/codex-xcode/DerivedData` build artifacts.
- Debug simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- Release simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- `npm -w mobile run typecheck` in the temp snapshot: passed.
- `npm -w api run typecheck` in the temp snapshot: passed.
- Installed and launched the Debug simulator app on iPhone 16e simulator. `simctl launch` returned PID `86627`, and screenshot `/tmp/healthfolio-phase2-launch.png` showed the HealthFolio SwiftUI app running after launch.
- Shut down the simulator after the smoke test.

### Phase 3 QA

- Checked for stopped/background npm, node, xcodebuild, and simulator processes before continuing. No npm install process was left running.
- Ran monitored `npm install` in the no-space temp snapshot; it completed successfully as up to date.
- Restored the temp `package-lock.json` back to source parity after install, because the temp snapshot intentionally does not contain every workspace.
- `plutil -lint apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`: passed.
- Targeted `git diff --check` for Phase 3 SwiftUI/AppDelegate/project files: passed.
- Static requirement checks confirmed assistant local persistence, complete file protection, source ID persistence/resolution, clear history, raw-text boundary copy, medication-advice refusal, metric matching, and relevant-record ranking.
- Reused `/tmp/codex-xcode/healthfolio-phase1`; copied only Phase 3 native files into it.
- Debug simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- Release simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- `npm -w mobile run typecheck` in the temp snapshot: passed.
- `npm -w api run typecheck` in the temp snapshot: passed.
- Installed and launched the Debug simulator app on iPhone 16e simulator. Screenshot `/tmp/healthfolio-phase3-urlfix-launch.png` showed the HealthFolio SwiftUI app rendering after launch.
- Simulator log review initially found `Cannot use Scene methods for URL, NSUserActivity, and other External Events without using SwiftUI Lifecycle`; this was fixed by moving auth callback routing to `AppDelegate`.
- Rebuilt Debug and Release after the URL-routing fix: both passed.
- Re-ran `npm -w mobile run typecheck` and `npm -w api run typecheck` after the URL-routing fix: both passed.
- Reinstalled and relaunched the rebuilt Debug app; the targeted simulator log query for `Cannot use Scene methods` returned no entries.
- Sent a synthetic `healthfolio://auth/callback?error=qa-smoke` URL through `simctl openurl`; iOS displayed the first-use custom scheme confirmation prompt and the targeted log query showed no SwiftUI lifecycle warning or crash signal.
- Shut down the simulator and deleted only generated `/tmp/codex-xcode/DerivedData/HealthFolioPhase3Debug` build artifacts afterward to recover disk.

### Phase 4 QA

- Rechecked build 53/build 60 family/profile requirements and active SwiftUI Profile, Today, upload, document detail, and native Supabase code before editing.
- `plutil -lint apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`: passed.
- `swiftc -parse apps/mobile/ios/HealthFolio/SwiftUIPrototype/FamilyProfileRole.swift`: passed.
- Targeted `git diff --check` for Phase 4 SwiftUI/project files: passed.
- Static requirement checks confirmed family role metadata, role update API/model/UI paths, owner profile IDs on records, document reassignment API/model/UI paths, and upload queue move-to-profile action.
- Reused `/tmp/codex-xcode/healthfolio-phase1`; copied only Phase 4 native files into it.
- Debug simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- Release simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- `npm -w mobile run typecheck` in the temp snapshot: passed.
- `npm -w api run typecheck` in the temp snapshot: passed.
- Installed and launched the Debug simulator app on iPhone 16e simulator. Screenshot `/tmp/healthfolio-phase4-launch.png` showed the HealthFolio SwiftUI app rendering after launch.
- Targeted simulator log query for the previously fixed SwiftUI lifecycle warning, fatal errors, or crash strings returned no entries.
- Shut down the simulator and deleted only generated `/tmp/codex-xcode/DerivedData/HealthFolioPhase4Debug` build artifacts afterward to recover disk.

### Phase 5 QA

- Rechecked build 53/build 60 email-ingestion and Today/profile requirements before editing the active SwiftUI target.
- Targeted `git diff --check` for Phase 5 SwiftUI files: passed.
- Static requirement checks confirmed the email-ingestion record derivation, latest forwarded-document lookup, status icons, forwarding-address copy surface, signed-out hiding behavior, profile-context card, and Today bottom scroll reserve are present.
- Reused `/tmp/codex-xcode/healthfolio-phase1`; copied only Phase 5 native files into it.
- Debug simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- Release simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- `npm -w mobile run typecheck` in the temp snapshot: passed.
- `npm -w api run typecheck` in the temp snapshot: passed.
- Installed and launched the Debug simulator app on iPhone 16e simulator. Screenshot `/tmp/healthfolio-phase5-launch.png` showed the new signed-out Profile context card rendering on Today.
- Targeted simulator log query for the previously fixed SwiftUI lifecycle warning, fatal errors, crash strings, or SwiftUI warnings returned no entries.
- Visual QA flagged tab-bar overlap risk after adding the Today content. Added a bottom scroll reserve, then rebuilt Debug and Release again; both passed.
- Reinstalled and relaunched the rebuilt Debug app. Screenshot `/tmp/healthfolio-phase5-launch-after-inset.png` showed the updated Today screen rendering, and the targeted simulator log query again returned no entries.
- Shut down the simulator and deleted only generated `/tmp/codex-xcode/DerivedData/HealthFolioPhase5Debug` build artifacts afterward to recover disk.

### Phase 6 QA

- Rechecked build 53/build 60 upload requirements before editing the active SwiftUI target.
- Targeted `git diff --check` for Phase 6 SwiftUI/AppDelegate files: passed.
- Static requirement checks confirmed PhotosPicker multi-select, staged file/photo imports, pinned upload owner profile IDs/names, retry/remove queue actions, staged-file cleanup, and stricter auth-callback URL routing are present.
- Reused `/tmp/codex-xcode/healthfolio-phase1`; copied only Phase 6 native files into it.
- Debug simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- Release simulator build from the temp snapshot with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64 CODE_SIGNING_ALLOWED=NO`: passed.
- `npm -w mobile run typecheck` in the temp snapshot: passed.
- `npm -w api run typecheck` in the temp snapshot: passed.
- Installed and launched the Debug simulator app on iPhone 16e simulator. Screenshot `/tmp/healthfolio-phase6-launch.png` showed the HealthFolio SwiftUI app rendering after launch, and the targeted simulator log query returned no SwiftUI lifecycle warning, fatal, or crash entries.
- During URL smoke, `healthfolio://documents/new` exposed that every HealthFolio custom-scheme URL was being routed as an auth callback. Fixed the route filter to accept only `healthfolio://auth/callback`.
- Rebuilt Debug and Release after the AppDelegate URL-router fix: both passed.
- Reinstalled and relaunched the rebuilt Debug app. Opening `healthfolio://documents/new` stopped at iOS's first-use custom-scheme confirmation and produced no targeted app warning, crash, or invalid-sign-in log entries.
- Rebooted the simulator to clear the system URL prompt, relaunched the app, and captured `/tmp/healthfolio-phase6-clean-launch.png`; the targeted log query again returned no SwiftUI lifecycle warning, fatal, or crash entries.
- Shut down the simulator and deleted only generated `/tmp/codex-xcode/DerivedData/HealthFolioPhase6Debug` build artifacts afterward to recover disk.

### Final artifact QA

- Confirmed the no-space temp snapshot `/tmp/codex-xcode/healthfolio-phase1` matched the current touched native files before archive/export.
- `npm -w mobile run typecheck -- --pretty false` in the temp snapshot: passed.
- `npm -w api run typecheck -- --pretty false` in the temp snapshot: passed.
- `plutil -lint apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj apps/mobile/ios/HealthFolio/Info.plist`: passed.
- Decoded the installed local provisioning profile and found it was for `com.starklabs.medzy`, not HealthFolio, so a direct manual archive could not be trusted.
- First archive attempt with automatic signing failed because the project Release config hardcoded an old manual distribution identity.
- Retried archive with automatic signing and a cleared code-sign identity. `xcodebuild archive` completed, producing `/tmp/codex-xcode/archive/HealthFolio-1.0.0-60.xcarchive`; the archive itself was unsigned, so it was not treated as sufficient proof.
- Exported that archive with the repo's existing HealthFolio App Store export options and `-allowProvisioningUpdates`; `xcodebuild -exportArchive` succeeded and produced `/tmp/codex-xcode/export/HealthFolio-1.0.0-60/HealthFolio.ipa`.
- Verified the exported IPA by unzipping it, checking `Info.plist`, running `codesign --verify --deep --strict --verbose=2`, checking signing authority and TeamIdentifier, and decoding `embedded.mobileprovision`.
- Copied the first verified IPA and logs into `build/ios/export/20260626-071636/`.

### SwiftUI migration follow-up QA

- Checked for stopped/background npm, xcodebuild, EAS, Expo, altool, and notarytool work before continuing. No npm install process was left running.
- Audited the active SwiftUI upload path against the old React Native upload screen and fixed SwiftUI migration regressions: removed the local-only Manual source path, added Open navigation for analyzed uploads, and corrected the upload queue owner-profile checkmark.
- Kept iOS 16-compatible one-argument `onChange` handlers after a debug build proved the newer zero/two-argument APIs require iOS 17.
- Added `SceneDelegate` and `UIApplicationSceneManifest` so the SwiftUI app creates its root `UIHostingController` through `UIWindowScene`.
- Confirmed the no-space temp snapshot matched the current SwiftUIPrototype and lifecycle files: 50 SwiftUIPrototype Swift files in workspace and snapshot.
- `plutil -lint apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj apps/mobile/ios/HealthFolio/Info.plist`: passed in both workspace and snapshot.
- Debug simulator build from the temp snapshot with scene/upload fixes: passed.
- Release simulator build from the temp snapshot with scene/upload fixes: passed.
- Installed and launched the Release simulator app on iPhone 16e simulator. `simctl launch` returned PID `42879`; screenshot `/tmp/healthfolio-scene-release-smoke.png` showed the SwiftUI app rendering.
- Targeted simulator log review showed no crash, fatal, exception, or `UIScene lifecycle will soon be required` warning after the scene lifecycle fix.
- The remaining `UIBackgroundModes` runtime messages come from Expo's inherited app delegate methods; repo search found no HealthFolio background fetch/remote-notification configuration or app-level background-mode use, so no background capability was added.
- Deleted only generated simulator DerivedData `/tmp/codex-xcode/DD-scene-debug` after QA to recover archive space.
- `npm -w mobile run typecheck -- --pretty false` in the temp snapshot: passed.
- `npm -w api run typecheck -- --pretty false` in the temp snapshot: passed.
- Rebuilt the device archive from the fixed temp snapshot with automatic signing and cleared code-sign identity. `xcodebuild archive` succeeded at `/tmp/codex-xcode/archive/HealthFolio-1.0.0-60.xcarchive`; the archive itself remained unsigned and was not treated as final proof.
- Exported the archive with the HealthFolio App Store export options and `-allowProvisioningUpdates`; `xcodebuild -exportArchive` succeeded and produced `/tmp/codex-xcode/export/HealthFolio-1.0.0-60/HealthFolio.ipa`.
- Verified the new exported IPA by unzipping it, checking bundle id/version/build, running `codesign --verify --deep --strict --verbose=2`, checking signing authority and TeamIdentifier, and decoding `embedded.mobileprovision`.
- Copied the verified post-fix IPA and logs into `build/ios/export/20260626-074324-swiftui-scene-b60/`.

### Build 62/63/64/65 SwiftUI auth/package QA and TestFlight upload

- Investigated build 61 screenshots showing the missing `I'm new` page and raw `AuthenticationServices.WebAuthenticationSession error 1` surfaced in Today, Records, Trends, and Profile.
- Confirmed the active shipped shell is SwiftUI, not the older React Native route tree, and restored signed-out launch to `AuthNativeView`.
- Restored the signed-out welcome page with `I'm new` and `I have an account`.
- Added the account form with email password sign-up/sign-in, magic-link sign-in, and Apple/Google social buttons.
- Replaced the old web OAuth path for native SwiftUI Apple/Google sign-in with native `AuthenticationServices` and `GoogleSignIn`, followed by Supabase `signInWithIdToken`.
- Routed Google Sign-In callbacks through both `AppDelegate` and `SceneDelegate` before HealthFolio custom auth callback handling, so Google OAuth no longer falls into the old web-auth error path.
- Added friendly auth error copy so the raw `AuthenticationServices.WebAuthenticationSession error 1` is no longer shown to signed-out users on main tabs.
- Reset signed-out app state to a signed-out profile instead of seeded/demo profile data, avoiding the build 61 `Nalin`/demo context appearing while logged out.
- Updated iOS/app build metadata to `1.0.0 (63)`.
- Fixed stale React Native package drift that could break EAS packaging: regenerated the lockfile, aligned React/@types React 19 for the mobile/React Native workspace, added direct `@expo/vector-icons`, and added direct `babel-preset-expo` for release bundling.
- Enabled React Native source builds for iOS pods, regenerated `Podfile.lock`, and restored the `Bundle React Native code and images` build phase so the SwiftUI shell still has a valid React Native/Expo project graph for EAS.
- Restored legacy RN `SearchField` and `SelectablePill` exports and a `signInWithNativeGoogle` compatibility alias so the old Expo route tree typechecks even though the shipped shell is SwiftUI.
- Fixed the legacy upload queue lint failure by replacing the `while (true)` loop with an explicit queued-item loop.
- Reproduced the first build 63 EAS dependency-install failure locally with npm `10.9.4`, regenerated `package-lock.json` with npm `10.9.4`, and confirmed `npm ci --include=dev --ignore-scripts --no-audit --no-fund` passes with npm `10.9.4`.
- Build 62 EAS upload is superseded and should not be treated as final: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/c3d0f957-c283-4050-872b-db58916ba536`.
- Build 63 first EAS attempt failed during dependency install before compile because npm `10.9.4` rejected the old lockfile: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/d72c6b4f-23d4-42bd-831c-2b7e24192b40`.
- EAS production iOS build completed for final build 63: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/30cc10a1-f40b-49a9-897c-b3c32bb1a015`.
- EAS produced the final build 63 IPA: `https://expo.dev/artifacts/eas/joMhV-t4kPHZt4FI8lecsZJJ1B4XxArZlnNhLA87BeY.ipa`.
- EAS submit uploaded build `1.0.0 (63)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/2bae0a06-66ab-4324-9d9a-02adf9b439ef`.
- Investigated build 63 login failure screenshot showing `The data couldn't be read because it isn't in the correct format.`
- Confirmed live Supabase data exists and is not missing: `User` 49, `Document` 176, and `ParameterReading` 1783.
- Confirmed live Supabase auth metadata contains non-string values, so SwiftUI's `[String: String]` `user_metadata` decoder could reject valid `/auth/v1/user` responses after successful password/social auth.
- Changed native auth-user metadata decoding to tolerate strings, numbers, booleans, arrays, and objects while preserving the string names used for default profile creation.
- Added password reset request support through Supabase recovery email, recovery/magic-link `token_hash` callback verification, an authenticated password update call, a `Forgot password?` action on the sign-in form, and a modal reset-password completion sheet after recovery links open the app.
- Updated iOS/app build metadata to `1.0.0 (64)`.
- Local build 64 QA passed in the no-space clone: plist/project lint, mobile typecheck, mobile lint, mobile tests, Debug simulator build, and simulator launch screenshot at `/tmp/healthfolio-build64-auth-smoke.png`.
- EAS production iOS build completed for final build 64: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/2af48fc1-3070-4e71-b0c7-69096b1332ee`.
- EAS produced the final build 64 IPA: `https://expo.dev/artifacts/eas/A0hISbuei65rvov9TbyGHQaZJeREr_uzBuqsjw4TqvU.ipa`.
- EAS submit uploaded build `1.0.0 (64)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/429006f5-ed2e-4f97-809a-3c6de2efc63f`.
- Investigated the follow-up build 64 screenshots/requests around broken PDF open/preview, confusing Trends graphs, marker range popups, health-score explanation gaps, manual profile correction, medication input UI, and cleanup while preserving the existing visual theme.
- Added in-app QuickLook-backed document opening that downloads signed storage URLs into local preview files before presentation, avoiding the remote URL open path that was producing popup failures for uploaded PDFs/docs.
- Added richer Trends graph modes (`Range`, `Status`, `Dots`) using numeric marker values and resolved Supabase `ParameterCatalog` reference ranges; marker rows/cards now open a clean detail sheet with actual range, status, panel, source, and mini chart context.
- Added health-score reason/gap generation plus current chronological age versus report-based age display in the dark score card and the assistant's health-score answer.
- Added manual profile correction persistence for name, date of birth, sex, blood group, unit preference, and email-ingestion alias through native Supabase REST, with local signed-out fallback.
- Improved medication/reminder input with explicit medicine, dosage, timing, and instruction fields while preserving the local notification scheduler path.
- Cleaned record kind labels for blood reports, prescriptions, medicines, and other reports; added assistant stats context for records/markers/flags.
- Updated iOS/app build metadata to `1.0.0 (65)`.
- Local build 65 QA passed in the no-space clone: plist/project lint, mobile typecheck, mobile lint, mobile tests, Debug simulator build, Info.plist version/build check, and simulator launch screenshot at `/tmp/healthfolio-build65-smoke.png`.
- EAS production iOS build completed for final build 65: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/411f1eca-765c-4ebe-8d40-aac8021e82dd`.
- EAS produced the final build 65 IPA: `https://expo.dev/artifacts/eas/m9w3Y37zCbwW9g-A5Qv5DDSuLZydX1_ufLgfQarnQVY.ipa`.
- EAS submit uploaded build `1.0.0 (65)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/ae5717e8-5c99-4a81-ad02-b92f6de27ac7`.
- App Store Connect target: `https://appstoreconnect.apple.com/apps/6773293787/testflight/ios`.
- Investigated build 65/66 screenshots and requests showing Supabase reset email returning a raw 400, profile switching requiring repeated taps, Trends data points reading as uneven blocks, Today needing health score above profile context, email ingestion belonging in Profile, and old PDF previews downloading a 37-byte invalid file.
- Moved Today health score above the profile-context card and kept the forwarding address in Profile, matching the requested information hierarchy.
- Added guarded optimistic SwiftUI profile switching with a visible selected-pill spinner and duplicate-tap/concurrent-switch protection.
- Reworked Trends mini charts into uniform line/point charts with clearer data points, consistent grid/range bands, and the existing color direction preserved.
- Improved assistant marker matching so questions like sugar/HbA1c/thyroid/bilirubin return specific marker value, date, status, reference range, source, and review guidance instead of broad source summaries.
- Hardened password reset requests with local email validation and friendlier Supabase/Auth copy, including explicit redirect allowlist guidance when Supabase rejects the recovery URL.
- Hardened document preview downloads by normalizing Supabase storage object URLs to signed paths, rejecting non-2xx/empty responses, and verifying PDF bytes start with `%PDF` before QuickLook opens the local copy.
- Added a CocoaPods post-install fix that deduplicates generated module-map flags per build-setting line; this fixes React Native 0.83 generated pod module-map redefinition failures while preserving Swift/third-party module imports such as `AppAuth`.
- Regenerated `package-lock.json` because `npm ci` in the no-space release snapshot failed from lock/package drift, which would also block EAS dependency installation.
- Updated iOS/app build metadata to `1.0.0 (66)`.
- Local build 66 QA passed in `/tmp/healthfolio-b66-clone`: `npm ci --include=dev --ignore-scripts --no-audit --no-fund`, `pod install`, `xcodebuild -workspace HealthFolio.xcworkspace -scheme HealthFolio -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/healthfolio-build66-check/DerivedData CODE_SIGNING_ALLOWED=NO build`, package builds for `@medical-tracker/shared-types` and `@medical-tracker/parameter-catalog`, mobile typecheck, mobile lint, and mobile tests.
- Installed and launched the build 66 Debug simulator app on iPhone 16e. Screenshot `/tmp/healthfolio-build66-smoke.png` showed the signed-out welcome page with `I'm new` and `I have an account` visible.
- EAS production iOS build completed for final build 66: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/4a1e5336-564e-4670-817f-f4d314a6a41b`.
- EAS produced the final build 66 IPA: `https://expo.dev/artifacts/eas/tfa3DgeJSYj4QPTwjeZwNf1oP9n7tvfXaUC5UKu8Tf0.ipa`.
- EAS submit uploaded build `1.0.0 (66)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/e48743cb-c785-4b7d-af1f-e82374aaa916`.
- Investigated the build 66 follow-up screenshots showing old document previews still failing with storage `404` and Trends cards losing the preferred block-style visual language.
- Hardened native document opening for previously uploaded files by resolving multiple likely Supabase storage paths from the document id, owner auth user id, filename, original key, `documents/` and `email/` folders, and storage-list recovery before returning a signed URL.
- Added signed URL `HEAD` probing so the app rejects stale/incorrect storage candidates before QuickLook downloads them, instead of saving invalid 37-byte error bodies as PDFs.
- Updated document detail to download both PDFs and image originals into local preview files before opening, so `Open` and the inline preview use local QuickLook/image rendering instead of fragile remote-object presentation.
- Restored the Trends mini charts to the cleaner block-style card treatment: rounded per-reading bars, visible white-rimmed markers, retained mint reference band, and status color preserved across `Range`, `Status`, and `Dots` modes.
- Updated iOS/app build metadata to `1.0.0 (67)`.
- Local build 67 QA passed in `/tmp/healthfolio-b67-clone`: `pod install`, `xcodebuild -workspace HealthFolio.xcworkspace -scheme HealthFolio -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/healthfolio-build67-check/DerivedData CODE_SIGNING_ALLOWED=NO build`, package builds for `@medical-tracker/shared-types` and `@medical-tracker/parameter-catalog`, mobile typecheck, mobile lint, mobile tests, `git diff --check`, Info.plist lint, build-number sync checks, and simulator install/launch screenshot at `/tmp/healthfolio-build67-smoke.png`.
- EAS production iOS build completed for final build 67: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/b74bbb1e-b3cd-46e8-94fc-c6716d23aaee`.
- EAS produced the final build 67 IPA: `https://expo.dev/artifacts/eas/-yTXNfY-YGE_2zZKnAD2E-4Y3oRpcqOA2u5o5LuKdeQ.ipa`.
- EAS submit uploaded build `1.0.0 (67)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/9e309ba8-263f-408e-bf04-aab18f12f6e8`.
- Investigated build 67 reset-password feedback showing Safari could not connect after opening the recovery link. Fixed the Swift recovery request to pass `redirect_to=healthfolio://auth/callback` as a Supabase recover query parameter instead of an ignored JSON body field, then sent a fresh reset email and verified Supabase accepted it.
- Temporarily unblocked Shreyans Kajaria's email/password login from Supabase Auth and verified the password grant works; the temporary password was kept out of repo/docs and should be changed immediately after login.
- Cleaned Shreyans' production profile data after noisy OCR names created duplicate managed profiles: consolidated 107 active documents and 263 readings into the real owner profile, soft-deleted duplicate email-ingest document rows that would collide on the active unique key, and revoked noisy duplicate family-link rows while preserving the one unrelated managed profile.
- Added deployed Supabase RPC support for merging a managed profile into the owner profile. The RPC moves documents, readings, share/export references, soft-deletes duplicate email-ingest rows, revokes the source family link, returns accurate counts, and is executable only by authenticated callers.
- Changed `process-document-ocr` profile resolution so raw OCR patient names no longer auto-create managed profiles. OCR now matches an existing approved/linked profile when the name is clear enough; otherwise it keeps the upload on the current owner/selected profile for manual review.
- Added native Profile review actions for duplicate managed profiles: `Review profile` now exposes `Merge into Me`, shows a confirmation dialog, calls the merge RPC, refreshes live data, and keeps profile switching guarded against concurrent taps.
- Updated iOS/app build metadata to `1.0.0 (68)`.
- Local build 68 QA passed in `/tmp/healthfolio-b68-clone`: mobile typecheck, mobile lint, `git diff --check`, Info.plist lint, build-number sync checks, Debug simulator `xcodebuild`, and simulator install/launch screenshot at `/tmp/healthfolio-build68-smoke.png`.
- EAS production iOS build completed for final build 68: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/4ed77315-59b7-4c7b-8961-16e65c59a20d`.
- EAS produced the final build 68 IPA: `https://expo.dev/artifacts/eas/XS-vbhca37qObuRUckc_2SBk0HBN1NKouRxtA6gpGaM.ipa`.
- EAS submit uploaded build `1.0.0 (68)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/c35ee0fb-dec5-4b73-a6ff-90568101b21b`.
- Parsed the July 6 meeting notes into shipped versus remaining work. Build 68 already covers health score age/reasons/gaps, flagged markers, profile reset/share links, email forwarding in Profile, multi-file/photo upload, prescription OCR warning, reminders/notifications, and profile duplicate merge support.
- Started the next app-only build-69-prep batch without submitting a new EAS build: added password visibility toggles to the main auth flow, Profile sign-in form, and password-reset sheet while preserving native autofill/content-type hints.
- Added signed-out trust messaging so new users see a concise privacy note before upload/sign-in decisions.
- Added upload guidance to the Add record screen with acceptable medical document types, warnings against unrelated bank/insurance/ID files, and clearer OCR/blurry-image expectations.
- Added Care summary sharing and a compact medicine summary table for saved medicine reminders, while keeping the existing manual medicine, dosage, timing, source-link, and notification flow.
- Local build-69-prep QA passed in `/tmp/healthfolio-b68-clone`: `git diff --check`, Debug simulator `xcodebuild`, simulator boot/install/launch screenshot at `/tmp/healthfolio-build69-prep-smoke.png`, mobile typecheck, and mobile lint.
- Added explicit privacy/consent copy on the signed-out auth screen: HealthFolio does not share medical records with others unless the user creates a secure share link.
- Added an Assistant composer disclaimer that HealthFolio AI can make mistakes, uses HealthFolio context for answers, and does not replace clinician advice.
- Added a first-launch guide for new signed-in users with zero records. The guide steps through profile selection, Records, Add record/plus, acceptable upload types, and where results appear; finishing the guide opens the upload sheet and stores a local seen flag.
- Updated iOS/app build metadata to `1.0.0 (69)`.
- Local build 69 QA passed in `/tmp/healthfolio-b69-clone`: `npm ci --include=dev --ignore-scripts --no-audit --no-fund`, package builds for `@medical-tracker/shared-types` and `@medical-tracker/parameter-catalog`, mobile typecheck, mobile lint, `pod install`, `git diff --check`, Info.plist lint, build-number sync checks, Debug simulator `xcodebuild`, and simulator install/launch screenshot at `/tmp/healthfolio-build69-release-smoke.png`.
- EAS production iOS build completed for final build 69: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/43ad2bd7-8fa1-4b27-99b6-00f44717baf9`.
- EAS produced the final build 69 IPA: `https://expo.dev/artifacts/eas/HYXaj4pIynttBJJp_KDHo-tYWLgNPoPa8ZQLxLV2sMo.ipa`.
- EAS submit uploaded build `1.0.0 (69)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/c7dad91f-cc9e-4802-b06c-b969f06a8cee`.
- Added the build 70 Option B first-launch guide update: contextual spotlights now point to Profile, Records, Add record, and the upload source tiles, and the final first-launch step opens the upload sheet before starting the file picker.
- Tightened Add record unsupported-document copy so bank statements, insurance forms, invoices, IDs, and unrelated documents are explicitly described as not imported.
- Updated build metadata to `1.0.0 (70)` across `apps/mobile/app.json`, Xcode `CURRENT_PROJECT_VERSION`, and the hardcoded native `CFBundleVersion` in `Info.plist`.
- Fixed the EAS npm 10 install gate by regenerating `package-lock.json` with npm `10.9.4`; the earlier EAS attempt failed in Install dependencies because npm 10 required workspace-local `zod@3.23.8` lockfile entries that npm 11 had tolerated locally.
- Local build 70 QA passed from the current checkout and no-space snapshots: `npm run cleanup:verify:native`, `npx --yes -p npm@10.9.4 npm ci --include=dev --ignore-scripts --no-audit --no-fund`, `npm run cleanup:verify`, `git diff --check`, and `plutil -lint`.
- EAS production iOS build completed for final build 70: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/9e134bde-b787-4f23-a45e-b11ce0a7f55c`.
- EAS produced the final build 70 IPA: `https://expo.dev/artifacts/eas/gKFPfGEVx5LMIFLtvoMQLUKGcT1hXE7qwQptZstsFPA.ipa`.
- EAS submit uploaded build `1.0.0 (70)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/bd21bfa9-e4e6-4ca7-8d49-f9f2fc5f7536`.
- Fixed the first-launch guide regression for build 71: the `I'm new` path now carries a new-account intent through email, Apple, and Google auth, uses a new `healthfolio.native.firstLaunchGuide.v2.contextual` seen key, and signed-in refresh failures no longer reset the zero-record dashboard back to the auth welcome screen unless the session is actually missing.
- Added `npm run test:ios-onboarding` and wired it into the cleanup verifier so the new-account guide trigger and refresh-reset policy are covered by a fast Swift regression test.
- Updated build metadata to `1.0.0 (71)` across `apps/mobile/app.json`, Xcode `CURRENT_PROJECT_VERSION`, and the hardcoded native `CFBundleVersion` in `Info.plist`.
- Local build 71 QA passed from `/tmp/healthfolio-b71-clone`: `npx --yes -p npm@10.9.4 npm ci --include=dev --ignore-scripts --no-audit --no-fund`, `npm run test:ios-onboarding`, package builds for `@medical-tracker/shared-types`, `@medical-tracker/parameter-catalog`, and `@medical-tracker/phi-scrubber`, mobile typecheck, mobile lint, and `plutil -lint`.
- EAS production iOS build completed for final build 71: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/cb8ecb74-8dfe-4136-ad6f-0c41a6e17c64`.
- EAS produced the final build 71 IPA: `https://expo.dev/artifacts/eas/qJpve5f-ZmMyqKpZafyGwLHSbhHItpAMoF-Y1DMvVDM.ipa`.
- EAS submit uploaded build `1.0.0 (71)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/3ca4091b-e3ad-4416-aac3-e84efeb50f31`.
- Fixed build 72 first-launch guide presentation by removing stale hardcoded dashed spotlights. The guide still appears for new signed-in zero-record users, but no longer draws misaligned target boxes over the tab bar, Profile button, Add record controls, or upload sheet.
- Removed the duplicate large `Add record` button from Records; the toolbar plus button is now the single add-record entry point.
- Reworked Trends cards to the cleaner vertical-bar sparkline treatment requested from the reference screenshot, using actual history where available and plausible single-marker context where only one reading exists.
- Removed negative bank/insurance/invoice/ID copy from the upload guide and moved unsupported-document handling into the OCR failure path.
- Deployed `process-document-ocr` to Supabase project `qojdeuacwkmlxmodeabt` with shared unsupported-document classification for manual upload and forwarded mail. Unsupported documents now fail with the concise user-facing message: `This file does not look like a medical record.`
- Updated native upload invocation so a failed OCR function result is surfaced immediately instead of treating the HTTP invocation itself as success.
- Added `npm run test:build72-regressions` to lock the build 72 bug fixes: single Add record entry point, no stale first-launch spotlights, vertical Trends bars, no negative upload-guide copy, OCR medical/non-medical classification, and native OCR failure decoding.
- Updated build metadata to `1.0.0 (72)` across `apps/mobile/app.json`, Xcode `CURRENT_PROJECT_VERSION`, and the hardcoded native `CFBundleVersion` in `Info.plist`.
- Local build 72 QA passed from the current checkout and `/tmp/healthfolio-b72-clone`: `git diff --check`, `git diff --cached --check`, `plutil -lint apps/mobile/ios/HealthFolio/Info.plist`, `npm run test:ios-onboarding`, `npm run test:build72-regressions`, Swift parse checks for the touched SwiftUI files, package builds for `@medical-tracker/shared-types`, `@medical-tracker/parameter-catalog`, and `@medical-tracker/phi-scrubber`, `npm run typecheck --workspace mobile`, `npm run lint --workspace mobile`, and `pod install`.
- EAS production iOS build completed for final build 72: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/387122b1-3bf1-4164-8f0e-189976ff440a`.
- EAS produced the final build 72 IPA: `https://expo.dev/artifacts/eas/GUyDkVsDgzrR9kCVxAMsA8yByRxIZPBKqLcQoc4ezr0.ipa`.
- EAS submit uploaded build `1.0.0 (72)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/38f71aaa-28bb-488f-bcc7-fc70de4983f6`.
- Completed build 73 App Store readiness: versioned consent, Standard Apple EULA disclosure, in-app account deletion, published privacy/support/privacy-choices pages, iPhone-only submission metadata, and removal of unused microphone permission declarations.
- Hardened account deletion against revoked-but-unexpired Supabase JWTs. `upsert_app_user_profile` now requires the backing `auth.users` identity to exist, and authenticated clients can no longer insert `User` rows directly to recreate a deleted app profile.
- Deployed migrations `20260712160021_reject_deleted_auth_jwts.sql` and `20260712161011_revoke_direct_user_inserts.sql` to Supabase project `qojdeuacwkmlxmodeabt`.
- Added a reproducible account-deletion smoke harness that creates a synthetic owner and managed profile, consent, document/reading, doctor share/access, export, and storage objects; deletes the account; rejects reauthentication; probes stale-JWT RPC/direct-table/storage access; and verifies no residual Auth, app, audit, or storage data with the service role.
- A final live production deletion smoke passed after both hardening migrations. It verified exact invalid-credentials reauthentication rejection, stale-JWT REST/direct-insert/storage denial, and administrative cleanup across all seeded rows and both storage buckets.
- Build 73 release QA passed from `/tmp/healthfolio-b73-release.vIbb4M/repo`: package builds for `@medical-tracker/shared-types` and `@medical-tracker/parameter-catalog`, mobile TypeScript, mobile lint, `plutil -lint`, and `npm run test:build73-regressions`. The native App Store EAS build also compiled successfully.
- EAS production iOS build completed for build 73: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/0dc126f5-c4c3-4cf0-af47-bd1d751947d7`.
- EAS produced the build 73 IPA: `https://expo.dev/artifacts/eas/NXfHfBHyA2rTylatQtjvOA87n2wQ5QkaOr4pPesfWjI.ipa`.
- EAS submit uploaded build `1.0.0 (73)` to App Store Connect/TestFlight and Apple accepted the binary for processing: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/e6d34325-58fb-435f-9afb-4edf31dd67e4`.

### Assistant backend-only migration (2026-07-17)

- Moved the shipped SwiftUI Assistant response path to authenticated Supabase Edge Functions: `assistant-config` returns public behavior/version controls, and `assistant-response` verifies the bearer token, authorizes the selected primary or managed profile, loads only that profile's non-deleted documents/readings, and calls OpenAI with `store: false`.
- The OpenAI key, system prompt, model, output limit, question limit, and timeout remain backend-only. The app receives stable JSON fields: `answer`, `sourceRecordIds`, `isRefusal`, `configVersion`, and `responseSchemaVersion`.
- Added the SwiftUI bridge, bounded profile-scoped history payload, remote model decoding, and a source-free unavailable message. The app no longer invokes the legacy local Assistant answer path when the remote function is disabled or unreachable.
- Added `scripts/test-healthfolio-backend-assistant-regressions.mjs` and `scripts/test-healthfolio-assistant-remote-models.swift`. The first validates backend/profile-scope/key-isolation contracts; the second validates stable Swift response decoding.
- Deployed both functions to Supabase project `qojdeuacwkmlxmodeabt`. Unauthenticated smoke checks returned `401` for both endpoints. Default remote configuration is `enabled=true`, version `1`, model `gpt-4.1-mini`, and a 2,000-character question limit; non-secret overrides can be applied through Supabase function secrets.
- This change requires a new native EAS build before TestFlight validation. Do not treat the interrupted local no-space Xcode snapshot build as a pass; the targeted Swift model test, mobile typecheck/lint, and Edge Function contract checks must be rerun before staging.
- Updated native/app build metadata to `1.0.0 (75)` for the Assistant bridge release. The first EAS attempt exposed a real Swift compiler regression in source-to-record mapping (`ElementOfResult` could not be inferred); commit `f5b63ed` added an explicit `String -> HealthRecord?` closure annotation and a regression contract, then the cloud build passed.
- Build 75 release QA passed: `npm run typecheck --workspace mobile`, `npm run lint --workspace mobile`, `npm run test:backend-assistant`, `npm run test:assistant-remote-models`, `npm run test:assistant-policy`, `npm run test:assistant-history`, `npm run test:auth-assistant`, `npm run test:build73-regressions`, `npm run test:ocr-ingestion`, `swiftc -frontend -parse` on the changed app model, `git diff --check`, staged secret/generated-file scans, and `plutil -lint apps/mobile/ios/HealthFolio/Info.plist`. The full local no-space Xcode archive was not treated as a pass because it stalled during build-service setup; EAS was the authoritative native compiler check.
- EAS production iOS build completed for build 75: `https://expo.dev/accounts/starklabs/projects/healthfolio/builds/89f06920-24b5-4264-8bc0-edc14c979afb`.
- EAS produced the build 75 IPA: `https://expo.dev/artifacts/eas/ZAU0Qtg4D5m4ITXnBcMNNB3n7mtdKyd8-l_x_7kvRbM.ipa`.
- EAS submit uploaded build `1.0.0 (75)` to App Store Connect/TestFlight and Apple is processing the binary: `https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/e8f030a4-6353-4b38-98c1-460c8aa9f3ab`.

## Repeatable cleanup/release pipeline

Use this pipeline the next time HealthFolio has a large dirty checkout or post-TestFlight cleanup batch:

1. Capture the baseline: note the latest TestFlight build number, the active shipped surface (`apps/mobile/ios/HealthFolio/SwiftUIPrototype`), and any backend functions/migrations that must ship with the app.
2. Classify the dirty tree with `git status --short`, `git diff --stat`, and explicit path review. Put files into release buckets: SwiftUI app, React Native/Expo compatibility, Supabase/backend, docs, generated artifacts, and do-not-commit.
3. Review first, fix second. List concrete bugs, stale generated files, secrets risk, missing tests, and accidental broad rewrites before editing. Do not revert unrelated user/agent work.
4. For every bug fix, add a targeted regression check before or alongside the implementation. Prefer fast source-level tests for UI invariants and focused backend tests/fixtures for OCR behavior.
5. Verify from a no-space temp snapshot under `/tmp`, because the local repo path contains a space and has previously caused slow or flaky native checks.
6. Run the minimum release gate before staging: `git diff --check`, `plutil -lint apps/mobile/ios/HealthFolio/Info.plist`, focused regression tests, package builds for workspace dependencies, `npm run typecheck --workspace mobile`, and `npm run lint --workspace mobile`.
7. If a backend function changed, deploy or smoke it before the app build. EAS only ships the mobile binary; Supabase Edge Functions must be deployed separately.
8. Stage explicit paths only. Run `git diff --cached --stat`, `git diff --cached --check`, and a secret/generated-file scan before committing.
9. Commit by coherent ownership boundary when possible: backend/Supabase, RN/Expo compatibility, SwiftUI release features, and docs/handoff. A single commit is acceptable only when the change is one tightly coupled release fix.
10. Build with EAS from a clean no-space snapshot, submit the exact EAS build ID to App Store Connect, then update this handoff with build URL, IPA URL, submission URL, checks run, and residual manual TestFlight items.

## Known issues

- Existing React Native doctor-share reuse actions require the API change to be deployed so `GET /shares` returns `shareUrl`; the SwiftUI doctor-share screen builds links directly from the Supabase row token.
- Document file size/content type depends on signed storage URL `HEAD` support. If unavailable, the app falls back to stored document metadata.
- Authenticated live smoke checks are still required for real user data: signed file URLs, DoctorShare list/create/revoke under RLS, and single-use link consumption behavior.
- The Supabase app connector in Codex requires reauthentication, so live backend checks used the linked Supabase CLI instead.
- Supabase security advisor still reports signed-in `SECURITY DEFINER` execution for intentional authenticated app/RLS helper RPCs. Eliminating those remaining advisor warnings would require a broader private-schema/RPC redesign beyond this build-53 restoration pass.
- Supabase Auth leaked-password protection is disabled and should be enabled in the Supabase dashboard/Auth settings; the local CLI config surface did not expose a targeted toggle for this setting.
- Local notification delivery and the actual iOS permission prompt should still be device/TestFlight-smoked from the Care tab with a near-future medication reminder, because simulator command-line tools did not expose a reliable tap path for creating a reminder in-app.
- Full raw PDF text search is still not available unless the backend stores richer extracted text; the assistant now says this explicitly.
- Persisted assistant source links depend on the currently loaded profile records. If a saved message references another profile or unloaded data, the UI shows that the sources are not loaded for the current profile.
- Simulator command-line tooling did not expose a reliable tap path into the AI tab, so assistant UI validation used compile/static checks plus launch screenshots. Device/TestFlight should still manually open AI, ask the quick prompts, clear history, and confirm source rows navigate.
- Family role PATCH and document reassignment use direct Supabase REST in the native SwiftUI app. They compile and route correctly, but still need a live authenticated smoke test to confirm RLS allows PATCHing `FamilyLink.role`, `Document.ownerUserId`, and linked `ParameterReading.userId`.
- Simulator command-line tooling still did not expose a reliable tap path into Profile or document detail, so Phase 4 interaction validation used compile/static checks plus launch screenshots. Device/TestFlight should manually switch profiles, edit managed roles, upload to one profile, and move the uploaded document to another profile.
- The backend/native data currently exposes forwarded-email visibility only once a `Document`/OCR row exists. A richer inbox surface for received-only, duplicate, queued, or failed-before-document events still requires backend event data beyond the document fields available to the SwiftUI app.
- Simulator command-line tooling did not expose a touch/scroll gesture path, so Phase 5 Today validation used compile/static checks, launch screenshots, and a code-level bottom scroll reserve. Device/TestFlight should still manually scroll Today and test the forwarding-address copy button while signed in.
- Simulator command-line tooling did not expose a reliable tap path into Records/Add record, and Simulator.app did not expose a GUI window to macOS System Events in this environment. Phase 6 upload validation used compile/static checks plus launch/log smoke. Device/TestFlight should manually open Add record, multi-select Files, multi-select Photos, verify target profile copy, retry a forced failed upload if possible, remove queue rows, and move an analyzed upload between profiles.
- True live batch camera scanning remains deferred. The current SwiftUI app supports multi-file Files and multi-photo Photos selection, while Camera still uses existing scans/images as the practical OCR path.
- The original workspace path under `Documents/health tracker` still showed slow or hanging behavior for some npm/native commands, so clean no-space temp snapshots should remain the default build workflow.
- Local release archive still cannot be treated as the distribution artifact in this environment because local Xcode has no authenticated Apple account/provisioning profile with the Sign In with Apple entitlement. EAS remote credentials are valid and were used for the submitted build 67 artifact.
- Simulator command-line tooling in this desktop session did not expose a reliable tap path into the account form; launch-state visual QA verified the `I'm new`/`I have an account` welcome screen, and Apple/Google account-form verification used SwiftUI source checks plus successful debug build. Device/TestFlight should still manually open `I have an account` and test both Apple and Google with real accounts.
- Signed-in PDF, trends popup, profile-save, and medication-notification flows need device/TestFlight validation with real user data because the local simulator smoke did not have production user credentials or uploaded private document state.
- Build 68 duplicate-profile merging still needs a signed-in device/TestFlight smoke on a real account with duplicate managed profiles to confirm the menu path, confirmation dialog, RLS/RPC permissions, and post-merge profile list refresh in the shipped binary.
- Build 73 is submitted and processing in App Store Connect. Device/TestFlight should still manually verify sign-in/password visibility controls, upload guidance, first-launch guide presentation without dashed spotlights, prescription warning, Care share sheet, assistant disclaimer, consent, and in-app account deletion with a real account.
- The build 72 first-launch guide no longer uses contextual spotlight boxes. Device/TestFlight should confirm the guide appears after `I'm new` account creation on a zero-record account, stays suppressed for returning users after completion, keeps the signed-in zero-record dashboard visible after manual refresh, and opens the upload sheet on completion.
- Unsupported non-medical uploads now have a deployed OCR failure path shared by manual upload and forwarded mail. Device/TestFlight should verify both ingestion paths show `This file does not look like a medical record.`, create no readings, and do not auto-create managed profiles.

## Next recommended batch

After build 73 finishes Apple processing, install it from TestFlight and run the signed-in checks below before wider rollout. The next implementation batch should focus on real-device failures found there, especially OCR/manual upload, forwarded-mail ingestion, sharing, profile switching responsiveness, and notification flows, rather than starting an unrelated feature set.

## Backend or device/TestFlight verification still required

- Deploy or smoke-test the legacy API share-list change if React Native routes are still shipping anywhere; the active SwiftUI doctor-share screen uses direct Supabase REST and the live `DoctorShare` table currently has zero rows, so existing-link reuse needs either a signed-in synthetic share creation/revoke test or a real user share row.
- Device-test document detail against image, PDF, and non-image uploads to confirm Open/Share and metadata behavior.
- Device-test previously uploaded PDFs/docs from Records and document preview to confirm QuickLook opens the downloaded local copy without the prior popup error.
- Device-test Trends graph modes and marker expansion sheets for a profile with real numeric marker data, confirming actual reference ranges and statuses match Supabase-backed data.
- Device-test health score on a profile with enough readings to confirm reasons, gaps/feedback, and current age versus report-based age render cleanly.
- Device-test single-use doctor-share preview warning because opening a real single-use link can revoke it after access.
- Device/TestFlight-test Care by creating a near-future medication reminder with medicine, dosage, timing, and instructions; grant notification permission, confirm local delivery, mark done, mark due again, link a prescription/source document, open that source, and delete the row.
- Device/TestFlight-test Assistant by opening AI, asking about flagged markers, latest report, a specific marker, prescriptions, medication advice, and a generic summary; verify source rows open the matching document and Clear resets persisted history.
- Device/TestFlight-test Family/profile by switching to a managed profile, changing Viewer/Contributor/Guardian role, uploading a document to one profile, moving it from document detail or upload queue, and confirming Records/Trends/Assistant use the new profile assignment.
- Device/TestFlight-test Email ingestion by copying the forwarding address from Today, forwarding a report with an attachment, confirming the resulting document appears in Records and Today Email ingestion with the expected ready/in-progress/failed status and OCR stage, and confirming duplicate/failed-before-document behavior once backend event data exists.
- Device/TestFlight-test Upload by selecting multiple files, selecting multiple photos, switching profile immediately after queuing to confirm each upload keeps its original target profile, retrying a failed queued item if one can be forced, removing failed/analyzed queue rows, and confirming staged files do not block upload after picker dismissal.
- Device/TestFlight-test unsupported documents in both ingestion paths: manually upload a bank statement or invoice and forward the same unsupported type by email. Both should fail with the standardized "This does not look like a medical record" message, should not create readings, should not auto-create managed profiles, and should remain removable/retryable without polluting Records as a ready item.
- Add automated OCR regression tests before implementing unsupported-document rejection: one accepted lab-report fixture, one accepted prescription/medicine-list fixture, and one bank/insurance/invoice/ID fixture that proves the shared OCR function returns the unsupported-document failure used by both manual upload and mail ingestion.
- Later live checks still require OCR payload richness, export links, document/profile reassignment, and any future email-ingestion event log.
