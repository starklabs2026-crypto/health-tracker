# App Review Notes

HealthFolio is a personal health record organizer. The active iOS interface is native SwiftUI.

## Review Paths

1. Create an account with email, Sign in with Apple, or Google.
2. Accept the health-data consent screen. Privacy Policy and Apple Standard EULA links are available there.
3. A new zero-record account receives the first-launch guide after consent.
4. Add a supported medical PDF, JPG, or PNG from Records using the plus button. OCR can take time; status and errors appear in Records.
5. Extracted readings appear in Records and Trends. HealthFolio labels information for verification and does not provide diagnosis or treatment.
6. Profile contains consent status, privacy links, export, doctor-share management, support, and account deletion.
7. Permanent deletion path: `Profile > Privacy & consent > Delete account and data`.

## Email Ingestion

The forwarding address is shown in Profile. Supported attachments forwarded to that address use the same OCR pipeline as manual uploads. The alias must belong to the signed-in review account.

## Privacy And Safety

- Support: `starklabs2026@gmail.com`
- Privacy: `https://starklabs2026-crypto.github.io/health-tracker/privacy/`
- Standard EULA: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
- HealthFolio is not a regulated medical device.
- There are no ads, cross-app tracking, purchases, or subscriptions in build 73.

## Reviewer Credentials

Owner must fill these immediately before submission:

- Review account email: `[OWNER REQUIRED]`
- Review account password: `[OWNER REQUIRED]`
- Review contact first and last name: `[OWNER REQUIRED]`
- Review contact phone: `[OWNER REQUIRED]`

Use a dedicated synthetic review account. Do not place a real user password or health record in this repository.
