# HealthFolio App Store Release Runbook

Current release target: `HealthFolio 1.0.0 (73)`.

Authoritative App Store Connect fill sheet:

- `docs/app-store/1.0.0/app-store-connect-form.md`

Public pages:

- Privacy: `https://starklabs2026-crypto.github.io/health-tracker/privacy/`
- Privacy choices: `https://starklabs2026-crypto.github.io/health-tracker/privacy-choices/`
- Support: `https://starklabs2026-crypto.github.io/health-tracker/support/`
- Contact: `starklabs2026@gmail.com`
- EULA: Apple Standard EULA

## Release Identity

- App Store Connect Apple ID: `6773293787`
- Bundle ID: `com.starklabs.healthfolio`
- SKU: `HEALTHFOLIO-IOS-001`
- Expo project: `@starklabs/healthfolio`
- EAS project ID: `b06f1d7e-8692-4995-9a4f-8641dbffadbf`
- Supabase project ref: `qojdeuacwkmlxmodeabt`
- Active iOS surface: `apps/mobile/ios/HealthFolio/SwiftUIPrototype`
- Device family: iPhone only for build 73

## Every Change, Step By Step

Use this sequence for every future release change.

1. Start from the real checkout and record the baseline.

   ```bash
   cd "/Users/nalinadityachaganti/Documents/health tracker"
   git status --short
   git log -1 --oneline
   ```

2. Read the current handoff and cleanup guide before editing.

   ```bash
   sed -n '1,240p' docs/healthfolio-build60-functionality-restoration-handoff.md
   sed -n '1,260p' docs/healthfolio-cleanup-pipeline.md
   ```

3. Make one scoped change batch. Keep backend, native iOS, RN compatibility, and documentation changes separate when possible.

4. Write the smallest failing regression test before the fix. Record the exact red command and output.

5. Implement only the cause of that failure. Do not reset, revert, or clean unrelated user changes.

6. Run focused tests until green, then classify and scan the checkout.

   ```bash
   npm run cleanup:classify
   npm run cleanup:scan
   git diff --check
   plutil -lint apps/mobile/ios/HealthFolio/Info.plist
   ```

7. For SwiftUI, Xcode, authentication, upload, OCR, sharing, or storage changes, use a real no-space `/tmp` snapshot.

   ```bash
   npm run cleanup:verify:native
   ```

8. Review high-risk flows with read-only reviewers by domain: SwiftUI, Supabase/RLS, RN compatibility, and release/privacy wording.

9. Fix every concrete Critical or Important finding test-first. Re-run the same reviewer after the fix.

10. Stage explicit paths only.

    ```bash
    git add -- exact/path/one exact/path/two
    git diff --cached --stat
    git diff --cached --check
    npm run cleanup:scan -- --staged
    ```

11. Commit one ownership boundary at a time and record hashes in the handoff.

12. Deploy backend changes before building the client that depends on them. Run synthetic live tests and remove their data.

13. Bump all build-number surfaces together, remove unused permissions, and run the final no-space release gate.

14. Build with EAS using the exact production profile. Submit the exact returned build ID, never an ambiguous `latest` build.

15. Verify Apple processing, select the build in App Store Connect, fill every field from the form document, and perform the final human-only legal/account-holder decisions.

## Required Functional Smoke Matrix

- New email account, Apple sign-in, and Google sign-in.
- Consent acceptance, consent retry, sign out, and first-launch guide reset for a new account.
- Manual ingestion from Files, Photos, and camera.
- Forwarded-email ingestion with a supported attachment.
- Generic unsupported-document error for both ingestion paths.
- OCR readings in Records, Today, Trends, and Assistant sources.
- PDF/image preview and system share sheet.
- Health-summary export and doctor-share create/open/revoke.
- Care reminder scheduling, delivered-notification cleanup, and summary sharing.
- Profile switching, managed-profile preservation, and duplicate-profile merge.
- Permanent in-app account deletion, retry after a lost response, local file/session cleanup, and residual backend audit.

Use synthetic accounts and documents only.

## Public Site

Test and publish from version-controlled sources:

```bash
npm run test:app-store-site
npm run publish:app-store-site
curl -I https://starklabs2026-crypto.github.io/health-tracker/privacy/
curl -I https://starklabs2026-crypto.github.io/health-tracker/privacy-choices/
curl -I https://starklabs2026-crypto.github.io/health-tracker/support/
```

The publisher uses a temporary clone of `gh-pages`, refuses an unexpected Git remote, stages only site files, and does not create a worktree.

## Screenshots

Build 73 is iPhone-only. Generate real `1320 x 2868` screenshots from the Debug-only fictional fixture:

```bash
scripts/capture-healthfolio-app-store-screenshots.sh
```

Do not upload iPad screenshots unless a later release deliberately enables iPad, passes native iPad/multitasking QA, and changes both Expo and Xcode device-family settings.

## Backend Deployment

Discover current CLI flags before executing commands:

```bash
/opt/homebrew/bin/supabase db push --help
/opt/homebrew/bin/supabase functions deploy --help
```

Deploy linked migrations and reviewed functions to `qojdeuacwkmlxmodeabt`. Never print service-role keys or function secrets.

## EAS Build And Submit

Run from a real no-space clone or snapshot with Node 20:

```bash
cd apps/mobile
npm exec --yes --package eas-cli@20.5.1 -- \
  eas build --platform ios --profile production --non-interactive --wait \
  --message "HealthFolio 1.0.0 (73) App Store readiness"
```

After recording the exact EAS build ID:

```bash
npm exec --yes --package eas-cli@20.5.1 -- \
  eas submit --platform ios --profile production --id <EXACT_BUILD_ID> --non-interactive --wait
```

## Human-Only App Store Connect Inputs

The repository cannot safely infer or store these:

- App Review synthetic account password
- App Review contact name and phone
- legal entity/copyright wording
- DSA trader status and public business details
- price and availability countries/regions
- release method
- final App Review submission click by an authorized account

Fill these at submission time without committing credentials.
