import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const native = join(root, 'apps/mobile/ios/HealthFolio/SwiftUIPrototype');
const model = readFileSync(join(native, 'HealthFolioAppModel.swift'), 'utf8');
const apiSource = readFileSync(join(native, 'NativeSupabaseAPI.swift'), 'utf8');
const lookupExpression = apiSource.match(/getDocument\(id: (documentId\.uuidString(?:\.lowercased\(\))?), session:/)?.[1];
assert(lookupExpression, 'Test the production UUID-to-document-query conversion.');
const updateStart = model.indexOf('    private func updateUpload(');
const updateEnd = model.indexOf('    private func replaceDocument(', updateStart);
const replaceEnd = model.indexOf('    private func markDocumentFailed(', updateEnd);
const updateMethods = model.slice(updateStart, replaceEnd).replaceAll('private func', 'func');
const enqueue = model.slice(model.indexOf('    private func enqueueUpload('), model.indexOf('    private func enqueueFailedUpload('));
const initializer = enqueue.slice(enqueue.indexOf('        let placeholderId'), enqueue.indexOf('        uploads.insert'));
const processing = model.slice(model.indexOf('    private func processUpload('), model.indexOf('    private func reassignDocument('));
const dispatchStart = processing.indexOf('            let record: HealthRecord');
const dispatchEnd = processing.indexOf('\n            }', processing.indexOf('throw NativeSupabaseError.fileUnavailable', dispatchStart)) + '\n            }'.length;
const dispatch = processing.slice(dispatchStart, dispatchEnd);
const failureMethod = model.slice(model.indexOf('    private func failUpload('), updateStart);
assert(initializer.includes('NativeUploadItem('), 'Compile the real queue initializer, not a copied fixture.');
assert(dispatch.includes('supabase.uploadAndProcess('), 'Compile the real upload dispatch.');

// Compile the production initializer and dispatch with a recording API boundary.
// This catches an optimistic UI ID accidentally becoming a backend document ID.
const source = `
import Foundation
struct HealthRecord { let id: UUID; var ownerProfileId: String? = nil }
struct Profile { var id = "self-profile"; let displayName: String }
enum NativeSupabaseError: Error {
    case fileUnavailable
    case uploadProcessing(documentId: UUID, message: String)
    case ocrProcessing(documentId: UUID, message: String)
}
@MainActor final class QueueState {
    var uploads: [NativeUploadItem] = []
    var records: [HealthRecord] = []
    ${updateMethods}
}
@MainActor final class RecordingAPI {
    var calls: [String] = []
    let serverID = UUID()
    func uploadAndProcess(fileURL: URL, source: String, ownerProfileId: String?) async throws -> HealthRecord {
        calls.append("create:" + (ownerProfileId ?? "")); return HealthRecord(id: serverID)
    }
    func retryExistingUpload(documentId: UUID, fileURL: URL, source: String) async throws -> HealthRecord {
        calls.append("retry:" + documentId.uuidString); return HealthRecord(id: documentId)
    }
    func resumeOCRProcessing(documentId: UUID, source: String, fallbackFileName: String) async throws -> HealthRecord {
        calls.append("ocr:" + documentId.uuidString); return HealthRecord(id: documentId)
    }
}
@MainActor final class DelayedAPI {
    var continuation: CheckedContinuation<HealthRecord, Error>?
    func uploadAndProcess(fileURL: URL, source: String, ownerProfileId: String?) async throws -> HealthRecord {
        try await withCheckedThrowingContinuation { continuation = $0 }
    }
    func retryExistingUpload(documentId: UUID, fileURL: URL, source: String) async throws -> HealthRecord { fatalError("Unexpected retry") }
    func resumeOCRProcessing(documentId: UUID, source: String, fallbackFileName: String) async throws -> HealthRecord { fatalError("Unexpected OCR retry") }
}
@MainActor final class UploadRaceState {
    var uploads: [NativeUploadItem] = []
    var records: [HealthRecord] = []
    var profile = Profile(id: "profile-a", displayName: "A")
    var signedInProfile: Profile? = Profile(id: "account-a", displayName: "Account A")
    var activeProfileId: String? = "profile-a"
    var isSignedIn = true
    var lastUploadError: String?
    var refreshCount = 0
    var cleanedFiles: [URL] = []
    let supabase = DelayedAPI()
    func run(_ id: UUID) async { await processUpload(id) }
    func profileName(for id: String?) -> String { id ?? "" }
    func cleanupStagedFile(_ url: URL?) { if let url { cleanedFiles.append(url) } }
    func clearUploadFileURL(_ id: UUID) {
        if let index = uploads.firstIndex(where: { $0.id == id }) { uploads[index].fileURL = nil }
    }
    func markDocumentFailed(_ id: UUID, message: String) {}
    func friendlyUploadMessage(_ error: Error) -> String { "Upload failed" }
    // A skipped/offline refresh must not be required to remove another patient's record.
    func loadLiveData() async { refreshCount += 1 }
    ${processing}
    ${failureMethod}
    ${updateMethods}
}
@MainActor func route(_ upload: NativeUploadItem, api supabase: RecordingAPI) async throws -> HealthRecord {
    let targetProfileId = upload.ownerProfileId
    ${dispatch}
    return record
}
func makeQueuedUpload(source: String, targetProfileId: String) -> NativeUploadItem {
    let uploadId = UUID(), name = "synthetic-report.pdf"
    let fileURL = URL(fileURLWithPath: "/tmp/synthetic-report.pdf")
    let targetProfile = Profile(displayName: "Synthetic profile")
    ${initializer}
    precondition(upload.localRecordId == placeholderId)
    return upload
}
@MainActor func check(_ condition: Bool, _ message: String) {
    guard condition else { print("FAIL: " + message); exit(1) }
}
@main struct UploadTests {
    @MainActor static func main() async throws {
        var count = 0
        let documentId = UUID(uuidString: "abcdef12-3456-7890-abcd-ef1234567890")!
        let queriedID = ${lookupExpression}
        check(queriedID == "abcdef12-3456-7890-abcd-ef1234567890", "Retry must match lowercase PostgreSQL TEXT document IDs")
        count += 1
        for source in ["Files", "Photos"] {
            for owner in ["self-profile", "managed-profile"] {
                var upload = makeQueuedUpload(source: source, targetProfileId: owner)
                let api = RecordingAPI()
                check(upload.documentId == nil, "A new local placeholder must not be a server document ID")
                check(upload.localRecordId == upload.id, "A new upload must keep its local placeholder identity")
                _ = try await route(upload, api: api)
                check(api.calls == ["create:" + owner], "New file must create a document for the selected profile")
                upload.status = .failed
                _ = try await route(upload, api: api)
                check(api.calls.last == "create:" + owner, "Failure before server acceptance must remain a new upload")
                upload.documentId = api.serverID
                check(upload.localRecordId == api.serverID, "An accepted upload must refer to its server record")
                _ = try await route(upload, api: api)
                check(api.calls.last == "retry:" + api.serverID.uuidString, "Accepted upload retry must reuse the server ID")
                upload.fileURL = nil
                _ = try await route(upload, api: api)
                check(api.calls.last == "ocr:" + api.serverID.uuidString, "Accepted OCR retry must not create a duplicate")
                count += 7
            }
        }
        let empty = NativeUploadItem(name: "Missing file", source: "Files")
        let api = RecordingAPI()
        do { _ = try await route(empty, api: api); check(false, "Missing file must fail") }
        catch NativeSupabaseError.fileUnavailable { check(api.calls.isEmpty, "Missing file must not send a request") }
        let queue = QueueState()
        let queued = makeQueuedUpload(source: "Files", targetProfileId: "self-profile")
        queue.uploads = [queued]
        queue.records = [HealthRecord(id: queued.localRecordId)]
        queue.updateUpload(queued.id, status: .failed, progress: 1, message: "Storage failed", documentId: api.serverID)
        check(queue.uploads[0].documentId == api.serverID, "Typed upload failure must retain the backend ID")
        check(queue.records.isEmpty, "Server acceptance must remove the stale local placeholder")
        queue.uploads = [queued]
        queue.records = [HealthRecord(id: queued.localRecordId)]
        queue.replaceDocument(localRecordId: queued.localRecordId, with: HealthRecord(id: api.serverID))
        queue.updateUpload(queued.id, status: .analyzed, progress: 1, message: "Ready", documentId: api.serverID)
        check(queue.records.map(\\.id) == [api.serverID], "Success must retain exactly one backend record")
        queue.records = [HealthRecord(id: api.serverID), HealthRecord(id: queued.localRecordId)]
        queue.replaceDocument(localRecordId: queued.localRecordId, with: HealthRecord(id: api.serverID))
        check(queue.records.map(\\.id) == [api.serverID], "A dashboard refresh during upload must not duplicate the final record")
        count += 4
        print("Upload routing: \\(count + 1) checks passed")

        var raceChecks = 0, raceFailures = 0
        func raceCheck(_ condition: Bool, _ message: String) {
            raceChecks += 1
            if !condition { print("FAIL: " + message); raceFailures += 1 }
        }
        for scenario in ["same-profile", "profile-switch", "sign-out", "replacement-account", "same-account-new-session"] {
            for outcome in ["success", "upload-failure", "ocr-failure", "network-failure"] {
                let state = UploadRaceState()
                let queued = makeQueuedUpload(source: "Files", targetProfileId: "profile-a")
                state.uploads = [queued]
                let job = Task { await state.run(queued.id) }
                while state.supabase.continuation == nil { await Task.yield() }
                let existingID = UUID(), serverID = UUID()
                if scenario == "profile-switch" || scenario == "replacement-account" {
                    state.profile.id = "profile-b"
                    state.activeProfileId = "profile-b"
                }
                if scenario == "replacement-account" { state.signedInProfile?.id = "account-b" }
                if scenario == "sign-out" || scenario == "same-account-new-session" {
                    state.uploads = []
                    state.isSignedIn = scenario != "sign-out"
                    if scenario == "sign-out" { state.signedInProfile = nil; state.profile.id = "" }
                }
                state.records = [HealthRecord(id: existingID, ownerProfileId: state.profile.id)]
                switch outcome {
                case "success": state.supabase.continuation!.resume(returning: HealthRecord(id: serverID, ownerProfileId: "profile-a"))
                case "upload-failure": state.supabase.continuation!.resume(throwing: NativeSupabaseError.uploadProcessing(documentId: serverID, message: "Storage failed"))
                case "ocr-failure": state.supabase.continuation!.resume(throwing: NativeSupabaseError.ocrProcessing(documentId: serverID, message: "OCR pending"))
                default: state.supabase.continuation!.resume(throwing: URLError(.notConnectedToInternet))
                }
                await job.value
                let label = "\\(scenario)/\\(outcome)"
                let currentAccount = scenario == "same-profile" || scenario == "profile-switch"
                let expectedRecords = scenario == "same-profile" && outcome == "success" ? [serverID, existingID] : [existingID]
                raceCheck(state.records.map(\\.id) == expectedRecords, label + ": only the matching profile may publish a completed record")
                if currentAccount {
                    raceCheck(state.uploads.first?.status == (outcome == "success" ? .analyzed : .failed), label + ": legitimate background queue status must complete")
                    if outcome != "network-failure" {
                        raceCheck(state.uploads.first?.documentId == serverID, label + ": retain the accepted backend identity")
                    }
                    if outcome == "success" {
                        raceCheck(state.uploads.first?.fileURL == nil && state.cleanedFiles == [queued.fileURL!], label + ": clean completed staging files")
                    }
                } else {
                    raceCheck(state.lastUploadError == nil && state.refreshCount == 0, label + ": stale completions must not publish errors or trigger refresh")
                    if scenario == "replacement-account" {
                        raceCheck(state.uploads.first?.status == .processing && state.uploads.first?.documentId == nil, label + ": stale account must not mutate queue status")
                    } else {
                        raceCheck(state.uploads.isEmpty, label + ": cleared queue must remain empty")
                    }
                }
            }
        }
        guard raceFailures == 0 else { print("Upload races: \\(raceFailures) failures in \\(raceChecks) checks"); exit(1) }
        print("Upload races: \\(raceChecks) checks passed")
    }
}
`;
const temporary = mkdtempSync(join(tmpdir(), 'healthfolio-upload-tests-'));
try {
  const test = join(temporary, 'UploadTests.swift');
  const executable = join(temporary, 'upload-tests');
  writeFileSync(test, source);
  const compile = spawnSync('swiftc', [join(native, 'NativeUploadItem.swift'), test, '-o', executable], { stdio: 'inherit' });
  if (compile.error) throw compile.error;
  assert.equal(compile.status, 0, 'Upload regression harness must compile.');
  const run = spawnSync(executable, [], { stdio: 'inherit', timeout: 30_000 });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
