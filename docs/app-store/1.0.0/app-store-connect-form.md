# HealthFolio App Store Connect Form

This is the authoritative fill sheet for `HealthFolio 1.0.0 (80)`.

## App Identity

| Field              | Value                       |
| ------------------ | --------------------------- |
| Apple ID           | `6832929860`                |
| Name               | `HealthFolio: Medical Records`               |
| Bundle ID          | `com.asianol.healthfolio` |
| SKU                | `HEALTHFOLIO-IOS-001`       |
| Version            | `1.0.0`                     |
| Build              | `80`                        |
| Primary language   | `English (U.S.)`            |
| Primary category   | `Medical`                   |
| Secondary category | `Health & Fitness`          |
| License agreement  | `Apple Standard EULA`       |

## Product Page

| Field               | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Subtitle            | `Personal health records`                                                                                     |
| Promotional text    | `Store medical records, extract readings, follow trends, manage reminders, and create secure summaries you control.` |
| Keywords            | `medical records,lab reports,health tracker,OCR,medications,health trends,doctor summary`                            |
| Support URL         | `https://starklabs2026-crypto.github.io/health-tracker/support/`                                                     |
| Marketing URL       | `https://starklabs2026-crypto.github.io/health-tracker/`                                                             |
| Privacy Policy URL  | `https://starklabs2026-crypto.github.io/health-tracker/privacy/`                                                     |
| Privacy Choices URL | `https://starklabs2026-crypto.github.io/health-tracker/privacy-choices/`                                             |
| Description         | Paste the exact Description block from `metadata.md`                                                                 |
| Copyright           | `2026 Focal Labs`                                                             |

## Required Declarations

- App Privacy: enter every answer from `privacy-label.md`.
- Age Rating: enter every answer from `age-rating.md`; expected result is `16+`.
- Regulated Medical Device: `No`. Owner confirmed; saved in App Store Connect for all regions.
- Export Compliance: app uses standard encrypted network connections only and has `ITSAppUsesNonExemptEncryption = false`; answer that it does not use non-exempt encryption.
- Advertising Identifier: `No`.
- Content Rights: `Yes`, the app displays third-party content and has the necessary rights. Owner confirmed rights to display the records users choose to upload; saved in App Store Connect.
- Sign in with Apple: available alongside Google sign-in.
- Account deletion: available at `Profile > Privacy & consent > Delete account and data`.
- Custom EULA: `No`; use Apple Standard EULA.

## App Review

- Notes: paste `review-notes.md` excluding the owner placeholders section.
- Review contact and dedicated demo credentials are saved privately in App Store Connect.
- Dedicated demo login was verified against production and saved privately in App Store Connect.
- Contact details supplied by the owner are saved privately in App Store Connect.
- Sign-in required: `Yes` for most synced functionality.

Never commit reviewer credentials or a temporary password.

## Screenshots

- Upload the four PNGs from `screenshots/iphone-6.9/` in manifest order.
- iPad set: `Not applicable`; build 80 is iPhone-only.
- App previews: optional; leave empty for this release.

## Availability And Release

The owner confirmed these settings and they are saved in App Store Connect:

- Price: `Free`.
- Countries/regions: `All 175 storefronts, including the EU`.
- Release method: `Manual after approval`.
- DSA trader status: `Non-trader`, confirmed by the owner and saved. Apple shows Active for 27 countries or regions.
- Korea availability/regulatory fields: `[OWNER REQUIRED if Korea selected]`.
- Accessibility Nutrition Labels: complete only with verified claims; do not claim untested support.

## Final Upload State

- EAS build URL: https://expo.dev/accounts/starklabs/projects/healthfolio/builds/a8de28ec-a6fd-454f-b865-b459a53abe00.
- EAS cloud build 80: `IN_QUEUE`; source commit `7fb38e9`.
- EAS submission URL: https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/93e78ddf-a15c-490e-b755-fb7e7d23e296.
- Build 80 auto-upload is scheduled for app 6832929860. Build 79 remains on the draft until Apple processes 80.
