# HealthFolio MVP UI Flow

This document captures the intended MVP app flow for HealthFolio. It is written for UI design and frontend implementation, not backend implementation. Backend details such as Supabase schema, storage, and OpenAI OCR processing should support this flow without changing the user experience.

## Product Summary

HealthFolio is a personal and family health-record app. The MVP helps a user create a basic health profile, upload medical reports, extract health readings from those reports, review the extracted results, track readings over time, share a clean view with a doctor, and optionally add family members later.

The app should feel practical, private, and calm. It is not a diagnosis app. It should help users organize and understand their records, while making it clear that extracted readings need review and medical decisions belong with a qualified clinician.

## MVP Principles

- Keep first launch simple.
- Ask for only the minimum information needed to personalize the account.
- Let users reach the home screen quickly.
- Make document upload the primary action.
- Keep OCR results pending until the user reviews them.
- Make family setup optional and available later.
- Keep doctor sharing simple and reversible.
- Avoid complex medical language unless the source report already uses it.

## MVP Scope

Included in the MVP:

- First launch choice: "I'm new" or "I have an account".
- Basic onboarding for new users.
- Sign in with Apple, Google, or manual email/password.
- Health home dashboard.
- Document upload from camera, gallery, or PDF.
- OpenAI-powered extraction status and result review.
- Basic readings list and trend detail.
- Add family members later.
- Doctor share link.
- PDF export.
- Profile and account settings.

Deferred until after MVP:

- OTP login.
- Advanced family roles and permission controls.
- Push notifications.
- Full document scan edge detection.
- Advanced charting and pinned dashboard customization.
- Complex OCR review with source bounding boxes.
- Prescription, discharge summary, imaging, and doctor-note extraction.
- Clinical recommendations or diagnosis.

## App Information Architecture

Primary mobile areas:

- Home
- Documents
- Readings
- Family
- Profile

Secondary flows:

- First launch
- Onboarding
- Authentication
- Add document
- OCR review
- Reading detail
- Doctor share
- Export PDF

The default logged-in destination is Home.

## First Launch Flow

### Screen: Welcome

Purpose: Let the user choose whether they are new or returning.

Primary content:

- HealthFolio logo/name.
- Short value statement: "Organize reports, track readings, and share your health summary when needed."
- Button: "I'm new"
- Button: "I have an account"

Behavior:

- "I'm new" starts basic onboarding.
- "I have an account" opens authentication options.

Design notes:

- Keep this screen minimal.
- Do not show medical dashboards before the user has an account.
- Do not ask for permissions here.

## New User Onboarding Flow

### Screen: Basic Details

Purpose: Collect minimum profile information before account creation.

Fields:

- Full name
- Date of birth
- Sex
- Unit preference

Optional fields if the design can stay lightweight:

- Blood group
- Height
- Weight

Primary CTA:

- Continue

Validation:

- Name is required.
- Date of birth is required.
- Sex can allow "Prefer not to say" or "Not specified".
- Unit preference defaults to the user's locale when possible.

### Screen: Family Later

Purpose: Tell the user family profiles can be added later without making it part of setup.

Content:

- "You can add family members later."
- "Create profiles for parents, children, or dependents when you are ready."

Primary CTA:

- Continue

Secondary action:

- Skip is not needed because this screen is informational and lightweight.

### Screen: Create Account

Purpose: Let the new user create an account after entering basic details.

Auth options:

- Continue with Apple
- Continue with Google
- Continue with email

Behavior:

- After successful authentication, create or link the app profile.
- If profile data was collected before auth, save it after auth succeeds.
- Then route to Home.

App Store note:

- If Google sign-in is available, Sign in with Apple must also be offered as an equivalent option.

## Returning User Flow

### Screen: Sign In

Purpose: Let existing users access their account.

Auth options:

- Continue with Apple
- Continue with Google
- Continue with email

Behavior:

- If account exists and profile is complete, route to Home.
- If account exists but basic profile is incomplete, route to Basic Details.
- If no account is found for the selected auth method, show a friendly account creation path.

Manual email behavior:

- MVP can use email and password.
- OTP/passwordless login is deferred.

## Home

Purpose: Give users a useful health summary and clear next actions.

Primary content:

- Greeting and selected profile name.
- Primary CTA: Add document.
- OCR/pending review banner if any document needs attention.
- Recent documents.
- Recent readings or health summary cards.
- Attention needed list for abnormal or critical readings.
- Quick actions:
  - Add document
  - Add reading manually
  - Share with doctor
  - Export PDF

Empty state:

- If no documents exist, focus the page on adding the first report.
- Empty copy should be short and direct: "Upload a lab report to start building your health timeline."

Design notes:

- Home should feel like the product, not a marketing page.
- The first visible action should help users upload a report.
- Do not over-emphasize medical interpretation in the MVP.

## Documents

### Screen: Documents List

Purpose: Show all uploaded documents for the selected profile.

Content per document:

- Document type
- Source date
- Lab or hospital name if available
- OCR status
- Number of extracted readings if available

Actions:

- Add document
- Open document detail

Statuses:

- Upload pending
- Queued
- Processing
- Ready for review
- Reviewed
- Failed

Empty state:

- "No documents yet."
- CTA: Add document

### Screen: Add Document

Purpose: Upload a report for extraction.

Input options:

- Take photo
- Choose from gallery
- Choose PDF

Supported MVP file types:

- PDF
- JPG
- PNG

Metadata:

- Document type
- Source date
- Lab or hospital
- Ordering doctor
- Notes

Primary CTA:

- Upload document

Behavior:

- After upload, route to document detail.
- Show OCR status immediately.
- User should not wait on the upload screen for extraction to complete.

### Screen: Document Detail

Purpose: Show document metadata, processing status, and extracted readings.

Content:

- Document summary
- Upload/OCR status
- Extracted readings if available
- CTA to review readings when status is ready
- Delete document action

Processing state:

- Show "Extracting readings..." with a simple status indicator.
- Poll or subscribe until status changes.

Failure state:

- "We could not extract readings from this document."
- Actions:
  - Try again
  - Add readings manually

## OCR Review

Purpose: Let the user confirm, edit, or remove extracted readings before they become part of the confirmed health history.

Content:

- Document name/date at top.
- List of extracted readings.
- Each reading row:
  - Parameter name
  - Value
  - Unit
  - Range flag after backend calculation
  - Confidence indicator, simplified as "Needs review" for MVP

Actions per row:

- Edit
- Delete

Page actions:

- Confirm all
- Save changes

MVP rule:

- OCR results should be treated as pending until user confirmation.
- Backend should compute normal/abnormal/critical flags, not the AI model.

Design notes:

- Avoid showing raw AI explanations.
- Avoid scary language around abnormal results.
- Use clear review language: "Please check these values against your report."

## Readings

### Screen: Readings List

Purpose: Show health parameters and latest known readings.

Content:

- Search/filter by parameter or panel.
- Parameter groups such as CBC, Lipids, Diabetes, Thyroid, Liver, Kidney.
- Latest value per parameter when available.
- Status color for normal, abnormal, critical, or unknown.

Actions:

- Open parameter detail.
- Add reading manually.

### Screen: Reading Detail

Purpose: Show one parameter over time.

Content:

- Parameter name
- Latest value
- Normal range label
- Simple trend chart
- Reading history
- Source document link when available

Actions:

- Add reading manually
- Edit/delete user-added reading where allowed

MVP design:

- A simple line or bar chart is enough.
- Advanced filters and pinned dashboards can come later.

## Family

### Screen: Family

Purpose: Manage family profiles without making them mandatory.

Content:

- Current selected profile.
- Linked family members.
- Invite/add family member action.

Actions:

- Add family member
- Switch profile
- Remove/revoke access

MVP simplification:

- Keep roles simple.
- Show a clear message that family setup can be completed later.

Deferred:

- Guardian workflows.
- Permission matrix.
- Minor transfer.
- Invite decline flow.

## Doctor Share

### Screen: Create Share

Purpose: Create a temporary link for a doctor or caregiver.

Options:

- Date range
- Note
- Expiry
- Single-use toggle

Primary CTA:

- Create share link

After creation:

- Show link.
- Copy link.
- Revoke link.

MVP simplification:

- Share all confirmed readings for the selected profile within the selected date range.
- Include document metadata, but document file access can remain limited until storage/security is finalized.

### Public Doctor View

Purpose: Let a doctor view a clean, read-only summary.

Content:

- Patient name and basic demographics.
- Date range.
- Readings table.
- Recent documents metadata.
- Optional note from patient.

Design notes:

- No app navigation.
- No editing.
- Clear expiry/revoked state.

## Export PDF

Purpose: Generate a portable health summary.

MVP behavior:

- Export confirmed readings for the selected profile.
- Include basic profile details.
- Include document metadata.
- Generate a simple PDF summary.

UI:

- Export button in Profile and/or Home quick actions.
- Loading state while generating.
- Share/download system sheet after generation.

Deferred:

- Advanced export configuration.
- Include original document files.
- Async export job history.

## Profile And Settings

Purpose: Manage account and app preferences.

Content:

- Name
- Basic demographics
- Health profile details
- Units preference
- Biometric lock toggle
- Export PDF
- Sign out

Deferred:

- Delete account flow.
- Notification settings.
- Advanced security settings.
- Connected providers.

## Global States

Loading:

- Use skeleton rows or simple loading indicators.
- Avoid blocking full-screen loaders unless the app is starting.

Empty:

- Every empty state should include one useful action.

Error:

- Error messages should be plain language.
- Avoid exposing backend/provider details to the user.

Offline:

- MVP can show a simple offline message.
- Full offline upload/sync is deferred.

Permissions:

- Ask camera/photo permissions only when the user chooses the related upload action.

Privacy:

- Explain that reports can contain sensitive health information.
- Do not show extracted readings as medical advice.

## Suggested Tab Structure

Recommended bottom tabs:

- Home
- Documents
- Readings
- Family
- Profile

Doctor share and export are actions launched from Home/Profile rather than main tabs.

## UI Creation Checklist

- Welcome screen supports new and returning users.
- New-user onboarding is short and not medical-heavy.
- Apple and Google sign-in are shown together when Google is enabled.
- Manual email sign-in exists.
- Home has a clear Add document action.
- Documents show OCR status clearly.
- OCR review allows confirm, edit, and delete.
- Readings can be browsed by panel and opened into a detail view.
- Family setup is optional and available later.
- Doctor share link can be created and revoked.
- PDF export is available but simple.
- All screens have empty, loading, and error states.

## Open Questions Before UI Build

- Should manual email use password only for MVP, or magic link later?
- Should basic onboarding happen before auth as planned, or after auth to reduce unsaved data risk?
- Should document upload be allowed before account creation, or only after login?
- Should the first MVP include document file viewing, or only metadata plus extracted readings?
- Should "Family" be a tab from day one, or an action inside Profile until family usage grows?
