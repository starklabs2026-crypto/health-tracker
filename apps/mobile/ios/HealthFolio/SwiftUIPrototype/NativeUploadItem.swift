import Foundation

struct NativeUploadItem: Identifiable, Hashable {
    enum Status: String, Hashable {
        case queued
        case uploading
        case processing
        case analyzed
        case failed

        var label: String {
            switch self {
            case .queued: "Queued"
            case .uploading: "Uploading"
            case .processing: "Reading"
            case .analyzed: "Ready"
            case .failed: "Failed"
            }
        }
    }

    let id: UUID
    let name: String
    let source: String
    let createdAt: Date
    var progress: Double
    var status: Status
    var documentId: UUID?
    var fileURL: URL?
    var ownerProfileId: String?
    var ownerProfileName: String?
    var message: String

    // Queue IDs identify optimistic UI rows; documentId is assigned only by Supabase.
    var localRecordId: UUID { documentId ?? id }

    init(
        id: UUID = UUID(),
        name: String,
        source: String,
        createdAt: Date = Date.now,
        progress: Double = 0.08,
        status: Status = .queued,
        documentId: UUID? = nil,
        fileURL: URL? = nil,
        ownerProfileId: String? = nil,
        ownerProfileName: String? = nil,
        message: String = "Queued for OCR"
    ) {
        self.id = id
        self.name = name
        self.source = source
        self.createdAt = createdAt
        self.progress = progress
        self.status = status
        self.documentId = documentId
        self.fileURL = fileURL
        self.ownerProfileId = ownerProfileId
        self.ownerProfileName = ownerProfileName
        self.message = message
    }
}
