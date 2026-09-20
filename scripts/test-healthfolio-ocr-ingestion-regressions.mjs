import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const ocrFunction = read('supabase/functions/process-document-ocr/index.ts');
const emailFunction = read('supabase/functions/inbound-email-ingest/index.ts');
const nativeApi = read(
  'apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift',
);
const nativeConfig = read(
  'apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseConfig.swift',
);
const nativeError = read(
  'apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseError.swift',
);
const uploadView = read(
  'apps/mobile/ios/HealthFolio/SwiftUIPrototype/UploadRecordsNativeView.swift',
);
const appModel = read(
  'apps/mobile/ios/HealthFolio/SwiftUIPrototype/HealthFolioAppModel.swift',
);

assert.match(
  ocrFunction,
  /body\.wait\s*===\s*true/,
  'OCR must reserve inline processing for callers that explicitly request wait=true.',
);
assert.match(
  ocrFunction,
  /EdgeRuntime\.waitUntil\(\s*processDocuments\(/,
  'Manual OCR must continue in the background after returning a queue acknowledgement.',
);
assert.match(
  ocrFunction,
  /status:\s*'queued'/,
  'Background OCR acknowledgement must identify the document as queued.',
);

assert.match(
  emailFunction,
  /await response\.json\(\)/,
  'Email ingestion must inspect the OCR result payload, not only the HTTP status.',
);
assert.match(
  emailFunction,
  /status\s*===\s*'failed'/,
  'Email ingestion must reject per-document OCR failures.',
);
assert.match(
  emailFunction,
  /wait:\s*false/,
  'Email ingestion must acknowledge documents and let OCR run in the background.',
);
assert.doesNotMatch(
  emailFunction,
  /wait:\s*true/,
  'Email ingestion must not block the webhook on OpenAI OCR.',
);
assert.match(
  emailFunction,
  /OCR_STALE_AFTER_MS[\s\S]*shouldRetryExistingDocument[\s\S]*queued.*processing/,
  'Email retries must recover stale queued or processing documents without duplicating them.',
);

assert.match(
  nativeApi,
  /timeoutInterval:\s*180/,
  'Native OCR invocation must tolerate the backend OpenAI processing ceiling.',
);
assert.match(
  nativeApi,
  /request\.timeoutInterval\s*=\s*timeoutInterval/,
  'The request helper must apply endpoint-specific timeout overrides.',
);
assert.match(
  nativeConfig,
  /static let functionsURL = URL\(string: "https:\/\/qojdeuacwkmlxmodeabt\.functions\.supabase\.co"\)!/,
  'Native OCR must use the direct Edge Function host that serves the active deployment.',
);
assert.match(
  nativeApi,
  /baseURL:\s*NativeSupabaseConfig\.functionsURL[\s\S]*path:\s*"\/process-document-ocr"[\s\S]*body:\s*\["documentId":\s*documentId\]/,
  'Manual native uploads must use the direct edge function with asynchronous OCR.',
);
assert.match(
  nativeApi,
  /guard terminalStatuses\.contains\(detail\.document\.ocrStatus \?\? ""\) else/,
  'Polling must fail explicitly when OCR does not reach a terminal state before timeout.',
);
assert.match(
  nativeApi,
  /func fetchAcceptedDocument\(\) async throws[\s\S]*catch is CancellationError[\s\S]*NativeSupabaseError\.ocrProcessing\(\s*documentId: acceptedDocumentId/,
  'Every post-acceptance polling failure must preserve the accepted document ID for retry.',
);
assert.match(
  nativeError,
  /case ocrProcessing\(documentId: UUID, message: String\)/,
  'A polling timeout must preserve the accepted backend document ID.',
);
assert.match(
  nativeError,
  /case uploadProcessing\(documentId: UUID, message: String\)/,
  'A post-create upload failure must preserve the accepted backend document ID.',
);
assert.match(
  appModel,
  /upload\.fileURL == nil, let documentId = upload\.documentId[\s\S]*resumeOCRProcessing\([\s\S]*documentId: documentId/,
  'Retry after OCR acceptance must poll the existing document instead of uploading a duplicate.',
);
assert.match(
  appModel,
  /upload\.fileURL, let documentId = upload\.documentId[\s\S]*retryExistingUpload\([\s\S]*documentId: documentId/,
  'Retry after storage or metadata failure must reuse the existing backend document.',
);
assert.match(
  appModel,
  /catch let NativeSupabaseError\.uploadProcessing\(documentId, message\)[\s\S]*updateUpload\([\s\S]*documentId: documentId/,
  'A post-create upload failure must keep the backend document attached to the queue item.',
);
assert.match(
  appModel,
  /catch let NativeSupabaseError\.ocrProcessing\(documentId, message\)[\s\S]*clearUploadFileURL/,
  'An accepted OCR timeout must store the real document ID and discard the now-unneeded staged upload.',
);
assert.match(
  nativeApi,
  /catch[\s\S]*ocrStage"\s*:\s*"upload_failed"/,
  'A storage failure must not leave a permanent pending_upload document behind.',
);
assert.match(
  nativeApi,
  /awaitOCRCompletion\(documentId:[\s\S]*ready_for_review[\s\S]*failed/,
  'The native client must poll background OCR until it reaches a terminal state.',
);
assert.match(
  nativeApi,
  /resumeOCRProcessing\([\s\S]*ocrStatus == "failed"[\s\S]*invokeOCR\(/,
  'Retrying a terminal OCR failure must requeue and invoke OCR again.',
);
assert.match(
  ocrFunction,
  /return Promise\.all\([\s\S]*processDocumentOcr\(/,
  'Multi-attachment OCR must process documents concurrently after the email webhook is acknowledged.',
);
assert.match(
  ocrFunction,
  /for \(let attempt = 1; attempt <= 2; attempt \+= 1\)[\s\S]*const \{ error: updateError \}[\s\S]*Could not persist OCR failure state/,
  'OCR failure-state persistence must check and retry database update errors.',
);
assert.match(
  nativeApi,
  /if detail\.document\.ocrStatus\s*==\s*"failed"[\s\S]*throw ocrFailure\(for: detail\.document\)[\s\S]*private func ocrFailure[\s\S]*document\.ocrError/,
  'A background OCR failure must fail the native queue instead of being labeled ready.',
);
assert.match(
  uploadView,
  /allowedContentTypes:\s*\[\.pdf,\s*\.jpeg,\s*\.png\]/,
  'The Files picker must expose only formats accepted by the storage bucket.',
);
assert.match(
  uploadView,
  /jpegData\(compressionQuality:/,
  'PhotosPicker images must be normalized to JPEG before upload.',
);
assert.match(
  nativeApi,
  /maximumUploadBytes\s*=\s*25\s*\*\s*1024\s*\*\s*1024/,
  'Native uploads must enforce the production bucket size limit.',
);
assert.match(
  nativeApi,
  /validateUploadFile\(fileURL\)[\s\S]*createDocument\(/,
  'File type and size validation must happen before a backend Document row is created.',
);
assert.match(
  nativeApi,
  /signedStorageURL\(fileKey: candidate[\s\S]*return url/,
  'Preview URL resolution must not require a HEAD request that signed storage URLs may reject.',
);
assert.match(
  ocrFunction,
  /extraction\.document_kind !== 'other'/,
  'OCR must not overwrite a useful upload category with the generic other category.',
);
assert.match(
  ocrFunction,
  /ordering_physician[\s\S]*updatePayload\.orderingPhysician/,
  'OCR must extract and persist an explicitly printed doctor or clinician name.',
);
assert.match(
  nativeApi,
  /recordTitle\(for: document[\s\S]*parts\.joined\(separator: " · "\)/,
  'Records must display institution, category/date, and physician metadata when available.',
);

console.log('OCR ingestion regression checks passed.');
