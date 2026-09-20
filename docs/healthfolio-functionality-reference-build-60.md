# HealthFolio Functionality Reference

Generated from the current mobile app code on 2026-06-26.

Scope: the Expo Router app in `apps/mobile`. This is a current-state functionality and navigation document. It describes what is present in the mobile app code, how the user moves through the app, what each page does, and what data or backend capability each surface depends on.

## 1. Product Summary

HealthFolio is a personal and family medical-record app. The app lets a user:

- Create or sign in to a HealthFolio account.
- Upload medical records from camera, photo library, or files.
- Forward reports by email into a private intake address.
- Run OCR on uploaded or forwarded reports.
- Store and view documents by profile.
- Extract biomarker readings from records.
- View trends, latest values, scores, and historical timelines.
- Manage family or dependent profiles.
- Ask a records-only assistant questions about uploaded documents and extracted readings.
- Track local care-plan reminders for medicines, repeat tests, and doctor visits.
- Share read-only doctor links and export a PDF summary.
- Control account profile, privacy, biometric lock, forwarding alias, sign-out, and account deletion.

The app is not a diagnosis or medication-decision product. The UI includes multiple disclaimers that extracted records, OCR, health score, assistant answers, and reminders are organizational tools and not medical advice.

## 2. Main App Structure

The primary logged-in app uses five bottom tabs:

| Tab label | Route | Source file | Main purpose |
| --- | --- | --- | --- |
| Today | `/(tabs)/home` | `apps/mobile/app/(tabs)/home.tsx` | Health score, next action, insights, 7-day timeline, tools |
| Docs | `/(tabs)/documents` | `apps/mobile/app/(tabs)/documents.tsx` | Uploaded and forwarded record list, filters, status counts |
| Trends | `/(tabs)/readings` | `apps/mobile/app/(tabs)/readings.tsx` | Biomarker panels, latest readings, watch items, trend entry points |
| Family | `/(tabs)/family` | `apps/mobile/app/(tabs)/family.tsx` | Select, add, edit, and remove managed family profiles |
| Profile | `/(tabs)/profile` | `apps/mobile/app/(tabs)/profile.tsx` | Account, profile, privacy, security, forwarding, export, sharing, deletion |

Secondary screens:

| Screen | Route | Source file | Entry points |
| --- | --- | --- | --- |
| Add record | `/documents/new` | `apps/mobile/app/documents/new.tsx` | Today, Docs, Trends, Family empty state, onboarding |
| Document detail | `/documents/[id]` | `apps/mobile/app/documents/[id].tsx` | Docs list, Today insight, upload queue, assistant source links, trend source |
| Trend detail | `/readings/[parameterId]` | `apps/mobile/app/readings/[parameterId].tsx` | Trends parameter rows, Today flagged insight |
| Records assistant | `/assistant` | `apps/mobile/app/assistant.tsx` | Today tools, floating assistant panel |
| Care plan | `/medications` | `apps/mobile/app/medications.tsx` | Today tools |
| Doctor share | `/shares` | `apps/mobile/app/shares.tsx` | Profile doctor link row |
| Lock | `/lock` | `apps/mobile/app/lock.tsx` | App launch when Supabase session exists |
| Welcome | `/(auth)/welcome` | `apps/mobile/app/(auth)/welcome.tsx` | App launch when no session exists |
| Auth identifier | `/(auth)/identifier` | `apps/mobile/app/(auth)/identifier.tsx` | Welcome new or existing buttons |
| OTP | `/(auth)/otp` | `apps/mobile/app/(auth)/otp.tsx` | Legacy OTP flow if linked from older auth routes |
| Onboarding upload intro | `/(auth)/onboarding/health` | `apps/mobile/app/(auth)/onboarding/health.tsx` | New user after signup or lock when profile incomplete |

Global app wrapper:

- `apps/mobile/app/_layout.tsx` wraps the app in `QueryClientProvider`.
- It mounts a global `FloatingAssistant`.
- It starts or resumes upload queue processing.
- It idle-locks the app after returning from background if auth state is stale.

## 3. Launch And Authentication Flow

### 3.1 App Launch

Route: `/`

Source: `apps/mobile/app/index.tsx`

Flow:

1. App opens to the splash/auth gate.
2. The app checks whether a Supabase session exists.
3. If no session exists, it routes to `/welcome`.
4. If a session exists, it routes to `/lock`.
5. If the session check fails, it falls back to `/welcome`.

Visible user state:

- HealthFolio logo.
- Loading spinner.
- "Opening HealthFolio" copy.

### 3.2 Welcome

Route: `/welcome`

Source: `apps/mobile/app/(auth)/welcome.tsx`

Visible content:

- HealthFolio brand lockup.
- Short tagline: reports, readings, and doctor-ready summary.
- Button: "I'm new".
- Button: "I have an account".

Click behavior:

- Tap "I'm new" -> `/(auth)/identifier?mode=signup`.
- Tap "I have an account" -> `/(auth)/identifier?mode=signin`.

### 3.3 Identifier Auth

Route: `/(auth)/identifier`

Source: `apps/mobile/app/(auth)/identifier.tsx`

Purpose:

- Handles signup and signin using email/password, Apple, or Google.

Visible content:

- HealthFolio brand lockup.
- Caption changes by mode:
  - Signup: "Start with email, Apple, or Google."
  - Signin: "Sign in with email, Apple, or Google."
- Email field.
- Password field.
- Continue button.
- Continue with Apple button.
- Continue with Google button.

Validation and errors:

- Email must be valid.
- Password must be at least 8 characters.
- Provider errors are normalized into user-facing messages.
- Google and Apple misconfiguration, invalid credentials, network errors, and cancelled sign-in are handled with explicit copy.

Click behavior:

- Continue in signup mode:
  1. Validates email/password.
  2. Calls `signUpWithPassword`.
  3. If no session is returned, shows "Check your email to finish creating your account."
  4. If session exists, unlocks app and routes to `/(auth)/onboarding/health`.
- Continue in signin mode:
  1. Validates email/password.
  2. Calls `signInWithPassword`.
  3. Unlocks app and routes to `/(tabs)/home`.
- Continue with Google:
  1. Calls `signInWithGoogle`.
  2. Signup mode routes to onboarding.
  3. Signin mode routes to Today.
- Continue with Apple:
  1. Calls `signInWithApple`.
  2. Signup mode routes to onboarding.
  3. Signin mode routes to Today.

### 3.4 OTP Screen

Route: `/(auth)/otp`

Source: `apps/mobile/app/(auth)/otp.tsx`

Purpose:

- Legacy or alternate 6-digit OTP verification flow.

Visible content:

- Title: "Enter code".
- Subtitle showing target identifier.
- 6-digit OTP input.
- Verify button.
- Resend countdown.

Click behavior:

- Filled OTP or Verify button calls `verifyOtp`.
- On success, tokens are stored locally.
- If `isNewUser` is true, routes to onboarding health.
- Otherwise routes to Today.
- Resend calls `requestOtp` after countdown reaches zero.

### 3.5 Lock Screen

Route: `/lock`

Source: `apps/mobile/app/lock.tsx`

Purpose:

- Protects the app with device biometric authentication when an auth session exists.

Flow:

1. Checks whether the app user profile exists.
2. Sets next route:
   - Profile exists -> `/(tabs)/home`.
   - Profile missing -> `/(auth)/onboarding/health`.
3. Checks biometric hardware and enrollment.
4. If no biometric is available, unlocks and routes directly.
5. If biometric exists, asks Face ID or Touch ID.
6. On success, unlocks and routes.
7. On failure, shows retry and sign-out actions.

Click behavior after failure:

- Try again -> reruns biometric authentication.
- Sign out -> clears session and routes to `/welcome`.

### 3.6 Onboarding Health

Route: `/(auth)/onboarding/health`

Source: `apps/mobile/app/(auth)/onboarding/health.tsx`

Purpose:

- Minimal new-user handoff into report upload.

Visible content:

- Eyebrow: "Reports first".
- Heading: "Profiles are created from reports."
- Family profile visual.
- Button: "Start uploading".

Click behavior:

- Start uploading -> `/documents/new`.

Notes:

- `/(auth)/onboarding/basics` is currently a redirect to this screen.

## 4. Global Navigation Elements

### 4.1 Bottom Tab Bar

Source: `apps/mobile/app/(tabs)/_layout.tsx`

Tabs:

- Today: home icon.
- Docs: file-text icon.
- Trends: activity icon.
- Family: users icon.
- Profile: user icon.

Behavior:

- Active tab gets a larger rounded pill background.
- Inactive tabs show icon and label in muted color.
- The tab bar floats above the bottom safe area.

### 4.2 Floating Assistant

Source: `apps/mobile/src/components/FloatingAssistant.tsx`

Purpose:

- Provides app-wide access to records assistant chat without switching to the full Assistant page first.

Visibility rules:

- Hidden when the app is locked.
- Hidden on auth routes.
- Hidden on lock route.
- Hidden on the full assistant route.
- Visible on normal authenticated app pages.

Visible entry point:

- Floating message-circle button on the right side above the tab bar.

Click behavior:

- Tap floating icon -> opens a full-screen slide-up chat panel.
- Tap close -> closes the panel.
- Type question and send -> adds user message, queries local records assistant logic, appends assistant answer.
- If answer includes a source, "Open source" closes the panel and routes to `/documents/[sourceId]`.
- Tap "Open full assistant" -> closes panel and routes to `/assistant`.

Data used:

- `listDocuments` for the active profile.
- `listReadings` for the active profile.
- `getDocument` for source detail.
- `buildRecordsAssistantAnswer`.

## 5. Today Tab

Route: `/(tabs)/home`

Source: `apps/mobile/app/(tabs)/home.tsx`

Purpose:

- The Today page is the main dashboard. It combines a health score, latest record state, next action, insights, weekly timeline, and shortcuts.

Data loaded:

- `getMe`.
- `listReadings`.
- `listDocuments`.
- Active profile state from `useProfileStore`.

### 5.1 Header

Visible content:

- Title: "Today".
- Profile pill with active profile name.

Click behavior:

- Tap profile pill -> routes to `/(tabs)/profile`.

### 5.2 Health Score Card

Visible content:

- Label: "Health score".
- Context:
  - If personal profile has DOB: "Age-adjusted markers, {age}y".
  - If family/managed profile selected: "Profile-adjusted markers".
- Large score out of 100.
- Info button.
- Three technical signals:
  - Records count.
  - Markers count.
  - Flagged count.
- Progress track.
- Copy: "A technical health signal from your records, marker ranges, and OCR trust."

Score calculation:

- Marker status: up to 55 points.
- Record depth: up to 20 points.
- Panel coverage: up to 10 points.
- OCR trust: up to 10 points.
- Profile context: up to 5 points.
- Open review penalty: up to minus 12 points.

Click behavior:

- Tap info button -> alert explaining the score inputs and current point split.

Clinical boundary:

- Alert states this is a records-based score, not a diagnosis or medical risk score.

### 5.3 Next Section

Visible content:

- Section header: "Next".
- A single action card.

Action logic:

- If there are ready-for-review documents:
  - Title: "Review X record(s)".
  - Subtitle: "Confirm extracted values."
  - Button/pill: "Open".
  - Tap -> Docs tab.
- Else if documents are queued or processing:
  - Title: "OCR in progress".
  - Subtitle: "Reports are being read."
  - Tap -> Docs tab.
- Else:
  - Title: "Add first report" or "Add another report".
  - Subtitle: "Start your timeline."
  - Tap -> `/documents/new`.

### 5.4 Insights Section

Visible content:

- Section header: "Insights".
- Insight card with one or more rows.

Display logic:

- If abnormal or critical readings exist:
  - Shows up to 3 newest non-normal readings.
  - Each row title: "{parameter} needs attention".
  - Tap -> `/readings/[parameterId]`.
- Else if a recent document exists:
  - Shows latest document added.
  - Tap -> `/documents/[id]`.
- Else:
  - Shows "Forward or upload reports".
  - Tap -> `/documents/new`.

### 5.5 7-Day Timeline

Visible content:

- Section header: "7-day timeline".
- Seven bars, one per day.
- Bar height reflects number of documents plus readings on that day.
- Caption: "Documents and biomarker readings from this week."

Data logic:

- Uses last 7 dates.
- Counts documents by `sourceDate`.
- Counts readings by `recordedAt`.

### 5.6 Tools Section

Visible content:

- Section header: "Tools".
- Row: Care plan.
- Row: Assistant.

Click behavior:

- Care plan -> `/medications`.
- Assistant -> `/assistant`.

### 5.7 Empty Upload CTA

Visible content:

- If no documents exist, a bottom button appears: "Upload report".

Click behavior:

- Tap -> `/documents/new`.

## 6. Docs Tab

Route: `/(tabs)/documents`

Source: `apps/mobile/app/(tabs)/documents.tsx`

Purpose:

- Shows uploaded and forwarded documents for the selected profile.

Data loaded:

- `listDocuments`.
- `listFamilyMembers`.
- Active profile from `useProfileStore`.

### 6.1 Header

Visible content:

- Title: "Records".
- Add record icon button.

Click behavior:

- Tap plus -> `/documents/new`.

### 6.2 Profile Chips

Visible content:

- Appears only if active managed family profiles exist.
- Chips:
  - "Me".
  - One chip for each active managed profile.

Click behavior:

- Tap a chip -> sets active profile.
- Document list refreshes for selected profile.

### 6.3 Search Field

Visible content:

- Placeholder: "Search records".

Search matches:

- Display title.
- Document type label.
- Lab name.
- Notes.
- Source date.
- Formatted date.
- OCR status.
- Forwarded email subject or attachment name.

### 6.4 Category Chips

Visible content:

- All.
- Blood.
- Rx.
- Imaging.
- Surgery.
- Vaccines.
- Other.

Behavior:

- Filters document list by document type.

Document type mapping:

- Blood -> lab report.
- Rx -> prescription.
- Imaging -> X-ray, CT, MRI, scans, radiology.
- Surgery -> discharge summary.
- Vaccines -> vaccination record.
- Other -> other documents.

### 6.5 Status Rail

Visible content:

- Shown only when documents exist.
- Counts:
  - Ready.
  - Reading.
  - Failed.
  - Pending, if any.

### 6.6 Status Filter Chips

Visible content:

- All.
- Ready.
- In progress.
- Failed.

Behavior:

- Ready -> `ready_for_review`.
- In progress -> queued or processing.
- Failed -> failed.

### 6.7 Empty And Search States

If no documents exist:

- Empty title:
  - If family profiles exist and "Me" is selected: "Choose a profile".
  - Otherwise: "No records".
- Body:
  - "Choose a profile above." or "Upload or forward a report."
- CTA: "Add record" -> `/documents/new`.

If documents exist but filters match nothing:

- Empty title: "No matching documents".
- Body: "Try another lab, date, or status."

### 6.8 Document Rows

Visible content per row:

- Icon based on document type or failed status.
- Title:
  - Forwarded email subject, if useful.
  - Lab name, if available.
  - Forwarded filename.
  - Type label fallback.
- Subtitle:
  - Document type label.
  - Source date.
- Status pill:
  - Pending.
  - Queued.
  - Processing.
  - Ready.
  - Failed.

Click behavior:

- Tap row -> `/documents/[id]`.

Result count:

- Shows total documents or "X of Y shown" when filters/search are active.

## 7. Add Record Screen

Route: `/documents/new`

Source: `apps/mobile/app/documents/new.tsx`

Purpose:

- Lets the user upload one or more files and watch the upload/OCR queue.

Data and state:

- Active profile from `useProfileStore`.
- Upload queue from `useUploadQueueStore`.

### 7.1 Header

Visible content:

- Title: "Add".
- Close icon.

Click behavior:

- Close -> replaces route with `/(tabs)/documents`.

### 7.2 Source Card

Visible content:

- Section: "Source".
- Pill: "OCR".
- Three upload options:
  - Camera.
  - Photos.
  - Files.

Click behavior:

- Camera:
  1. Requests camera permission.
  2. Opens camera.
  3. Adds captured image to upload queue.
- Photos:
  1. Requests photo library permission.
  2. Opens image library.
  3. Allows multiple image selection.
  4. Adds selected images to upload queue.
- Files:
  1. Opens document picker.
  2. Accepts PDFs and images.
  3. Allows multiple file selection.
  4. Adds selected files to upload queue.

Prescription safety behavior:

- If any selected file is inferred to be a prescription, an alert appears:
  - It warns that handwritten prescriptions can be misread.
  - User must confirm before files are queued.

### 7.3 Upload Queue Card

Visible content:

- Section: "Queue".
- Clear button if analyzed items exist.
- Empty state:
  - Icon: upload-cloud.
  - Title: "No files".
  - Body: "Add a report."

Visible queue item content:

- File icon based on MIME type.
- File name.
- Status copy.
- Status pill.
- Progress bar.
- Percent.
- Profile name if uploaded for a managed profile.
- Retry/Open/Remove actions when applicable.

Queue statuses:

- Queued.
- Uploading.
- Processing.
- Analyzed.
- Failed.

Click behavior:

- Retry -> resets failed item and starts upload again.
- Open -> routes to `/documents/[documentId]` for analyzed item.
- Remove -> removes item from local queue.
- Clear -> removes analyzed items from the queue.

### 7.4 Upload Processing

Source: `apps/mobile/src/lib/uploads/uploadQueueStore.ts`

Processing steps:

1. File is queued locally.
2. The queue loop creates a document row with inferred document type.
3. The app uploads file bytes to storage.
4. The app marks the document uploaded.
5. `process-document-ocr` is invoked.
6. The app polls document OCR status.
7. Status becomes analyzed when OCR reaches ready-for-review.
8. Status becomes failed if OCR fails.
9. React Query caches for documents, family, readings, and trends are invalidated after changes.

Document type inference:

- Prescription: filename or type includes rx, prescription, medication, medicine, script.
- Imaging: x-ray, CT, MRI, scan, radiology, ultrasound, sonography, imaging.
- Surgery/discharge: discharge, surgery, surgical, operative, operation, procedure.
- Vaccination: vaccine, vaccination, immunization.
- Lab report: blood, CBC, lipid, thyroid, HbA1c, glucose, lab, pathology, biomarker.
- Otherwise: Other.

## 8. Document Detail Screen

Route: `/documents/[id]`

Source: `apps/mobile/app/documents/[id].tsx`

Purpose:

- Shows document source, score, OCR status, processing pipeline, extracted values, prescription verification, and delete action.

Data loaded:

- `getDocument(id)`.
- `getDownloadUrl(id)` when the document has a stored file.

Polling:

- If OCR status is queued or processing, the screen refetches every 3 seconds.

### 8.1 Header

Visible content:

- Title is document type label:
  - Blood work.
  - Prescription.
  - X-ray / CT / MRI.
  - Surgery.
  - Vaccine.
  - Document.
- Status pill.
- Back icon.

Click behavior:

- Back -> previous route.

### 8.2 Record Hero

Visible content:

- Label: "Score".
- Large score out of 100.
- Status pill.
- Mini stats:
  - Values.
  - Trust.
  - Source.

Score logic:

- Failed OCR -> low score.
- Processing -> temporary score.
- Pending upload -> temporary score.
- No readings -> saved but weak extraction score.
- With readings:
  - Uses average OCR confidence.
  - Penalizes attention items.
  - Clamps score between 54 and 96.

### 8.3 Original File Card

Visible content:

- Section: "Original file".
- File type pill.
- If file is an image and signed URL exists, shows inline image preview.
- Otherwise shows a file preview box.
- Buttons:
  - Open.
  - Share.

Click behavior:

- Open:
  1. Resolves signed download URL.
  2. Opens URL with native linking.
- Share:
  1. Resolves signed download URL.
  2. Opens native share sheet with HealthFolio document URL.

### 8.4 Score Calculation Card

Visible content:

- Section: "Score calculation".
- Explanation of current score.
- Disclaimer: score reflects record completeness and OCR confidence only, not medical advice.

Examples of explanation:

- OCR failed -> "OCR failed, so the score is intentionally low."
- Processing -> "The file is still being processed, so the score is temporary."
- No readings -> "File is saved, but no biomarker values were extracted."
- With readings -> "{count} values, {trust}% average OCR trust, {attention} items needing review."

### 8.5 Prescription Check Card

Visible only when:

- `docType` is prescription.

Visible content:

- Section: "Prescription check".
- Copy warning that handwriting OCR can be wrong.
- Button:
  - "Approve OCR" if not approved.
  - "Approved" if already approved.

Click behavior:

- Approve OCR:
  1. Appends "Prescription OCR approved by user" with date to notes.
  2. Updates document via `patchDocument`.
  3. Invalidates document and document-list queries.

Clinical boundary:

- User is asked to review original file before relying on medicine names, dosage, or timing.

### 8.6 Source Metadata Card

Visible rows:

- Lab or source name.
- Source date.
- Doctor, if present.
- Notes, if present.

### 8.7 OCR Pipeline Status Card

Visible content:

- Header: "Status".
- Step 1: Uploaded.
- Step 2: Reading or Read.
- Step 3: Ready.

Behavior:

- Step labels and "Done" status change based on OCR status.

### 8.8 Extracted Values

Visible only when:

- OCR status is ready-for-review.
- Readings array is non-empty.

Visible content:

- Header: "Values".
- Pill: "{count} values".
- Each reading row:
  - Parameter ID formatted as words.
  - OCR trust percent.
  - Value and unit.
  - Range flag pill.

### 8.9 Processing And Failed States

If processing:

- Card title: "Reading report".
- Copy: "This refreshes automatically."

If failed:

- Card title: "OCR failed".
- Copy: "Try a clearer upload or add readings manually."

### 8.10 Delete Document

Visible content:

- Button: "Delete document".

Click behavior:

- Opens confirmation alert.
- Confirm delete -> calls `deleteDocument`, invalidates document list, and navigates back.

## 9. Trends Tab

Route: `/(tabs)/readings`

Source: `apps/mobile/app/(tabs)/readings.tsx`

Purpose:

- Shows latest biomarker readings grouped by panel and links to parameter timelines.

Data loaded:

- `listReadings`.
- `listFamilyMembers`.
- Active profile from `useProfileStore`.
- Parameter catalog from `@medical-tracker/parameter-catalog`.

### 9.1 Header

Visible content:

- Title: "Trends".
- Add report icon.

Click behavior:

- Tap plus -> `/documents/new`.

### 9.2 Profile Chips

Visible only when:

- Active managed family profiles exist.

Click behavior:

- Tap chip -> sets active profile and reloads readings.

### 9.3 Meta Rail

Visible only when:

- At least one latest reading exists.

Visible counts:

- `{availablePanels}/8 panels`.
- `{attentionTotal} watch`.
- `{verifiedTotal} verified`.

### 9.4 Search Field

Visible content:

- Placeholder: "Search biomarkers".

Search matches:

- Parameter canonical name.
- Parameter ID.
- Parameter aliases.
- Panel name.
- Panel label.

### 9.5 Panel Filter Chips

Visible content:

- All.
- One chip per panel that has data.

Known panel labels:

- CBC.
- Lipids.
- Diabetes.
- Thyroid.
- Other catalog panels use their raw panel name if no shorter label exists.

### 9.6 Empty And Search States

If no readings exist:

- Title:
  - "Choose a profile" if managed profiles exist and "Me" is selected.
  - Otherwise "No readings".
- Body:
  - "Select a profile above." or "Upload a report."
- CTA: "Upload" -> `/documents/new`.

If filters/search match nothing:

- Title: "No matching readings".
- Body: "Try another panel or marker."

### 9.7 Panel Cards

Visible content per panel:

- Panel header.
- Pill:
  - "{attention} attention" if any non-normal markers.
  - "Stable" otherwise.
- Row per latest parameter:
  - Activity icon.
  - Parameter canonical name.
  - Latest value, unit, and formatted reference range.
  - Range flag pill.

Click behavior:

- Tap parameter row -> `/readings/[parameterId]`.

## 10. Trend Detail Screen

Route: `/readings/[parameterId]`

Source: `apps/mobile/app/readings/[parameterId].tsx`

Purpose:

- Shows one biomarker's latest value, reference range, score, chart, selected point, source report, and editable history.

Data loaded:

- `getTrend(parameterId)`.
- `listDocuments` for source context when trend points reference documents.
- Active profile from `useProfileStore`.

### 10.1 Header

Visible content:

- Parameter canonical name.
- Latest range flag pill, if data exists.
- Back icon.

Click behavior:

- Back -> previous route.

### 10.2 Latest Hero

Visible content:

- Label: "Latest".
- Latest value and unit, or "No data".
- Score badge, if latest data exists.
- Normal/reference range.
- Three stats:
  - History count.
  - Trust percent.
  - Status.

Score badge logic:

- Normal -> higher score.
- Unknown -> mid score.
- High/low -> lower score.
- Critical -> lowest score.
- OCR confidence adjusts score slightly.

### 10.3 Range Card

Visible content:

- Section: "Range".
- Formatted reference range.
- Latest range flag pill.

### 10.4 Timeline Chart

Visible content:

- Custom line chart.
- Background bands and guide lines.
- One point per trend reading.
- Selected point callout.
- Date labels for first and last point.

Click behavior:

- Tap a chart point -> selects that reading and updates selected point detail.

If no data:

- Shows "No timeline yet."

### 10.5 Selected Point Detail

Visible when:

- A selected or latest point exists.

Visible content:

- Value and unit.
- Range flag pill.
- Recorded date.
- Reference range and OCR trust.
- Share point button.
- Source document context if linked.
- "Open report" button if source document exists.

Click behavior:

- Share point -> native share sheet with value, date, status, reference range, and HealthFolio disclaimer.
- Open report -> `/documents/[documentId]`.

### 10.6 History Card

Visible content:

- Section: "History".
- Add button.
- Empty copy: "No readings recorded."
- Otherwise list of readings in reverse chronological order.

Row content:

- Value and unit.
- Date.
- Range flag pill.
- Delete action.

Click behavior:

- Tap row -> selects the point on chart/detail.
- Tap Delete -> confirmation alert, then `deleteReading`.
- Add -> opens add-reading modal.

### 10.7 Add Manual Reading Modal

Visible fields:

- Value.
- Unit.
- Date in `YYYY-MM-DD`.

Validation:

- Value must parse as number.
- Date must match `YYYY-MM-DD`.

Click behavior:

- Save -> `createReading`, invalidates trend and readings queries.
- Cancel -> closes modal.

## 11. Family Tab

Route: `/(tabs)/family`

Source: `apps/mobile/app/(tabs)/family.tsx`

Purpose:

- Lets the user manage profiles for family members or dependents, and switch the app's active record context.

Data loaded:

- `listFamilyMembers`.
- Active profile from `useProfileStore`.

### 11.1 Header

Visible content:

- Title: "Family".
- Add profile icon.

Click behavior:

- Tap plus -> opens add-profile modal.

### 11.2 Meta Rail

Visible content:

- `{members + 1} profiles`.
- "me selected" or "family selected".

### 11.3 Me Card

Visible content:

- Profile row:
  - Title: "Me".
  - Subtitle: "Selected" if active, otherwise "Personal".
  - Active pill or avatar.

Click behavior:

- Tap -> sets active profile to personal profile.

### 11.4 Profiles Card

Visible content:

- Header: "Profiles".
- Loading text while query loads.
- Empty state if no managed profiles.
- One row per managed profile.

Empty state:

- Icon: users.
- Title: "No profiles".
- Body: "Add one or upload reports."
- CTA: "Upload" -> `/documents/new`.

Managed profile row content:

- Profile name.
- Subtitle:
  - If selected: "Selected - {DOB} - {sex} - {blood group}".
  - If not selected: "{DOB} - {sex} - {blood group}".
- Status pill:
  - Active if selected.
  - Otherwise backend link status.
- Edit icon.
- Remove icon.

Click behavior:

- Tap row -> sets active profile to that member.
- Tap edit -> opens edit-profile modal populated with current data.
- Tap remove -> confirmation alert; if removed profile is active, app switches back to "Me"; then revokes family link.

### 11.5 Add/Edit Profile Modal

Visible fields:

- Full name.
- Date of birth selector.
- Gender segmented control:
  - Female.
  - Male.
  - Other.
- Units segmented control:
  - Metric.
  - Imperial.
- Blood group chip grid:
  - Not set.
  - All blood groups from shared enum.

Validation:

- Name, date of birth, and gender are required.

Click behavior:

- Create profile:
  1. Calls `createManagedProfile`.
  2. Invalidates family query.
  3. Sets new profile as active.
  4. Closes modal.
- Save profile:
  1. Calls `updateManagedProfile`.
  2. Invalidates family, documents, readings, and trend queries.
  3. Updates active profile display name if edited profile is active.
  4. Closes modal.
- Cancel -> closes modal and clears form.

Date picker behavior:

- Date of birth opens a bottom-sheet style date picker.
- Minimum date: 1900-01-01.
- Maximum date: today.

## 12. Profile Tab

Route: `/(tabs)/profile`

Source: `apps/mobile/app/(tabs)/profile.tsx`

Purpose:

- Account identity, editable health profile, privacy copy, security, export, doctor sharing, inbound email alias, support links, sign out, and account deletion.

Data loaded:

- `getMe`.

### 12.1 Header

Visible content:

- Title: "Profile".
- Avatar with user initials/name.

### 12.2 Identity Card

Visible content:

- User name or "Unnamed profile".
- Email or phone fallback.
- Edit icon.

Click behavior:

- Tap edit -> opens edit-profile modal.

### 12.3 Privacy Card

Visible content:

- Section: "Privacy".
- Copy: HealthFolio organizes user-provided records and does not provide diagnosis, prognosis, or medicine intake advice.

### 12.4 About Card

Visible content:

- Section: "About".
- Edit icon.
- Rows:
  - DOB.
  - Gender.
  - Blood.
  - Units.

Click behavior:

- Tap edit icon or any row -> opens edit-profile modal.

### 12.5 Edit Profile Modal

Visible fields:

- Full name.
- DOB date selector.
- Gender segmented control.
- Blood group chips.
- Units segmented control.

Validation:

- Name is required.

Click behavior:

- Save -> `updateMe`, invalidates `me`, closes modal.
- Cancel -> closes modal.

### 12.6 Security Card

Visible content:

- Section: "Security".
- Biometric lock switch.
- Export row.
- Doctor link row.
- Sign out button.

Click behavior:

- Biometric switch on:
  - Calls `pairBiometric`.
  - If pairing fails, switch resets off.
- Export row:
  - Calls `createPdfExportUrl`.
  - Opens returned download URL.
- Doctor link row:
  - Routes to `/shares`.
- Sign out:
  - Calls `signOut`.
  - Locks app state.
  - Routes to `/welcome`.

### 12.7 Inbox Card

Visible content:

- Section: "Inbox".
- Forwarding address box.
- Copy button.
- Alias row.

Forwarding address logic:

- Uses `user.inboundEmailAlias`.
- If runtime config has an address template with `{alias}`, replaces it.
- If runtime config has an inbound email domain, uses `{alias}@{domain}`.
- Otherwise shows alias directly.

Click behavior:

- Copy -> copies forwarding address to clipboard and temporarily changes button label to "Copied".
- Alias row -> opens forwarding alias modal.

### 12.8 Forwarding Alias Modal

Visible content:

- Title: "Forwarding alias".
- Help copy.
- Alias text field.
- Preview address.
- Save alias button.
- Cancel button.

Validation:

- Alias normalized to lowercase.
- Spaces, underscores, and periods become hyphens.
- Invalid characters are removed.
- Alias must match: 3 to 32 lowercase letters, numbers, and hyphens.

Click behavior:

- Save alias -> `claimInboundEmailAlias`, invalidates `me`, closes modal, shows success alert.
- Cancel -> closes modal.

### 12.9 Help Card

Visible rows:

- Privacy.
- Support.

Click behavior:

- Privacy -> opens public privacy policy URL.
- Support -> opens public support URL.

### 12.10 Delete Account Card

Visible content:

- Section: "Delete account".
- Copy: "Delete account and stored health data."
- Button: "Delete account".

Click behavior:

- Tap -> opens delete account modal.

### 12.11 Delete Account Modal

Visible content:

- Title: "Delete account".
- Warning that deletion is permanent.
- Lists deleted data:
  - Account.
  - Profile details.
  - Health documents.
  - Readings.
  - Managed family profiles.
  - Doctor-share links.
  - Exports.
  - Stored files.
- Acknowledgement row.
- Permanently delete button.
- Cancel button.

Click behavior:

- Acknowledgement row toggles required confirmation.
- Permanently delete:
  1. Calls `deleteAccount`.
  2. Clears React Query cache.
  3. Signs out locally.
  4. Locks auth state.
  5. Routes to `/welcome`.
  6. Shows account-deleted alert.
- Cancel -> closes modal.

## 13. Records Assistant Page

Route: `/assistant`

Source: `apps/mobile/app/assistant.tsx`

Purpose:

- Full page for asking records-only questions about uploaded documents, sent reports, and extracted readings.

Data loaded:

- `listDocuments`.
- `listReadings`.
- `getDocument` for detail.
- Active profile from `useProfileStore`.

### 13.1 Header

Visible content:

- Title: "Assistant".
- Back icon.

Click behavior:

- Back -> previous route.

### 13.2 Disclaimer Card

Visible content:

- Section: "Records first".
- Copy states HealthFolio summarizes uploaded records and OCR readings, can help frame follow-up questions, but does not diagnose or choose medication/dosage.

### 13.3 Ask Card

Visible content:

- Multiline field labeled "Ask".
- Placeholder: "What was low in my latest CBC?"
- Button: "Ask HealthFolio".

Click behavior:

- Ask HealthFolio:
  1. Uses current question.
  2. Calls `buildRecordsAssistantAnswer`.
  3. Shows answer or error fallback.

### 13.4 Answer Card

Visible content:

- Section: "Answer".
- Pill: "Records view".
- Default copy: "Ask a question about documents, trends, or review items."
- Assistant answer after query.
- Sources section if result includes sources.

Click behavior:

- Tap source row -> `/documents/[id]`.

### 13.5 Quick Asks

Visible prompts:

- Latest sent report.
- What was low?
- Latest hemoglobin.
- Summarize documents.

Click behavior:

- Tap prompt:
  1. Sets prompt as current question.
  2. Runs assistant answer.

### 13.6 Assistant Logic

Source: `apps/mobile/src/lib/assistant/recordsAssistant.ts`

Supported question categories:

- Empty question -> suggests asking about uploaded records, flagged markers, latest reports, or prescriptions.
- Medication advice intent:
  - Refuses to choose medicine or dosage.
  - Summarizes available prescription records if present.
  - Mentions flagged markers to discuss with clinician.
- Concern or abnormal-marker questions:
  - Lists notable flagged markers.
  - Adds instruction to verify against source report and discuss with clinician.
- Medication topic without advice request:
  - Finds prescription records.
  - Summarizes record titles, dates, and notes.
  - Repeats that it cannot decide intake or dosage.
- Latest or recent report questions:
  - Finds latest document.
  - Lists top extracted readings if present.
- Specific parameter questions:
  - Matches readings by parameter ID, canonical name, aliases, unit, or range flag.
  - Returns reading lines with value, unit, status, and date.
- Summary questions:
  - Loads relevant documents.
  - Summarizes document titles, dates, flagged values, and extracted reading counts.
- Score/readiness questions:
  - Explains health score inputs.
- Fallback:
  - Loads relevant documents and summarizes them, or suggests supported question types.

Data boundary:

- The assistant uses document metadata, notes, OCR status, extracted readings, and document detail returned by `getDocument`.
- It does not provide free-form medical diagnosis.
- It does not provide medication or dosage instructions.

## 14. Care Plan Screen

Route: `/medications`

Source: `apps/mobile/app/medications.tsx`

Purpose:

- Local reminder organizer for medicines, repeat tests, and doctor visits.

Storage:

- Local state store in `apps/mobile/src/lib/care/localCareStore.ts`.
- This screen is not a clinical prescription engine.

### 14.1 Header

Visible content:

- Title: "Care plan".
- Back icon.

Click behavior:

- Back -> previous route.

### 14.2 Summary Card

Visible stats:

- Medicines count.
- Follow-ups count.
- Today count.

Visible disclaimer:

- Reminders organize user records and do not change dosage or medical instructions.

### 14.3 Add Reminder Card

Visible fields:

- Kind chips:
  - Medicine.
  - Test.
  - Visit.
- Name field:
  - Label changes by kind.
- Details field.
- Date picker field.
- Time picker field.
- Source field.

Medicine-only optional source:

- Prescription source card.
- Camera.
- Photo.
- File.
- Attached file name or copy: "Optional. OCR review comes in the next round."

Click behavior:

- Camera/photo/file only stores selected source attachment name in the reminder form.
- Date/time fields open picker modal.
- Save reminder:
  1. Validates title.
  2. Validates date format.
  3. Validates time format.
  4. Adds reminder to local store.
  5. Clears form.

### 14.4 Upcoming Card

Visible content:

- Section: "Upcoming".
- Empty state if no reminders.
- Reminder rows sorted by next date/time.

Reminder row content:

- Kind icon.
- Title.
- Subtitle made from kind, detail, and due label.
- Pill:
  - Done if completed today.
  - Due otherwise.
- Trash icon.

Click behavior:

- Tap row -> toggles done today.
- Button "Remove oldest" appears when reminders exist and removes the last sorted item after confirmation.

Note:

- The row shows a trash icon, but row tap toggles done. The actual removal action currently uses the "Remove oldest" button.

### 14.5 Date/Time Picker Modal

Visible content:

- Title changes by mode:
  - Reminder date.
  - Reminder time.
- Spinner picker.
- Cancel and Done buttons.

Behavior:

- Date mode minimum date is today.
- Time mode uses 5-minute intervals.

## 15. Doctor Share Screen

Route: `/shares`

Source: `apps/mobile/app/shares.tsx`

Purpose:

- Creates and manages temporary doctor-share links.

Data loaded:

- `listShares`.

### 15.1 Header

Visible content:

- Title: "Share".
- New share link icon.

Click behavior:

- Tap plus -> opens create share link modal.

### 15.2 Hero Card

Visible content:

- Title: "Doctor link".
- Copy: "Read-only. Date-limited."

### 15.3 Links Card

Visible content:

- Header: "Links".
- Loading state.
- Empty state: "No active share links."
- One row per active share link.

Active link definition:

- Not revoked.
- Expiry date is in the future.

Row content:

- Date range.
- Expiry date/time.
- Single-use marker if applicable.
- Revoke action.

Click behavior:

- Revoke -> confirmation alert -> `revokeShare`.

### 15.4 Create Share Link Modal

Visible fields:

- Date from.
- Date to.
- Expiry options:
  - 24 hr.
  - 7 days.
  - 30 days.
- Single-use toggle row.
- Optional note for doctor.

Click behavior:

- Date fields open date picker modal.
- Single-use row toggles on/off.
- Create share link:
  1. Requires both dates.
  2. Calls `createShare`.
  3. Invalidates shares.
  4. Closes modal.
  5. Resets form.
  6. Opens native share sheet with share URL.
- Cancel -> closes and resets form.

### 15.5 Date Picker Modal

Visible content:

- Title:
  - Date from.
  - Date to.
- Spinner date picker.
- Cancel and Done buttons.

Validation:

- Maximum date is today.
- Date to minimum date is selected date from, if present.

## 16. Email Forwarding / Inbound Intake

Primary app surface:

- Profile tab, Inbox card.

Functionality:

- User has a private forwarding address derived from inbound email alias.
- User can copy address.
- User can change alias.
- Forwarded report attachments appear as documents in Docs after backend ingestion.
- Docs search and assistant logic understand forwarded email notes:
  - Forwarded attachment filename.
  - Forwarded subject.

Backend relationship:

- Email ingestion is handled outside the visible mobile UI.
- The mobile app consumes the resulting document rows and notes.

## 17. Data And API Inventory

Source: `apps/mobile/src/lib/api/endpoints.ts`

### 17.1 Profile And Account

Functions:

- `getMe`.
- `updateMe`.
- `claimInboundEmailAlias`.
- `updateHealthProfile`.
- `pairBiometric`.
- `deleteAccount`.

Surfaces:

- Profile tab.
- Lock/security flow.
- Forwarding alias modal.
- Account deletion modal.

### 17.2 Documents And OCR

Functions:

- `createDocument`.
- `uploadToPresignedUrl`.
- `markUploaded`.
- `listDocuments`.
- `listDocumentsByIds`.
- `getDocument`.
- `patchDocument`.
- `deleteDocument`.
- `getDownloadUrl`.

Surfaces:

- Docs tab.
- Add record.
- Document detail.
- Today insights.
- Assistant.
- Floating assistant.

OCR function:

- `process-document-ocr`.

### 17.3 Readings And Trends

Functions:

- `listReadings`.
- `createReading`.
- `getTrend`.
- `patchReading`.
- `deleteReading`.

Surfaces:

- Today health score and insights.
- Trends tab.
- Trend detail.
- Assistant.
- Floating assistant.

### 17.4 Family Profiles

Functions:

- `createManagedProfile`.
- `updateManagedProfile`.
- `listFamilyMembers`.
- `listFamilyMemberships`.
- `patchFamilyLink`.
- `revokeFamilyLink`.

Surfaces:

- Family tab.
- Profile chips in Docs and Trends.
- Active profile context across documents and readings.

### 17.5 Sharing And Export

Functions:

- `createShare`.
- `listShares`.
- `revokeShare`.
- `createPdfExportUrl`.
- `getPdfExportUrl`.

Surfaces:

- Shares screen.
- Profile export row.
- Profile doctor link row.

### 17.6 Local Stores

Stores:

- `useAuthStore`: unlocked state, stale state, idle relock.
- `useProfileStore`: active profile ID and display name.
- `useUploadQueueStore`: local upload/OCR queue.
- `useCareReminderStore`: local care reminders.

## 18. Clinical Trust And Safety Boundaries

The app currently includes these safety boundaries:

- Health score is explained as records-based and not a diagnosis or medical risk score.
- Document score is explained as completeness and OCR confidence only.
- Prescription OCR requires explicit approval before relying on extracted prescription information.
- Assistant refuses medication and dosage decisions.
- Assistant answers are grounded in records and sources.
- Care plan says reminders do not change dosage or medical instructions.
- Profile privacy copy says the app does not provide diagnosis, prognosis, or medicine intake advice.
- Shared point copy says it is user-provided record data, not medical advice.

## 19. Current Limitations To Know

These are important for product and QA planning:

- Assistant is grounded in available document metadata, notes, OCR status, and extracted readings. It should not be described as full raw PDF semantic search unless backend detail includes that content.
- Care plan reminders are currently local app reminders. The screen organizes reminders but does not yet schedule push notifications.
- Prescription source attachment in Care plan stores attachment name in the local form; it does not yet run OCR review from that screen.
- Add Record supports multiple file selection for Photos and Files, but Camera adds one capture at a time.
- Doctor share and export depend on configured backend endpoints and runtime config.
- Health score and record score are product signals, not clinical diagnosis.
- Some older OTP/auth code still exists, but the visible current auth path is email/password, Apple, and Google via Supabase auth.

## 20. End-To-End Click Flow Map

### 20.1 New User Flow

1. Open app.
2. `/` checks session.
3. No session -> `/welcome`.
4. Tap "I'm new".
5. `/(auth)/identifier?mode=signup`.
6. Choose email/password, Apple, or Google.
7. Successful signup -> `/(auth)/onboarding/health`.
8. Tap "Start uploading".
9. `/documents/new`.
10. Choose Camera, Photos, or Files.
11. Upload enters queue.
12. Queue creates document and starts OCR.
13. Analyzed item can be opened.
14. `/documents/[id]` shows source, score, OCR status, and extracted values.

### 20.2 Returning User Flow

1. Open app.
2. `/` checks session.
3. Session exists -> `/lock`.
4. Biometric succeeds or unavailable.
5. App routes to `/(tabs)/home`.
6. User sees Today dashboard.

### 20.3 Upload To Trend Flow

1. User taps Docs tab.
2. Tap plus.
3. `/documents/new`.
4. Select files.
5. Upload queue runs document creation, storage upload, OCR invocation, and polling.
6. Open analyzed document.
7. Document detail shows extracted values.
8. Tap Trends tab.
9. Latest readings are grouped into panel cards.
10. Tap a parameter.
11. Trend detail shows latest value, score, chart, history, source report, and share point.

### 20.4 Family Profile Flow

1. Tap Family tab.
2. Tap plus.
3. Add profile modal opens.
4. Enter name, DOB, gender, units, optional blood group.
5. Save profile.
6. New managed profile becomes active.
7. Docs and Trends show profile chips.
8. Uploads and readings can be scoped to selected profile.
9. Return to Family.
10. Tap a managed profile row to switch context.
11. Tap edit icon to update profile.
12. Tap remove icon to revoke profile link.

### 20.5 Profile And Inbox Flow

1. Tap Profile tab.
2. Identity card shows account details.
3. Tap edit or an About row.
4. Edit profile modal opens.
5. Save updates profile.
6. In Inbox card, copy forwarding address.
7. Tap Alias.
8. Set a new alias and preview address.
9. Save alias.
10. Forward future reports to the copied address.
11. Ingested reports appear in Docs.

### 20.6 Assistant Flow

1. Tap floating assistant button from any unlocked app screen.
2. Chat panel opens.
3. Ask a records question.
4. Assistant answers from uploaded documents and extracted readings.
5. Tap source link to open document detail.
6. Or tap "Open full assistant" to use `/assistant`.
7. Full assistant offers quick asks and source rows.

### 20.7 Doctor Share Flow

1. Tap Profile tab.
2. Tap Doctor link row.
3. `/shares` opens.
4. Tap plus.
5. Choose date range.
6. Choose expiry.
7. Choose single-use or not.
8. Add optional note.
9. Create share link.
10. Native share sheet opens with share URL.
11. Existing active links can be revoked.

### 20.8 Account Deletion Flow

1. Tap Profile tab.
2. Scroll to Delete account card.
3. Tap Delete account.
4. Read permanent deletion warning.
5. Tap acknowledgement row.
6. Tap Permanently delete account.
7. App calls delete endpoint, signs out, clears cache, and returns to Welcome.
