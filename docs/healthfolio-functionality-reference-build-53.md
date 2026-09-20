# HealthFolio Functionality Reference - Build 53

Generated on 2026-06-26 for the archived iOS build artifact:

`build/ios/export/20260625-110238/HealthFolio-1.0.0-53.ipa`

This document is intentionally separate from the build 60 reference. It describes the build 53 app as the React Native / Expo baseline that was shipped immediately before the later SwiftUI shell experiments.

## 1. Evidence Boundary

Primary evidence:

- IPA path: `build/ios/export/20260625-110238/HealthFolio-1.0.0-53.ipa`.
- App display name: `HealthFolio`.
- Bundle identifier: `com.starklabs.healthfolio`.
- Marketing version: `1.0.0`.
- Build number: `53`.
- Minimum iOS version: `15.1`.
- SDK used for archive: `iphoneos26.4`.
- Expo config embedded in the IPA:
  - `owner`: `starklabs`.
  - `slug`: `healthfolio`.
  - `scheme`: `healthfolio`.
  - `sdkVersion`: `55.0.0`.
  - `orientation`: portrait.
  - `userInterfaceStyle`: light.
  - `ios.supportsTablet`: false.
  - `ios.usesAppleSignIn`: true.
  - `ios.buildNumber`: `53`.
  - Supabase project URL: `https://qojdeuacwkmlxmodeabt.supabase.co`.
  - Inbound email domain: `records.healthfolio.app`.
  - Inbound email template: `test.healthfolio+{alias}@gmail.com`.
- IPA bundle contents confirm this is an Expo / React Native app:
  - `Payload/HealthFolio.app/main.jsbundle`.
  - `Payload/HealthFolio.app/EXConstants.bundle/app.config`.
  - React, Expo, Expo Router, vector icon, AsyncStorage, Google Sign-In, and file-system frameworks/assets.

Build 53 route and feature evidence found in the production bundle includes:

- `./index.tsx`.
- `./_layout.tsx`.
- `./lock.tsx`.
- `./(auth)/_layout.tsx`.
- `./(auth)/welcome.tsx`.
- `./(auth)/otp.tsx`.
- `./(tabs)/_layout.tsx`.
- `./(tabs)/home.tsx`.
- `./(tabs)/documents.tsx`.
- `./(tabs)/readings.tsx`.
- `./(tabs)/family.tsx`.
- `./readings/[parameterId].tsx`.
- `./shares.tsx`.
- `parseFloatingAssistant`.
- `7-day timeline`.
- `Forwarding alias`.
- `Forwarding address`.
- `Opening HealthFolio document`.
- `Prescription OCR requires user verification before use.`
- `A records-based score using extracted markers and profile-aware reference ranges where available. It is not a diagnosis or medical risk score.`

Important limitation:

- The build 53 JavaScript bundle is production/minified. This document combines direct IPA evidence with the preserved React Native route structure and app behavior for this build family.
- Exact implementation internals that cannot be reconstructed from the IPA are described as build 53 baseline behavior, not as a fresh source checkout claim.
- Build 53 should be treated as the feature-complete React Native baseline. Build 54 was the first archived artifact explicitly named `swiftui-b54`, so build 53 is the pre-SwiftUI-reference point.

## 2. Product Summary

Build 53 is a consumer-facing medical records organizer for a single user and managed family profiles.

Core user outcomes:

- Create or access a HealthFolio account.
- Keep medical documents in one record inbox.
- Upload reports from camera, photos, or files.
- Forward reports into a private email intake address.
- Run OCR on reports.
- Store extracted biomarker readings.
- Review document OCR status and extracted values.
- View health score and record-readiness style signals.
- See trends from historical biomarker data.
- Select and manage family profiles.
- Ask a records-grounded assistant questions about uploaded or forwarded documents.
- Use lightweight care reminders for medicines, blood tests, imaging, or doctor follow-up.
- Share clinical summaries or doctor links.
- Export records where supported.
- Protect access with biometric lock where configured.

Clinical boundary:

- Build 53 is an organization, OCR, and record-review app.
- It is not a diagnosis app.
- Scores are record-completeness and extraction-quality signals, not medical risk scores.
- Assistant answers are intended to stay grounded in uploaded records and extracted readings.
- Medicine, dosage, diagnosis, and treatment decisions must remain outside the product boundary.

## 3. Build 53 App Shell

Runtime:

- React Native.
- Expo SDK 55.
- Expo Router.
- Supabase Auth and data APIs.
- Local React Query style caching.
- Local upload queue state.
- Secure storage / local authentication support.
- Google Sign-In and Apple Sign-In native capabilities.

Global shell responsibilities:

- Load the app bundle.
- Resolve initial auth state.
- Mount route layouts.
- Start authenticated app navigation.
- Mount global floating assistant where appropriate.
- Resume upload queue processing.
- Keep the app portrait-only.
- Use light-mode styling from the embedded Expo config.

Top-level route concept:

```text
App launch
  index
    no session -> auth welcome
    active session -> lock or authenticated tabs

Authenticated app
  tabs
    Today
    Docs
    Trends
    Family
    Profile

Secondary screens
  Add record
  Document detail
  Trend detail
  Assistant
  Care plan / medications
  Doctor shares
```

## 4. Navigation Structure

### 4.1 Primary Tabs

Build 53 uses five main bottom tabs.

| Tab | Build 53 purpose | Expected route |
| --- | --- | --- |
| Today | Main dashboard, score, insights, next actions, timeline | `/(tabs)/home` |
| Docs | Document inbox, filters, upload entry, document rows | `/(tabs)/documents` |
| Trends | Biomarker list, latest values, panel grouping, trend detail entry | `/(tabs)/readings` |
| Family | Active profile selection and managed profiles | `/(tabs)/family` |
| Profile | Account, health profile, security, forwarding, privacy, export/share | `/(tabs)/profile` |

Build 53 bundle evidence directly confirms the Today, Docs, Trends, and Family tab route files. Profile is part of the preserved five-tab product surface and is also implied by profile-related feature strings and current build-family route structure.

### 4.2 Secondary Screens

| Screen | Purpose |
| --- | --- |
| Auth welcome | First unauthenticated screen |
| Auth identifier | New/existing account entry |
| OTP | Legacy or linked OTP auth completion |
| Lock | Returning session gate, biometric protection path |
| Add record | Camera, photo, file upload, OCR queue |
| Document detail | Record metadata, file access, OCR state, values, delete |
| Trend detail | One biomarker timeline and source records |
| Assistant | Full records Q&A surface |
| Care plan / medications | Reminder and follow-up tracking |
| Shares | Doctor-facing temporary share links |

### 4.3 Floating Assistant

Build 53 includes a global floating assistant entry.

Expected behavior:

- Appears as a hovering chat icon above the tab bar on normal authenticated screens.
- Opens a chat panel.
- Lets the user ask questions about uploaded or forwarded records.
- Uses document and reading data as the answer source.
- Offers source-opening behavior when the answer cites a document.
- Keeps a full Assistant page available for larger chat history.

Clinical safety:

- The assistant should answer from documents and extracted readings only.
- It should not provide medicine intake, dosage, diagnosis, or emergency advice.

## 5. Launch And Auth Flow

### 5.1 App Open

Expected flow:

1. User opens HealthFolio.
2. App loads the Expo / React Native bundle.
3. Auth state is checked through Supabase.
4. If no active session exists, user is sent to the welcome/auth flow.
5. If a session exists, user is sent through the lock/authenticated path.
6. After unlock or session confirmation, user reaches the tab app.

### 5.2 New User

Entry:

- Welcome page.
- "I am new" style action.

Expected steps:

1. User chooses account creation.
2. User completes email, Apple, or Google sign-in path depending on enabled UI.
3. User creates or completes a basic profile.
4. User lands in the authenticated app.
5. Primary prompt is to upload the first record.

Crash-sensitive area:

- This is one of the flows the user reported crashing in later UI builds.
- For build 53 reference, the important preservation rule is that new-user routing must not mount a native shell before the React Native auth state is ready.

### 5.3 Existing User

Entry:

- Welcome page.
- "I have an account" style action.

Expected steps:

1. User chooses existing account.
2. User signs in.
3. App resolves Supabase session.
4. App routes to lock or tabs.

Crash-sensitive area:

- Sign-in completion and sign-out/reopen should be stable.
- Do not regress this behavior when replacing app shell or launch code.

### 5.4 Lock Screen

Purpose:

- Protect authenticated records when returning to the app.
- Use biometric lock if configured.
- Provide secure session continuation.

Expected behavior:

- If biometric lock is enabled, require device authentication.
- If not enabled, proceed with session validation.
- If session is invalid or missing, return to auth.

## 6. Today Tab

Purpose:

- Main overview screen.
- Turns medical records into a quick status view.
- Shows what needs attention and what the user should do next.

### 6.1 Header

Expected content:

- Page title: Today or equivalent.
- Active profile name.
- Optional profile selector.

Navigation:

- Tapping profile identity can route to profile or family selection depending on implementation.

### 6.2 Score / Readiness

Build 53 includes the records-based score copy:

`A records-based score using extracted markers and profile-aware reference ranges where available. It is not a diagnosis or medical risk score.`

Expected visible content:

- Large score number.
- Out-of-100 or score-style display.
- Status wording.
- Small supporting metrics.
- Info affordance explaining score inputs.

Score should be calculated from record-system signals, not claimed as a clinical wellness score.

Acceptable score inputs:

- Number of documents.
- Number of extracted readings.
- OCR confidence or trust.
- Abnormal or attention markers.
- Missing profile context.
- Open review items.
- Panel coverage.
- Recency of records.

Required explanation:

- User should be able to see what contributes to the score.
- Score copy must say it is based on records and extracted markers.
- Score must not imply medical diagnosis.

### 6.3 Next Action

Expected states:

- No records: prompt to upload or forward first report.
- OCR pending: show reading/processing state.
- Ready for review: prompt to review extracted values.
- Abnormal or flagged reading: route to relevant trend detail or document.

### 6.4 Insights

Expected content:

- One or more concise insight rows.
- Latest document signal.
- Flagged biomarker signal.
- Forward/upload prompt if empty.

Navigation:

- Insight tied to a document opens document detail.
- Insight tied to a reading opens trend detail.
- Empty insight opens add record.

### 6.5 7-Day Timeline

Build 53 bundle evidence includes `7-day timeline`.

Expected content:

- Seven-day activity strip.
- Shows recent document and biomarker activity.
- Helps user understand record-building progress over the week.

Design intent:

- Lightweight, glanceable, not a heavy analytics chart.
- Important counts should be visually prominent.

### 6.6 Tools

Expected tools from the build family:

- Upload / add record.
- Docs.
- Trends.
- Assistant.
- Care plan or medications.
- Share with doctor.

## 7. Docs Tab

Purpose:

- Main record inbox.
- Lets the user find, filter, and open uploaded or forwarded medical documents.

### 7.1 Header

Expected content:

- Page title: Docs or Records.
- Add button.

Navigation:

- Add button opens Add Record.

### 7.2 Profile Filter

Expected behavior:

- If family profiles exist, show profile chips or a selector.
- "Me" represents the account owner.
- Managed profiles can be selected.
- Selected profile controls records shown in the inbox.

### 7.3 Search

Expected searchable fields:

- Document title.
- File name.
- Lab/source.
- Date.
- Document type.
- OCR status.
- Notes where available.
- Forwarded email subject or attachment name.

### 7.4 Status Counts

Expected visible metrics:

- Ready.
- Reading or in progress.
- Failed.
- Pending if any.

UI requirement:

- Important numbers should be large enough to scan.
- Counts should not feel like a dense admin grid.

### 7.5 Filters

Expected filters:

- All.
- Ready.
- In progress.
- Failed.

Likely document-type filters:

- Blood / lab.
- Prescription.
- Imaging.
- Surgery or discharge.
- Vaccine.
- Other.

### 7.6 Document Rows

Expected row content:

- Icon based on record type or status.
- Main title.
- Secondary metadata such as document type and date.
- Status pill.
- Optional lab/source.

Navigation:

- Tap row opens Document Detail.

Empty state:

- If no documents, prompt upload or email forwarding.
- Copy should be minimal.

## 8. Add Record Screen

Purpose:

- Capture reports and send them into the OCR pipeline.

### 8.1 Entry Points

Can be opened from:

- Today next action.
- Docs add button.
- Trends empty state.
- Family empty state.
- Upload queue actions.

### 8.2 Upload Sources

Build 53 app config includes camera and photo-library permissions.

Expected options:

- Camera.
- Photos.
- Files.

Files should support:

- PDF.
- JPG.
- PNG.
- Other supported image formats where available.

### 8.3 Multi-File Upload

Expected behavior:

- Photos and files can queue multiple selections.
- Each selected file becomes a local queue item.
- Queue can continue processing while the app remains open.

### 8.4 Prescription / Handwriting Verification

Build 53 bundle evidence includes:

`Prescription OCR requires user verification before use.`

Expected behavior:

- If a selected file appears to be a prescription, warn the user before relying on OCR.
- Handwritten prescriptions require extra verification.
- User must understand OCR can misread medicine names, timing, and dosage.

Clinical boundary:

- Do not recommend whether or how to take medicine.
- OCR output is a record summary requiring human review.

### 8.5 Queue

Expected item states:

- Queued.
- Uploading.
- Processing.
- Analyzed.
- Failed.

Expected actions:

- Retry failed upload.
- Open analyzed record.
- Remove queue item.
- Clear completed queue items.

### 8.6 OCR Pipeline

Expected steps:

1. Create document metadata row.
2. Upload original file to storage.
3. Mark upload complete.
4. Invoke `process-document-ocr`.
5. Poll or refresh document status.
6. Save extracted readings.
7. Mark record ready for review.
8. Invalidate document, reading, and trend caches.

## 9. Document Detail

Purpose:

- Give the user confidence in what was uploaded, what OCR extracted, and what still needs review.

### 9.1 Header

Expected content:

- Back control.
- Document title or type.
- Status pill.

### 9.2 Source / Original File

Build 53 bundle evidence includes:

- `Opening HealthFolio document`.

Expected behavior:

- Open the stored file if a download URL is available.
- Show original file metadata.
- Provide a native open/share path where supported.

Important requested preservation:

- The document page should make it easy to verify what was uploaded.
- A preview is preferred when the file is image-based or renderable.
- Share from document page should remain available when technically possible.

### 9.3 Record Score

Expected content:

- Score number for document extraction/completeness.
- Short explanation of score inputs.

Acceptable inputs:

- OCR status.
- Number of extracted values.
- OCR trust.
- Attention/abnormal items.
- Document completeness.

Not acceptable:

- Calling this a diagnosis.
- Calling this a clinical risk score.

### 9.4 OCR Status

Expected states:

- Pending upload.
- Queued.
- Processing.
- Ready for review.
- Failed.

Expected behavior:

- Processing records refresh.
- Failed records explain that a clearer upload may be needed.

### 9.5 Extracted Values

Expected content:

- Biomarker name.
- Value and unit.
- Reference range where available.
- Status flag such as normal, low, high, critical, or attention.
- OCR trust/confidence where available.

Navigation:

- Tapping a reading can route to trend detail if supported.

### 9.6 Prescription Verification

Expected content:

- Warning about handwriting/OCR accuracy.
- User approval or verification action before treating prescription OCR as reviewed.

Boundary:

- The app may summarize what the uploaded prescription appears to contain.
- The app must not tell the user to start, stop, change, or dose medication.

### 9.7 Delete

Expected behavior:

- User can delete a document.
- Delete is confirmed.
- Related lists refresh after deletion.

## 10. Trends Tab

Purpose:

- Show biomarkers extracted from documents.
- Make historical changes visible.

### 10.1 Header

Expected content:

- Page title: Trends.
- Add button or upload shortcut.

### 10.2 Search And Filter

Expected search fields:

- Parameter name.
- Panel name.
- Alias or unit.

Expected filters:

- All.
- Panel-specific filters where catalog grouping exists.
- Watch or attention items where supported.

### 10.3 Parameter Rows

Expected content:

- Parameter name.
- Latest value.
- Unit.
- Reference range.
- Status.
- Date.
- Small trend indicator.

UI requirement:

- Important values should be large and readable.
- Abnormal values should be visually highlighted without making the screen noisy.

### 10.4 Panels

Expected panel groupings:

- Complete blood count.
- Lipid panel.
- Thyroid.
- Liver.
- Kidney.
- Diabetes/glucose.
- Urine.
- Vitamins/minerals.
- Other extracted markers.

### 10.5 Empty State

Expected content:

- No readings yet.
- Upload a lab report to extract readings.

Navigation:

- CTA opens Add Record.

## 11. Trend Detail

Route evidence:

- `./readings/[parameterId].tsx`.

Purpose:

- Show one biomarker over time.

Expected content:

- Parameter name.
- Latest value.
- Unit.
- Reference range.
- Status flag.
- Trend chart.
- Historical readings.
- Source document links.

Chart behavior:

- Data points represent readings from documents.
- User can inspect individual data points.
- Source row opens the related document.

Clinical boundary:

- The page can show range flags.
- It should not diagnose the meaning of a trend.
- It should recommend clinician review for concerning values rather than giving treatment advice.

## 12. Family Tab

Route evidence:

- `./(tabs)/family.tsx`.

Purpose:

- Manage profiles under the account.
- Select which profile records and trends are currently shown.

### 12.1 Header

Expected content:

- Page title: Family.
- Add button.

### 12.2 Current Profile

Expected content:

- "Me" or selected profile card.
- Active/selected status.

Behavior:

- Selecting a profile changes the active profile context across Docs, Trends, Today, Assistant, and upload flows.

### 12.3 Managed Profiles

Expected content:

- List of family profiles.
- Name.
- Relationship or role.
- Status.
- Edit action.
- Delete/remove action.

Requested editability:

- Family profile details should be editable.
- Relationship labels such as Guardian should not be permanently hardcoded.

### 12.4 Add Profile

Expected fields:

- Name.
- Relationship.
- Date of birth where needed.
- Sex/gender where needed.
- Units.
- Blood group where needed.

### 12.5 OCR Grouping

Desired behavior around build 53 baseline:

- Uploaded documents should be associated with the active profile.
- Future auto-grouping can infer family member by OCR when multiple files are uploaded.
- User must be able to correct assignment after upload.

## 13. Profile Tab

Purpose:

- Account, profile, privacy, security, forwarding, sharing, and destructive account actions.

### 13.1 Account Card

Expected content:

- User name.
- Email.
- Avatar/initial.
- Edit action.

Requested editability:

- About/profile section should be editable.
- DOB, gender, blood group, and units should be editable.

### 13.2 Health Profile

Expected fields:

- Date of birth.
- Gender or sex.
- Blood group.
- Units.

Clinical use:

- Profile data can improve reference-range interpretation.
- Missing profile data should reduce score confidence rather than block app usage.

### 13.3 Security

Expected content:

- Biometric lock toggle.
- Face ID usage permission is present in app config.

Behavior:

- When enabled, returning users can be routed through lock/biometric verification.

### 13.4 Export

Expected content:

- Export PDF action where available.

Behavior:

- Generates or opens record summary export for the active profile.

### 13.5 Share With Doctor

Expected content:

- Share link action.
- Routes to Shares screen.

Purpose:

- Create temporary clinical access link for a doctor or caregiver.

### 13.6 Forwarding

Build 53 bundle evidence includes:

- `Forwarding`.
- `Forwarding address`.
- `Forwarding alias`.

Expected content:

- Private intake email address.
- Alias.
- Copy action.
- Edit alias action where available.

Expected behavior:

- User forwards lab reports or medical PDFs/images to the intake address.
- Email attachments appear in Docs after ingestion.
- Accepted file types include PDF, JPG, PNG where supported.

### 13.7 Privacy And Support

Expected content:

- Privacy policy.
- Support.
- Data/privacy disclaimers.

### 13.8 Sign Out

Expected behavior:

- User can sign out.
- Session is cleared.
- App returns to auth.
- Reopening after sign-out should not crash.

### 13.9 Account Deletion

Expected content:

- Account deletion section.
- Warning that deletion is permanent.
- Confirmation before destructive action.

Expected data scope:

- Account.
- Profile.
- Records.
- Readings.
- Links.
- Exports.
- Stored files where backend supports deletion.

## 14. Assistant

Purpose:

- Let users ask questions about their uploaded or forwarded documents.

### 14.1 Entry Points

Expected entry points:

- Floating assistant icon.
- Today tools.
- Possibly document/trend contextual entry points.

### 14.2 Chat Surface

Expected content:

- Assistant title.
- Message history.
- Input field.
- Send action.
- Example prompts where empty.

### 14.3 Answer Sources

Expected data:

- Document metadata.
- OCR status.
- Extracted readings.
- Notes.
- Source document IDs.
- Active profile context.

Expected behavior:

- Rank relevant documents from user query.
- Fetch details for likely matches.
- Answer with references to source records.
- Offer open-source document links.

### 14.4 Guardrails

Allowed:

- Summarize what a document contains.
- List abnormal readings from uploaded reports.
- Compare readings across uploaded reports.
- Explain what data is missing from the record.
- Help find records by date, lab, or parameter.

Not allowed:

- Diagnose.
- Recommend medication.
- Change dosage.
- Tell the user whether to take or skip medicine.
- Replace doctor advice.
- Provide emergency triage as if it were a clinician.

Required fallback:

- If the record data is insufficient, say that the app cannot answer from available records.
- Direct the user to upload the relevant report or consult a clinician.

## 15. Care Plan / Medications

Purpose:

- Track local reminders and follow-ups.

Expected reminder types:

- Medicine reminder.
- Next blood test.
- X-ray or imaging follow-up.
- Doctor visit.
- General health-record follow-up.

Expected fields:

- Title.
- Type.
- Schedule or due date.
- Notes.
- Active/completed state.

Clinical boundary:

- Reminders are user-entered organizational reminders.
- The app should not prescribe medicines or decide test schedules.

## 16. Shares

Route evidence:

- `./shares.tsx`.

Purpose:

- Share selected health records or summaries with a doctor.

Expected content:

- Existing share links.
- Create share link.
- Expiration or temporary access language.
- Revoke/share management where available.

Expected behavior:

- Share link is profile-aware.
- User controls creation and revocation.
- Shared content should be read-only.

## 17. Email Ingestion

Purpose:

- Let users forward reports into the app without manual upload.

Build 53 config:

- Inbound domain: `records.healthfolio.app`.
- Template: `test.healthfolio+{alias}@gmail.com`.

Expected flow:

1. User copies private intake address.
2. User forwards email with supported attachments.
3. Backend receives inbound payload.
4. Attachments become documents.
5. OCR runs.
6. Docs tab shows the forwarded records.
7. Trends update if readings are extracted.

Expected document metadata:

- Forwarded subject.
- Attachment filename.
- Sender where available.
- Source date where inferred.
- OCR status.

## 18. Backend And Data Inventory

Key backend areas:

- Supabase Auth.
- User/profile records.
- Managed family profiles.
- Documents.
- Stored files.
- OCR function.
- Parameter readings.
- Shares.
- Export endpoint.
- Inbound email ingestion.

Key functions and endpoints in the build family:

- `process-document-ocr`.
- `inbound-email-ingest`.
- Export PDF endpoint.
- Document download URL endpoint or signed storage URL path.

Key data concepts:

- App user.
- Active profile.
- Family member / managed profile.
- Document.
- Document OCR status.
- Parameter reading.
- Range flag.
- Share link.
- Upload queue item.

## 19. Clinical Trust Rules

Build 53 must preserve these boundaries:

- OCR is assistive and can be wrong.
- Handwritten prescription OCR needs explicit review.
- Health score is records-based, not a diagnosis.
- Reference ranges are informational and profile-aware where possible.
- Abnormal markers should be presented as "needs review" or equivalent.
- Assistant answers must cite records where possible.
- No medicine intake advice.
- No dosage advice.
- No diagnosis.
- No emergency handling beyond directing the user to urgent care/emergency services if needed.

## 20. Build 53 Preservation Checklist

When comparing later builds to build 53, preserve:

- Stable app launch.
- Stable "I am new" auth route.
- Stable "I have an account" auth route.
- Stable sign-out and reopen behavior.
- React Native / Expo tab navigation behavior unless a replacement is feature-complete.
- Five-tab information architecture: Today, Docs, Trends, Family, Profile.
- Floating assistant entry.
- Add record flow with camera, photos, and files.
- Multi-file upload queue.
- OCR invocation and status polling.
- Prescription OCR verification warning.
- Docs search, filters, and status counts.
- Document detail source/open/share behavior.
- Extracted values list.
- Trend list and trend detail source links.
- Family profile selection.
- Editable family/profile data.
- Profile forwarding address and alias.
- Biometric lock setting.
- Doctor share flow.
- Export flow where available.
- Email ingestion compatibility with the configured inbound address.
- Records-only assistant guardrails.
- 7-day timeline.
- Score explanation and non-diagnostic disclaimer.

## 21. Known Build 53 Versus Later Build Differences

Build 53:

- Is the archived React Native / Expo build at `20260625-110238`.
- Uses embedded build number `53`.
- Ships a `main.jsbundle` and Expo app config.
- Uses light-mode styling in the embedded config.
- Represents the feature baseline before the SwiftUI shell experiment.

Later build 54:

- Archived separately as `20260625-114922-swiftui-b54/HealthFolio-1.0.0-54-swiftui.ipa`.
- Should not be treated as the same UI/feature baseline.

Build 60:

- Has its own separate functionality reference file.
- Reflects the current local app code at the time that document was generated.
- May include post-build-53 UI and feature changes.

## 22. Complete User Flow Map

### 22.1 New User To First Record

1. Open app.
2. No session found.
3. Welcome/auth screen appears.
4. Choose new account.
5. Complete sign-up.
6. Complete basic profile if prompted.
7. Land on Today.
8. Tap upload/add record.
9. Choose camera, photos, or files.
10. Confirm prescription warning if applicable.
11. Queue starts.
12. OCR processes.
13. Open analyzed document.
14. Review extracted values.
15. Trends and score update.

### 22.2 Existing User To Records

1. Open app.
2. Session found.
3. Lock path appears if configured.
4. Unlock.
5. Land on tabs.
6. Open Docs.
7. Search or filter.
8. Open document detail.
9. Open/share original file or review values.

### 22.3 Forwarded Email To Trends

1. Open Profile.
2. Copy forwarding address.
3. Forward report email with attachment.
4. Backend ingests email.
5. Document appears in Docs.
6. OCR extracts readings.
7. Trend list shows latest markers.
8. Trend detail shows historical context.

### 22.4 Family Upload

1. Open Family.
2. Add or select managed profile.
3. Open Add Record.
4. Upload files.
5. Records are associated with selected profile.
6. Docs and Trends show selected profile data.
7. User can switch back to Me.

### 22.5 Assistant Query

1. Tap floating assistant.
2. Ask a question about records.
3. Assistant searches document/readings data.
4. Assistant answers with grounded context.
5. User opens cited source.
6. User reviews original document or extracted values.

### 22.6 Doctor Share

1. Open Profile.
2. Tap Share with doctor.
3. Open Shares screen.
4. Create temporary link.
5. Share link externally.
6. Revoke or manage share when needed.

## 23. Open Questions For Exact Build 53 Reconstruction

The IPA proves build identity and feature presence, but some details remain limited without an exact matching source checkout:

- Exact visual spacing and copy per component cannot be fully recovered from the minified bundle.
- Exact score constants cannot be fully audited from the production bundle alone.
- Exact chart styling cannot be fully audited from the production bundle alone.
- Exact set of Profile route strings is partly inferred from feature strings and the preserved five-tab app structure.

For implementation work, treat this document as the build 53 behavior target and verify against a device install of `HealthFolio-1.0.0-53.ipa` when pixel or copy-level accuracy matters.
