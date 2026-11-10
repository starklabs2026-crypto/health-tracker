# Build 76: Upload ID Hotfix

## Incident

On 2026-09-15, build 75 showed "Supabase returned no rows" immediately after file selection. The live project `qojdeuacwkmlxmodeabt` is ACTIVE_HEALTHY following the owner's resume action.

Gateway logs showed authenticated document GETs returning `[]`, with no document POST or storage upload. The native queue incorrectly assigned an optimistic UI UUID to `documentId`, so a new file took the existing-document retry route before any database row existed.

A second issue affected genuine retries, reassignment, and storage recovery: Swift's uppercase `UUID.uuidString` did not match the lowercase TEXT document IDs in PostgreSQL. All 183 existing document IDs were lowercase at inspection time.

## Bounded Fix

- Keep local queue identity separate from server document identity. New files create a document; only accepted server IDs can enter retry or OCR-resume paths.
- Retain server IDs after upload/OCR failures and reconcile temporary rows after server acceptance.
- Deduplicate the completed record when a dashboard refresh has already loaded it.
- Use lowercase UUID strings for document requests and storage recovery prefixes.
- Missing or inaccessible existing records never automatically create replacement documents.

## Reproduction And Verification

Run `npm run test:ios-uploads` from the main checkout. The test compiles the actual Swift enqueue initializer, dispatch, and queue reconciliation methods with a recording API boundary.

The regression was observed failing before the fix for each of: local-ID routing, uppercase IDs, and concurrent dashboard duplication. All 34 checks now pass, covering Files/Photos, self/managed target routing, pre-acceptance failure, accepted retry, OCR resume, missing files, and placeholder reconciliation.

The original OCR regression checks and cleanup-gate tests pass. The current native app compiled in a no-space QA snapshot. Mobile typecheck/lint pass in the focused release snapshot; the original checkout commands stalled and were stopped before rerunning there. The separate build 76 native simulator build also passed after a fresh CocoaPods install corrected the cached QA Pods manifest mismatch. Log: `/tmp/healthfolio-b76-xcodebuild.log`.

Live synthetic self-profile metadata creation, update, and lookup passed with real authenticated REST requests. The synthetic document, application profile, and Auth user were removed afterward.

The full live synthetic smoke then passed in 19.28 seconds: valid medical PDF upload, document attach/read, OCR HTTP 200 in 8.15 seconds, all three expected values extracted with self-profile ownership preserved, and a signed preview whose bytes exactly matched the uploaded PDF. Cleanup verified removal of synthetic database rows, Auth account, and storage. The reproducible harness is `scripts/smoke-test-healthfolio-upload.mjs`; it reads the authorized CLI credential from Keychain in memory and logs only sanitized test results. This checks the live backend, not taps in the new native binary.

## Release Isolation

- Base: shipped build 75 commit `f5b63edab15015c007c2fbb83ee4ed038009014c`.
- Candidate: `/tmp/healthfolio-b76-RrD3OX`, version `1.0.0 (76)`.
- Application changes: `HealthFolioAppModel.swift`, `NativeUploadItem.swift`, and `NativeSupabaseAPI.swift`, plus the three build-number settings.
- The broader dirty native redesign and draft September security migrations are not included in this focused release.
- Existing EAS project and TestFlight app remain the target. This is not the Diamond Group Apple account transfer.
- EAS build: [8061f876-c943-446c-bfc2-3f38d93bc53b](https://expo.dev/accounts/starklabs/projects/healthfolio/builds/8061f876-c943-446c-bfc2-3f38d93bc53b), FINISHED successfully.
- IPA: [build 76](https://expo.dev/artifacts/eas/G1PQiY66EsI6cmaHasYQ92Vfunn0q-wSY1LOwPlmil0.ipa). Local version markers now also read 76; the broader dirty changes remain unreleased.
- Automatic Apple submission: [06baa7d3-137c-421b-87b4-bbd08d549437](https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/06baa7d3-137c-421b-87b4-bbd08d549437), FINISHED successfully with no reported error. Apple/TestFlight processing and tester availability were not independently verified; this is not public App Store approval.
- The first CLI attempt stopped before upload because `/tmp` and `/private/tmp` resolved differently. Retrying with the canonical `/private/tmp` project root succeeded; only one cloud build was created.

## Residual Risk

A document creation POST whose response is lost after the server commits is still ambiguous. Manual retry may create a duplicate. This pre-existing idempotency gap requires a separate durable upload-intent contract; this fix does not add automatic POST retries.
