# HealthFolio Build 53 vs Build 60 Functionality Diff

Generated on 2026-06-26.

Reference documents:

- Build 53: `docs/healthfolio-functionality-reference-build-53.md`.
- Build 60: `docs/healthfolio-functionality-reference-build-60.md`.

Build artifacts checked:

- Build 53 IPA exists locally at `build/ios/export/20260625-110238/HealthFolio-1.0.0-53.ipa`.
- No local build 60 IPA was found in `build/ios/export` or `apps/mobile/build` during this comparison.

Interpretation:

- Build 53 is the feature baseline from the archived Expo / React Native IPA.
- Build 60 is the current reference generated from local app code and appears stronger on UI structure, edit modals, charts, cards, and visual hierarchy.
- The most important build 60 gaps are not the whole app shell; they are specific preservation items that are partial, not verified in a shipped artifact, or thinner than build 53's baseline intent.

## Executive Summary

Build 60 appears to preserve the main HealthFolio product surface on paper:

- Today.
- Docs.
- Trends.
- Family.
- Profile.
- Add record.
- Document detail.
- Trend detail.
- Assistant.
- Care plan.
- Doctor share.
- Email forwarding.
- Biometric lock.
- Export.
- Account deletion.

Build 60 is superior in UI direction because it has:

- Cleaner card structure.
- More explicit editable profile modals.
- Better trend detail architecture.
- Better score explanations.
- More polished doctor-share and account-deletion flows.
- More detailed profile and forwarding alias controls.

However, build 60 still has functional gaps or regression risks compared to the build 53 preservation baseline:

1. No local build 60 IPA was found, so source-level functionality has not been proven against the shipped build artifact.
2. Document preview is still incomplete for PDFs and non-image files; build 60 documents say image previews exist, otherwise only a file preview box/open/share path.
3. Care reminders are local only and do not schedule push notifications.
4. Care-plan source attachments do not run OCR from that screen.
5. Assistant is records-grounded, but not full raw PDF/OCR-text semantic search.
6. Family auto-grouping by OCR is not implemented; profile assignment is still manual/active-profile based.
7. Forwarded email processing has no visible in-app processing log or reconciliation screen.
8. Existing doctor-share links appear to support revoke, but the build 60 reference does not document a persistent copy/open/share action after creation.
9. Build 60 changes some navigation behavior around profile switching; Today routes profile identity to Profile rather than clearly offering direct active-profile switching.
10. Some features depend on backend/runtime config and should be tested end to end before treating them as preserved.

## Status Legend

| Status | Meaning |
| --- | --- |
| Improved in 60 | Build 60 keeps the build 53 capability and adds clearer UI or deeper controls. |
| Preserved | Build 60 appears to keep the build 53 capability. |
| Changed | Build 60 keeps the broad capability but changes the route, behavior, or wording. |
| Partial in 60 | Build 60 has part of the feature, but not the full build 53 preservation intent. |
| Missing / needs restore | Build 60 lacks the documented behavior or it is not documented. |
| Needs device QA | The docs/source suggest support, but no build 60 IPA was available locally to verify shipped behavior. |

## High Priority Gaps To Review Before Adding Features Back

| Area | Build 53 baseline | Build 60 state | Status | Recommendation |
| --- | --- | --- | --- | --- |
| Build artifact proof | Build 53 is tied to an actual local IPA. | No build 60 IPA found locally for direct extraction/comparison. | Needs device QA | Get/export the exact build 60 IPA or verify installed TestFlight behavior before final decisions. |
| Document preview | Document page should help verify what was uploaded; preview preferred when image-based or renderable; open/share path expected. | Image preview is documented; non-image files show a generic preview box with Open/Share. | Partial in 60 | Add real PDF preview or first-page thumbnail. Keep Open and Share. |
| PDF/non-image record review | Build 53 baseline expects users can confirm the original uploaded document. | Build 60 can open/share, but inline review appears limited for PDFs. | Partial in 60 | Add PDF preview, page count, file size, and source metadata. |
| Reminder notifications | Care/reminder flow should remind users about medicine, next blood test, X-ray, or visit. | Build 60 reminders are local app state only; no push/local notification scheduling. | Missing / needs restore | Add local notification scheduling, permission request, and due-state handling. |
| Care-plan prescription attachment | Build 53 preservation includes prescription OCR verification and care/reminder usefulness. | Care plan can attach a source name, but "OCR review comes in the next round." | Partial in 60 | Let a reminder link to an existing prescription/document or start OCR upload from the care flow. |
| Records assistant depth | Build 53 expects records-grounded answers from uploaded/forwarded docs. | Build 60 assistant uses metadata, notes, OCR status, extracted readings, and document detail. It is not full raw PDF text search. | Partial in 60 | If backend stores OCR text, add source-snippet retrieval and citations. If not, label assistant as readings/metadata-based. |
| Family auto-grouping | Build 53 plan expected document/profile association and future OCR grouping. | Build 60 uses active profile context and profile chips. Auto-grouping by OCR is not documented. | Partial in 60 | Add post-upload "Assign to profile" review and later OCR-based suggested profile matching. |
| Email ingestion visibility | Build 53 supports forwarding to private intake and documents appearing after backend ingestion. | Build 60 consumes resulting document rows but has no visible email-ingest processing log. | Partial in 60 | Add an Inbox Processing section: received, queued, OCR, failed, duplicate. |
| Existing doctor-share link reuse | Build 53 expects share link creation and management. | Build 60 creates share links and opens native share sheet; existing row documents revoke but not copy/open/share. | Partial in 60 | Add Copy Link, Share Again, Open Preview, Revoke for each active link. |
| Auth crash resilience | Build 53 preservation calls out stable "I am new", "I have account", sign-out, reopen. | Build 60 source docs describe auth flows, but exact build 60 installed behavior is not artifact-verified here. | Needs device QA | Run device smoke tests for new account, existing account, sign-out, reopen, biometric lock. |

## Feature-by-Feature Comparison

### 1. App Shell And Launch

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Expo / React Native shell | Confirmed by IPA: `main.jsbundle`, Expo config, Expo Router assets. | Current reference still describes Expo Router app in `apps/mobile`. | Preserved |
| Five-tab app | Today, Docs, Trends, Family, Profile baseline. | Same five tabs documented. | Preserved |
| Stable launch | Build 53 is the shipped baseline. | Build 60 docs show launch routing, but no local build 60 IPA proof. | Needs device QA |
| New-user path | Build 53 requires stable "I am new" path. | Build 60 has Welcome and Identifier Auth with new account path. | Needs device QA |
| Existing-user path | Build 53 requires stable "I have an account" path. | Build 60 has email/password, Apple, and Google auth paths. | Needs device QA |
| Sign-out/reopen | Build 53 preservation item. | Build 60 calls `signOut`, locks state, routes to `/welcome`. | Needs device QA |
| Lock/biometric route | Build 53 has biometric lock path. | Build 60 has hardware/enrollment check and unlock flow. | Improved in 60 |

Functional concern:

- The app shell looks preserved in source, but auth/launch crashes are device-only issues. This needs a build 60 smoke test, especially after sign-out.

### 2. Today / Home

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Main dashboard | Score, insights, next action, timeline. | Health score, next action, insights, weekly timeline, tools. | Preserved |
| Score explanation | Build 53 requires score inputs and non-diagnostic disclaimer. | Build 60 has point split: marker status, record depth, panel coverage, OCR trust, profile context, review penalty. | Improved in 60 |
| 7-day timeline | Present in build 53 bundle evidence. | Present and counts documents/readings for last 7 days. | Preserved |
| Next action | Upload/review/processing prompts. | Same logic documented. | Preserved |
| Assistant and care entry | Build 53 expected tools. | Build 60 includes Care plan and Assistant rows. | Preserved |
| Active profile switching from Today | Build 53 allowed profile identity to route to profile/family selection depending on implementation. | Build 60 header profile pill routes to Profile. | Changed |

Potential missing piece:

- If users expect quick family switching from the Today header, build 60 may feel weaker because the switcher is more clearly present in Docs/Trends/Family rather than Today.

### 3. Docs / Records Inbox

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Records list | Document inbox with rows and status. | Uploaded/forwarded documents by selected profile. | Preserved |
| Search | Search title, filename, lab, date, notes, status. | Search display title, lab, notes, date, status, forwarded subject/filename. | Preserved |
| Status counts | Ready, reading, failed, pending. | Ready, reading, failed, pending. | Preserved |
| Status filters | All, ready, in progress, failed. | Same. | Preserved |
| Document type filters | Blood, prescription, imaging, surgery, vaccines, other. | Same category chips. | Preserved |
| Family/profile filtering | Profile chips/selector expected. | Profile chips for Me and active managed profiles. | Preserved |
| Empty states | Upload or forward prompt. | Empty states exist, but "Choose a profile" logic may appear when Me is selected and family profiles exist. | Changed |

Potential UX/functionality concern:

- Build 60 has the data functions, but the records list can still feel visually dense. This is a UI problem, not a missing core function.

### 4. Add Record / Upload

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Camera upload | Expected. | Present. | Preserved |
| Photo upload | Expected. | Present with multiple image selection. | Preserved |
| File upload | Expected. | Present with multiple file selection. | Preserved |
| Multi-file queue | Build 53 preservation item. | Present for Photos and Files. | Preserved |
| Camera multi-capture | Not explicitly guaranteed. | Camera adds one capture at a time. | Changed |
| Upload queue | Queued, uploading, processing, analyzed, failed. | Same states documented. | Preserved |
| Retry/open/remove queue item | Expected. | Present. | Preserved |
| OCR invocation | Build 53 baseline. | `process-document-ocr` invoked after upload. | Preserved |
| Prescription warning | Build 53 bundle evidence. | Alert appears if file inferred as prescription. | Preserved |

Potential missing piece:

- If the product requirement is true batch camera scanning, build 60 does not document it. It only supports one camera capture per action.

### 5. Document Detail

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Open original document | Expected; bundle has "Opening HealthFolio document." | Open signed URL. | Preserved |
| Share original document | Expected. | Native share sheet with document URL. | Preserved |
| Inline image preview | Preferred where renderable. | Present for images with signed URL. | Preserved |
| Inline PDF preview | Preferred where renderable. | Not documented; generic file preview box otherwise. | Partial in 60 |
| Score explanation | Expected. | Dedicated score calculation card. | Improved in 60 |
| OCR status pipeline | Expected. | Uploaded, Reading/Read, Ready steps. | Preserved |
| Extracted values | Expected. | Values with OCR trust and range flag. | Preserved |
| Prescription verification | Expected. | Approve OCR button writes note. | Preserved |
| Delete document | Expected. | Present with confirmation. | Preserved |

Highest document-page gap:

- Build 60 needs better original-file preview, especially PDFs. This is the clearest practical regression/shortfall versus the build 53 baseline expectation that users can verify what was uploaded.

### 6. Trends

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Biomarker list | Expected. | Latest readings grouped by panel. | Preserved |
| Search | Parameter/panel search expected. | Search field. | Preserved |
| Panel filters | Expected. | Panel filter chips. | Preserved |
| Latest values | Expected. | Present. | Preserved |
| Important values highlighted | Expected by product direction. | Build 60 has latest hero and flags, but needs device/UI QA for readability. | Needs device QA |
| Trend detail | Expected. | Latest hero, range card, timeline chart, selected point, history. | Improved in 60 |
| Data point details | Desired from meeting notes. | Selected point detail exists. | Improved in 60 |
| Manual reading CRUD | Not clear in build 53. | Add, patch, delete readings documented. | Improved in 60 |
| Share point | Not clear in build 53. | Share point via native share sheet. | Improved in 60 |

Functional concern:

- Build 60 is stronger than build 53 here, but the chart can still be visually weak if it is not easy to read on device.

### 7. Family

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Family tab | Expected. | Present. | Preserved |
| Select active profile | Expected. | Present via Me card/profile rows. | Preserved |
| Add managed profile | Expected. | Add modal with name, DOB, sex, blood group, units. | Preserved |
| Edit managed profile | Build 53 requested editability. | Present. | Preserved |
| Delete/remove profile | Expected. | Present with confirmation/revoke. | Preserved |
| Relationship labels editable | Build 53 says labels like Guardian should not be hardcoded. | Build 60 reference does not clearly document relationship field editing; it documents name/DOB/sex/blood/units. | Partial in 60 |
| OCR auto-grouping | Future/intended behavior in build 53 doc. | Not documented. | Missing / needs restore |
| Correct assignment after upload | Expected. | Active profile context exists; post-upload reassignment is not clearly documented. | Partial in 60 |

Highest family gap:

- Build 60 should add or confirm editable relationship/role and profile reassignment for documents.

### 8. Profile

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Account identity | Expected. | Present with edit modal. | Improved in 60 |
| Editable About section | Build 53 requested. | Present: DOB, gender, blood, units editable. | Improved in 60 |
| Privacy disclaimer | Expected. | Present. | Preserved |
| Biometric lock | Expected. | Present with pairBiometric flow. | Preserved |
| Export PDF | Expected. | Present via `createPdfExportUrl`. | Preserved, backend-dependent |
| Share with doctor | Expected. | Routes to `/shares`. | Preserved |
| Forwarding address | Expected. | Present. | Preserved |
| Forwarding alias edit | Expected. | Alias modal with validation. | Improved in 60 |
| Support/privacy links | Expected. | Present. | Preserved |
| Sign out | Expected. | Present. | Needs device QA |
| Account deletion | Expected. | Modal with acknowledgement and data list. | Improved in 60 |

Potential missing piece:

- Export and doctor share are documented but backend-dependent. They need a live smoke test before being considered fully preserved.

### 9. Assistant

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Floating assistant | Expected and bundle-evidenced. | Present. | Preserved |
| Full assistant page | Expected. | Present. | Preserved |
| Ask about sent/uploaded docs | Expected. | Present through documents/readings/detail lookup. | Preserved |
| Source rows | Expected. | Present. | Preserved |
| Records-only guardrails | Expected. | Present. | Preserved |
| Medication/dosage refusal | Expected. | Present. | Preserved |
| Raw PDF/full OCR text search | Not proven in build 53, but desired for "query sent docs." | Not present unless backend document detail stores richer text. | Partial in 60 |
| Chat history panel | Build 53 expected larger chat surface. | Build 60 full page answer model is documented; persistent chat history is not clearly documented. | Partial in 60 |

Highest assistant gap:

- Build 60 should either add richer OCR text retrieval or clearly label the assistant as reading metadata/extracted values, not entire documents.

### 10. Care Plan / Medications

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Care/reminder screen | Expected. | Present at `/medications`. | Preserved |
| Medicine reminders | Expected. | Present as reminder kind. | Preserved |
| Test reminders | Expected. | Present as reminder kind. | Preserved |
| Visit reminders | Expected. | Present as reminder kind. | Preserved |
| Local due tracking | Expected. | Present. | Preserved |
| Push/local notifications | Meeting requirement, not clearly proven in build 53 doc. | Not implemented; current limitation says reminders are local app reminders only. | Missing / needs restore |
| Prescription attachment OCR | Desired. | Attachment name only; no OCR review from care screen. | Partial in 60 |
| Per-row delete | Row shows trash icon, but actual removal is "Remove oldest." | Partial in 60 |

Highest care-plan gaps:

- Add proper local notifications.
- Make row-level delete match the visible trash icon.
- Link reminders to existing documents/prescriptions.

### 11. Doctor Share

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Create share link | Expected. | Present. | Preserved |
| Temporary/date-limited link | Expected. | Present. | Preserved |
| Single-use option | Not clear in build 53. | Present. | Improved in 60 |
| Revoke link | Expected. | Present. | Preserved |
| Native share after creation | Expected. | Present. | Preserved |
| Copy/open/share existing link | Expected by practical use. | Not documented for existing rows; row documents revoke only. | Partial in 60 |

Highest share gap:

- Add actions on existing share links: Copy, Share Again, Open Preview, Revoke.

### 12. Email Forwarding

| Capability | Build 53 | Build 60 | Status |
| --- | --- | --- | --- |
| Private intake address | Confirmed in build 53 config. | Present in Profile Inbox card. | Preserved |
| Copy address | Expected. | Present. | Preserved |
| Alias edit | Expected. | Present with validation. | Improved in 60 |
| Forwarded docs appear in Docs | Expected. | Present as backend relationship. | Preserved, backend-dependent |
| Search forwarded subject/filename | Expected. | Present. | Preserved |
| Processing log | Useful for email ingestion confidence. | Not documented. | Missing / needs restore |
| Duplicate/failed email handling UI | Useful for production support. | Not documented. | Missing / needs restore |

Highest forwarding gap:

- Add an inbound inbox/debug surface for "received, duplicate, processing, failed, ready" so users know whether new emails were processed.

## What Build 60 Clearly Improves

Build 60 should not be rolled back wholesale. It improves or clarifies:

- Health score point explanation.
- Document score explanation.
- Editable Profile About section.
- Profile alias editing and validation.
- Trend detail depth.
- Selected trend point details.
- Manual reading add/edit/delete.
- Doctor-share creation form.
- Account deletion safety modal.
- Care plan form structure.
- Records assistant guardrails.
- Profile privacy copy.

## What Build 60 Should Restore Or Add First

Priority 1:

1. Verify exact build 60 installed behavior from an IPA/TestFlight build.
2. Add PDF/original-document preview in Document Detail.
3. Add local notification scheduling for Care reminders.
4. Add copy/share/open actions for existing doctor share links.
5. Add an email-ingestion status surface.

Priority 2:

1. Add richer assistant source retrieval from OCR text if backend stores it.
2. Add persistent assistant chat history.
3. Add document profile reassignment after upload.
4. Add editable family relationship/role.
5. Add OCR-based suggested family grouping.

Priority 3:

1. Add batch camera scanning.
2. Make care-plan prescription attachments link to OCR/document review.
3. Improve row-level deletion for reminders.
4. Add clearer profile switcher access from Today.

## Practical Decision List

Keep from build 60:

- UI direction.
- Five-tab shell.
- Health score with point split.
- Trend detail chart/detail structure.
- Profile edit modals.
- Forwarding alias modal.
- Account deletion modal.
- Doctor-share modal.

Restore or strengthen from build 53 baseline:

- Proven launch/auth stability.
- Original-file verification on document detail.
- Stronger upload-to-review flow for PDFs.
- Clearer email-ingestion visibility.
- More complete assistant grounding.
- Better family/profile assignment control.
- Reminder notifications.

Do not treat as missing:

- Core upload.
- OCR invocation.
- Docs list.
- Trends list.
- Family management.
- Profile edit.
- Forwarding address.
- Floating assistant.
- Doctor share creation.
- Export row.

Those are documented in build 60, but still need QA because the local build 60 IPA was not available for artifact-level verification.
