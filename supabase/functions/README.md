# HealthFolio Supabase Edge Functions

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
