# HealthFolio Supabase Edge Functions

## `assistant-config`

Authenticated configuration endpoint for the shipped SwiftUI Assistant. It returns only public operational values and never returns the OpenAI key or system prompt.

Environment controls:

```bash
npx --yes supabase@2.101.0 secrets set ASSISTANT_ENABLED=true
npx --yes supabase@2.101.0 secrets set ASSISTANT_MODEL=gpt-4.1-mini
npx --yes supabase@2.101.0 secrets set ASSISTANT_CONFIG_VERSION=1
npx --yes supabase@2.101.0 secrets set ASSISTANT_MAX_QUESTION_CHARACTERS=2000
npx --yes supabase@2.101.0 secrets set ASSISTANT_MAX_OUTPUT_TOKENS=1200
npx --yes supabase@2.101.0 secrets set ASSISTANT_REQUEST_TIMEOUT_MS=45000
```

The optional `ASSISTANT_SYSTEM_PROMPT` value is backend-only. Do not put it in the mobile bundle.

Deploy:

```bash
npx --yes supabase@2.101.0 functions deploy assistant-config --project-ref qojdeuacwkmlxmodeabt
```

## `assistant-response`

Authenticated, profile-scoped Assistant endpoint used by the native SwiftUI app. The caller supplies a question, optional selected `profileId`, and bounded conversation history. The function verifies the bearer token, authorizes the selected primary or managed family profile, fetches only that profile's records/readings, and calls OpenAI with `store: false`.

Response contract:

```json
{
  "answer": "...",
  "sourceRecordIds": ["document-row-id"],
  "isRefusal": false,
  "configVersion": "1",
  "responseSchemaVersion": "1"
}
```

Source ids are intersected with the authorized profile's document ids before returning. Provider errors do not expose upstream payloads to the app.

Deploy:

```bash
npx --yes supabase@2.101.0 functions deploy assistant-response --project-ref qojdeuacwkmlxmodeabt
```

## `process-document-ocr`

Authenticated Edge Function that replaces the local Tesseract/worker OCR path for the Supabase-backed MVP.

Request:

```json
{
  "documentId": "document-row-id"
}
```

Batch request:

```json
{
  "documentIds": ["document-row-id-1", "document-row-id-2"]
}
```

Requirements:

- Caller must pass a valid Supabase Auth bearer token.
- A matching HealthFolio `User` row must exist with `authUserId = auth.uid()`.
- The `Document.fileUrl` value must point to a private Supabase Storage object path.
- Supported files for MVP: PDF, JPG, PNG.
- The file should live in `medical-documents/<auth-user-id>/...` unless `Document.fileUrl` uses `storage://bucket/path`.

Behavior:

- Reads the document row from Supabase.
- Marks each document `queued`, then updates `ocrProgress`/`ocrStage` as it moves through download, catalog load, extraction, and save stages.
- Downloads the file from Supabase Storage using the service role.
- Fetches the 80-parameter catalog from `ParameterCatalog`.
- Sends the file and catalog to OpenAI with a strict JSON schema.
- Validates returned parameter ids against the catalog.
- Computes `rangeFlag` in code from catalog ranges.
- Deletes previous unverified pending readings for the document.
- Inserts new pending `ParameterReading` rows.
- Updates extracted `sourceDate` and `labName` when visible, then marks the document as `ready_for_review`.

Secrets:

```bash
npx --yes supabase@2.101.0 secrets set OPENAI_API_KEY=sk-...
npx --yes supabase@2.101.0 secrets set OPENAI_OCR_MODEL=gpt-4.1-mini
npx --yes supabase@2.101.0 secrets set DOCUMENT_BUCKET=medical-documents
```

Deploy:

```bash
npx --yes supabase@2.101.0 functions deploy process-document-ocr --project-ref qojdeuacwkmlxmodeabt
```

Invoke shape from app/backend later:

```ts
await supabase.functions.invoke('process-document-ocr', {
  body: { documentIds },
});
```

The OpenAI API key must never be exposed to Expo/mobile.

## `inbound-email-ingest`

Unauthenticated provider webhook for forwarded email attachments. Deploy with JWT verification
disabled; the function requires `EMAIL_INGEST_WEBHOOK_SECRET` in either
`Authorization: Bearer <secret>` or `x-healthfolio-email-secret`.

Supported request shapes:

- `multipart/form-data` inbound parse payloads with `to`, `recipient`, `recipients`, or `envelope`
  fields and attachment file parts.
- JSON payloads with `to`/`recipient`/`recipients` and base64 attachments:

```json
{
  "to": "hf-example@records.healthfolio.app",
  "from": "patient@example.com",
  "subject": "Lab report",
  "attachments": [
    {
      "filename": "report.pdf",
      "contentType": "application/pdf",
      "contentBase64": "..."
    }
  ]
}
```

Behavior:

- Resolves the recipient local part against `User.inboundEmailAlias`.
- Rejects senders that do not match the target user's HealthFolio account email. A separate
  authorised-senders list can be added later for multi-email workflows.
- Stores supported PDF/JPG/PNG attachments in the `medical-documents` bucket.
- Creates queued `Document` rows for the target user.
- Invokes `process-document-ocr` through `INTERNAL_FUNCTION_SECRET`, so forwarded documents use
  the same OCR, reading extraction, and managed-profile name routing as app uploads.

Secrets:

```bash
npx --yes supabase@2.101.0 secrets set EMAIL_INGEST_WEBHOOK_SECRET=...
npx --yes supabase@2.101.0 secrets set INTERNAL_FUNCTION_SECRET=...
```

Deploy:

```bash
npx --yes supabase@2.101.0 functions deploy inbound-email-ingest --project-ref qojdeuacwkmlxmodeabt --no-verify-jwt
npx --yes supabase@2.101.0 functions deploy process-document-ocr --project-ref qojdeuacwkmlxmodeabt
```
