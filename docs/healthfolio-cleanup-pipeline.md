# HealthFolio Cleanup And Commit Pipeline

Use this workflow when the checkout has a large release or restoration diff and the goal is to review, test, and commit it without dragging local artifacts or unproven fixes into history.

Current migration and release evidence: [Diamond Group migration and QA](healthfolio-diamond-group-migration-and-qa.md). The September 2026 additions include executable session, profile, chart-data and Assistant-handler regressions:

```bash
npm run test:ios-session
npm run test:ios-profile
npm run test:ios-trends
npm run test:ios-uploads
npm run test:assistant-behavior
npm run test:ingestion-security
npm run test:inbound-email-security
npm run test:deletion-behavior
npm run test:profile-document-access
```

Run these with the existing gates below. Offline passing tests do not replace live backend or TestFlight verification. Confirm the Supabase project is active before attributing a DNS/network failure to SwiftUI.

The PostgreSQL suites use disposable local databases and require `initdb`, `pg_ctl`, and `psql` on PATH, or `PG_BINDIR`. They never target the hosted project. Typecheck Edge Functions from the no-space snapshot with `deno check --no-config --no-lock --node-modules-dir=none` followed by the changed function entrypoints. Migrations affecting identity or grants require a separate live-schema review and recovery plan before deployment, even when local tests pass.

## Ground Rules

- Work from the real checkout unless the user explicitly asks for a separate worktree.
- Do not use destructive git commands.
- Treat `apps/mobile/ios/HealthFolio/SwiftUIPrototype` as the active shipped iOS surface.
- Keep generated/local artifacts out of commits: `.agents/`, `skills-lock.json`, `docs/visual-mockups/`, build folders, signed IPAs, archives, provisioning files, dependency folders.
- Every concrete P0/P1 bug fix needs a reproducible test or a documented manual repro if automation is not practical.
- Run native iOS checks from a real no-space `/tmp` snapshot, not from `Documents/health tracker` and not through a symlink.

## Commands

```bash
npm run cleanup:classify
npm run cleanup:scan
npm run cleanup:verify
npm run cleanup:verify:native
npm run cleanup:test
```

`cleanup:classify` buckets the current dirty files and prints explicit `git add -- ...` commands for each bucket.

`cleanup:scan` fails if dirty files contain blocked generated paths or likely literal secrets. It allows environment variable names such as `OPENAI_API_KEY` but blocks literal key-shaped values.

`cleanup:verify` runs:

- `git diff --check`
- `plutil -lint apps/mobile/ios/HealthFolio/Info.plist apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj`
- cleanup secret/generated scan
- no-space `/tmp/healthfolio-cleanup-*` snapshot copy
- `npm ci --include=dev --ignore-scripts --no-audit --no-fund`
- shared package builds
- `npx prisma generate --schema apps/api/prisma/schema.prisma`
- mobile typecheck, lint, and Vitest
- API typecheck, lint, and Vitest

`cleanup:verify:native` adds `pod install` and an unsigned iOS simulator build with `CODE_SIGNING_ALLOWED=NO`.

## Next-Time Step-By-Step

Use this checklist the next time you or an agent makes HealthFolio changes and you want to review and commit them safely.

### 1. Start From The Real Repo

```bash
cd "/Users/nalinadityachaganti/Documents/health tracker"
git status --short
```

If status is already dirty before you start, classify it first and decide whether those files are part of your current task. Do not reset or delete anything just to make the tree look clean.

### 2. Make One Small Change Batch

Keep the batch scoped to one reason:

- backend/Supabase fix
- SwiftUI/native iOS fix
- RN/Expo compatibility fix
- dependency/build config update
- docs/handoff update

Avoid mixing unrelated cleanup, visual assets, and behavior fixes in the same batch.

### 3. Classify The Dirty Files

```bash
npm run cleanup:classify
```

Read every bucket. Anything in `local-generated` should usually stay uncommitted. Anything in `review-required` needs a conscious decision before staging.

### 4. Scan Before Staging

```bash
npm run cleanup:scan
```

Fix the cause before continuing if this reports generated artifacts, signing files, temp passwords, API keys, bearer tokens, or other likely secrets.

### 5. Add A Regression Test For Each Real Bug

If the change fixes a concrete bug, add the smallest reproducible test before or with the fix.

Use these commands when they match the touched area:

```bash
npm run test --workspace api -- path/to/test.ts --reporter verbose
npm run test --workspace mobile -- path/to/test.ts --reporter verbose
npm run cleanup:test
```

For SwiftUI behavior that does not have unit-test coverage, write the manual repro and verification result into the handoff doc before committing.

### 6. Run The Focused Checks

Pick the checks that match the batch:

```bash
npm run typecheck --workspace api
npm run lint --workspace api
npm run test --workspace api -- --reporter verbose
npm run typecheck --workspace mobile
npm run lint --workspace mobile
npm run test --workspace mobile -- --reporter verbose
git diff --check
plutil -lint apps/mobile/ios/HealthFolio/Info.plist apps/mobile/ios/HealthFolio.xcodeproj/project.pbxproj
```

For native iOS changes, use the no-space snapshot gate:

```bash
npm run cleanup:verify:native
```

For non-native changes, use:

```bash
npm run cleanup:verify
```

### 7. Stage One Bucket Explicitly

Use the `git add -- ...` command printed by `npm run cleanup:classify`, or stage a smaller explicit list.

```bash
git add -- exact/file/one exact/file/two
git diff --cached --stat
git diff --cached --check
npm run cleanup:scan -- --staged
```

Do not use `git add -A` for cleanup work unless the whole dirty tree has already been classified and reviewed.

### 8. Commit The Bucket

Use a message that names the bucket and behavior:

```bash
git commit -m "fix: harden HealthFolio profile access"
git commit -m "feat: restore HealthFolio mobile upload flow"
git commit -m "docs: update HealthFolio restoration handoff"
```

Then repeat classify, scan, focused checks, explicit staging, and commit for the next bucket.

### 9. Final Full Gate

After all intended commits are made:

```bash
npm run cleanup:classify
npm run cleanup:verify
git status --short
```

Use `npm run cleanup:verify:native` instead of `cleanup:verify` when the final set includes SwiftUI, Xcode project, Podfile, native asset, or auth callback routing changes.

### 10. Final Report

Before pushing or handing off, record:

- commit hashes and subjects
- tests and verification commands that passed
- tests added for bugs
- files intentionally left ignored/local
- any manual iOS/TestFlight checks still needed

## High-Risk Flow Checklist

Use this extra checklist whenever the batch touches first launch, upload/OCR, email ingestion, document preview/share, doctor-share links, profile routing, or any code that can move records between profiles.

### 1. Write The Repro First

For each bug or behavior change, write one of these before editing implementation code:

- an automated test that fails before the fix
- a Supabase SQL/Edge Function smoke command with expected output
- a device/TestFlight repro in the handoff doc when automation is not practical

Do not rely on screenshots alone. Screenshots are useful evidence, but the repro needs setup, exact steps, expected result, observed result, and the command/build used to verify the fix.

### 2. Cover Both Ingestion Paths

If OCR behavior changes, test both routes because they converge on the same backend:

- Manual ingestion: Files and Photos from Add record.
- Mail ingestion: forwarded PDF/JPG/PNG attachment through `inbound-email-ingest`.

Minimum OCR checks:

- a supported blood/lab report reaches Records, creates extracted readings, and updates Today/Trends/Assistant context
- a supported prescription or medicine list is imported with clear review/warning copy
- an unsupported document fails with the standardized non-medical message
- the failed unsupported item does not create duplicate managed profiles or misleading ready records
- retry/remove behavior works for failed upload queue items

### 3. Keep The Unsupported-Document Copy Consistent

Use one product message across manual upload, mail ingestion, Records status, and any email-ingestion status card:

Title:

```text
This file does not look like a medical record
```

Body:

```text
HealthFolio could not find supported medical information in this file. Choose a clear medical PDF or image and try again.
```

Backend behavior should set a durable OCR failure state such as `ocrStatus = failed`, `ocrStage = unsupported_document`, and `ocrError` to this message or a very close variant. Client-only copy is not enough because forwarded mail and manual upload must fail the same way.

### 4. First-Launch Design Review

For first-launch guide changes, decide the design variant before implementation:

| Option | Shape                                                                                                  | Use when                                                               |
| ------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| A      | Keep the current bottom-sheet coachmarks and tighten copy                                              | lowest-risk TestFlight patch                                           |
| B      | Contextual coachmarks with spotlight/highlight around Profile, Records, Add record, and Upload targets | recommended next build because it teaches by pointing at real controls |
| C      | Persistent Today setup checklist plus optional coachmarks                                              | users may leave onboarding and resume later                            |
| D      | Upload-first mini wizard after account creation                                                        | maximizing first upload matters more than browsing the app first       |

Recommended default: Option B, while preserving Skip, the final Start upload action, and the current signed-in zero-record trigger. Keep copy short enough for iPhone SE-class screens and verify VoiceOver labels on the highlighted controls.

### 5. Share And Export Smoke

For sharing-related changes, test both source-file sharing and doctor-share links:

- Document detail opens image/PDF originals from a signed URL.
- Native share sheet opens for the local document copy.
- Doctor-share create/copy/share/open/revoke works under the signed-in user's RLS.
- Single-use link preview warning is shown before consuming a single-use share.
- Export/summary share does not expose another profile's records.

### 6. Verification Gate

Run focused tests first, then the cleanup gate:

```bash
git diff --check
npm run typecheck --workspace mobile
npm run lint --workspace mobile
npm run typecheck --workspace api
npm run lint --workspace api
npm run cleanup:verify
```

Use `npm run cleanup:verify:native` for SwiftUI/Xcode changes. If a live Supabase or TestFlight check cannot be run because credentials are unavailable, document that gap in the handoff before committing.

## Review Buckets

Use these buckets for subagent review and commit grouping:

| Bucket                  | Scope                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `workspace-deps`        | Root/package manifests, lockfile, workspace config, Podfile files                          |
| `backend-supabase`      | `apps/api`, `apps/worker`, `supabase`, shared contracts/catalog/scrubber packages          |
| `mobile-swiftui-native` | SwiftUI prototype, AppDelegate/SceneDelegate, Xcode project, Info.plist, native assets     |
| `mobile-rn-compat`      | Expo Router screens, RN compatibility components, mobile API helpers, mobile assets/config |
| `docs-handoff`          | Handoff, reference, release, and workflow docs                                             |
| `local-generated`       | Local/generated material that should normally stay ignored                                 |
| `review-required`       | Anything outside known buckets that needs human classification                             |

## Subagent Review Packets

Dispatch read-only subagents by bucket. Each subagent should return findings first, ordered by severity, with file and line references.

Backend/Supabase packet:

```text
Review backend, shared-types, and Supabase changes only. Focus on profile ownership, RLS/security-definer behavior, OCR owner resolution, auth/session assumptions, and missing API regression tests. Do not modify files. Return P0/P1/P2 findings with exact file/line references and suggested tests.
```

SwiftUI/native packet:

```text
Review apps/mobile/ios/HealthFolio, especially SwiftUIPrototype, AppDelegate, SceneDelegate, Info.plist, Xcode project, and native asset changes. Focus on shipped iOS behavior, auth callback routing, session storage, upload/preview flows, profile switching, and native build risk. Do not modify files. Return findings with exact file/line references and suggested simulator/manual checks.
```

RN/mobile compatibility packet:

```text
Review apps/mobile/app and apps/mobile/src changes that must continue to typecheck for EAS/RN compatibility. Focus on active-profile threading, upload queue behavior, assistant/care/share compatibility, route imports, and missing mobile regression tests. Do not modify files. Return findings with exact file/line references and suggested tests.
```

Generated/artifact packet:

```text
Review dirty and ignored local files for accidental generated artifacts, secrets, signing assets, binary build outputs, temp passwords, or docs that should stay local. Do not modify files. Return a keep/ignore/delete-or-leave-local recommendation per suspicious path.
```

## Reproducible Bug Test Rule

For each concrete bug found:

1. Write the smallest failing test that proves the bug.
2. Run the exact test command and capture the failure.
3. Fix only the cause of that failure.
4. Rerun the exact test and the relevant workspace guard.
5. Commit the test with the fix.

Preferred locations:

| Bug area                              | Test location                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| API service/controller logic          | `apps/api/src/**/<name>.test.ts`                                                                             |
| Shared contract behavior              | `packages/shared-types/src/**/*.test.ts`                                                                     |
| Mobile helper logic                   | `apps/mobile/src/**/*.test.ts`                                                                               |
| Assistant/care/share RN compatibility | `apps/mobile/src/lib/**/<name>.test.ts`                                                                      |
| Supabase SQL/RPC behavior             | Migration SQL plus a documented `psql`/Supabase CLI smoke test in the handoff                                |
| SwiftUI UI behavior                   | Native build plus a simulator/device repro checklist in the handoff unless unit-testing is already available |

If automation is not practical, add the manual repro to the relevant handoff doc with:

- date and build number
- setup state
- exact steps
- expected result
- observed result before the fix
- verification result after the fix

## Commit Procedure

1. Run `git status --short`.
2. Run `npm run cleanup:classify`.
3. Review each bucket and remove/ignore generated artifacts before staging.
4. Run `npm run cleanup:scan`.
5. Stage explicit paths for one bucket at a time.
6. Run `git diff --cached --check`.
7. Run the relevant tests for that bucket.
8. Commit with a bucket-specific message.
9. After all buckets are committed, run `npm run cleanup:verify` or `npm run cleanup:verify:native`.
10. Run `git status --short` and report any residual ignored/local files separately from committed source.

Recommended commit order:

1. `chore:` dependency/workspace stabilization
2. `fix:` backend/Supabase profile, OCR, auth, or access-control fixes
3. `feat:` mobile SwiftUI/RN release surface
4. `docs:` handoff/reference updates

## Final Report Template

```text
Commits:
- <hash> <subject>

Verification:
- <command>: passed
- <command>: passed

Tests added:
- <test path>: covers <bug>

Residual local files:
- <path>: ignored/generated, not committed

Risks:
- <remaining manual check or known limitation>
```
