# HealthFolio App Store Connect Form

This is the authoritative fill sheet for `HealthFolio 1.0.0 (79)`.

## App Identity

| Field              | Value                       |
| ------------------ | --------------------------- |
| Apple ID           | `6832929860`                |
| Name               | `HealthFolio: Medical Records`               |
| Bundle ID          | `com.asianol.healthfolio` |
| SKU                | `HEALTHFOLIO-IOS-001`       |
| Version            | `1.0.0`                     |
| Build              | `79`                        |
| Primary language   | `English (U.S.)`            |
| Primary category   | `Medical`                   |
| Secondary category | `Health & Fitness`          |
| License agreement  | `Apple Standard EULA`       |

## Product Page

| Field               | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Subtitle            | `Your health records, organized`                                                                                     |
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
- Regulated Medical Device: `No` for United States, United Kingdom, and EU/EEA.
- Export Compliance: app uses standard encrypted network connections only and has `ITSAppUsesNonExemptEncryption = false`; answer that it does not use non-exempt encryption.
- Advertising Identifier: `No`.
- Content Rights: HealthFolio displays documents selected by users. Confirm that the app has the necessary rights to display user-provided content under the EULA/privacy terms.
- Sign in with Apple: available alongside Google sign-in.
- Account deletion: available at `Profile > Privacy & consent > Delete account and data`.
- Custom EULA: `No`; use Apple Standard EULA.

## App Review

- Notes: paste `review-notes.md` excluding the owner placeholders section.
- Review contact and dedicated demo credentials are saved privately in App Store Connect.
- Dedicated demo login was verified against production and saved privately in App Store Connect.
- Contact first name: `[OWNER REQUIRED]`.
- Contact last name: `[OWNER REQUIRED]`.
- Contact phone: `[OWNER REQUIRED]`.
- Sign-in required: `Yes` for most synced functionality.

Never commit reviewer credentials or a temporary password.

## Screenshots

- Upload the four PNGs from `screenshots/iphone-6.9/` in manifest order.
- iPad set: `Not applicable`; build 79 is iPhone-only.
- App previews: optional; leave empty for this release.

## Availability And Release

These are account/business decisions and cannot be inferred from code:

- Price: `[OWNER REQUIRED: Free or selected tier]`.
- Countries/regions: `[OWNER REQUIRED]`.
- Release method: `Manual after approval`.
- DSA trader status and public contact details: `[ACCOUNT HOLDER REQUIRED]`.
- Korea availability/regulatory fields: `[OWNER REQUIRED if Korea selected]`.
- Accessibility Nutrition Labels: complete only with verified claims; do not claim untested support.

## Final Upload State

- EAS build URL: https://expo.dev/accounts/starklabs/projects/healthfolio/builds/7d1917f1-e6e3-4029-95ab-b6083baddc8c.
- IPA URL: `[GENERATED AFTER BUILD 73]`.
- EAS submission URL: https://expo.dev/accounts/starklabs/projects/healthfolio/submissions/47db0032-326f-4e2f-a9e5-004ee8a456ee.
- Apple processing status: `[VERIFY AFTER SUBMISSION]`.
