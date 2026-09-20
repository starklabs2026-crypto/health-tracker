# Submission Checklist

## Code And Backend

- [ ] All release tests pass from the no-space snapshot.
- [ ] Supabase migrations are applied in order.
- [ ] `delete-account`, OCR, email ingestion, export, and sharing functions are deployed and smoke-tested.
- [ ] Synthetic manual-upload, email-ingestion, export/share, and deletion test data is removed.
- [ ] Build numbers are `1.0.0 (73)` in Expo, Info.plist, and Xcode.
- [ ] Unused microphone permission is removed.

## Public URLs

- [ ] Privacy Policy returns HTTP 200.
- [ ] Support returns HTTP 200 and displays `starklabs2026@gmail.com`.
- [ ] Privacy Choices returns HTTP 200 and shows the in-app deletion path.
- [ ] All in-app links open the same production URLs.

## App Store Connect

- [ ] Product-page metadata entered from `metadata.md`.
- [ ] Apple Standard EULA selected; no custom EULA uploaded.
- [ ] Privacy label entered from `privacy-label.md`.
- [ ] Age rating entered from `age-rating.md`.
- [ ] Regulated medical device answers entered from `regulated-medical-device.md`.
- [ ] Review notes and a synthetic reviewer account added.
- [ ] Copyright/legal entity confirmed.
- [ ] DSA trader status confirmed at account level.
- [ ] Price, countries/regions, and release method confirmed.
- [ ] Required iPhone screenshots uploaded in listed order.
- [ ] iPad screenshots left empty because build 73 is iPhone-only.

## Submission

- [ ] EAS production build completed successfully.
- [ ] Exact EAS build ID submitted, not `latest`.
- [ ] Apple processing completed and build 73 selected for version 1.0.0.
- [ ] Export compliance answer confirmed (`No non-exempt encryption`).
- [ ] Final App Review submission performed by an authorized App Store Connect user.
