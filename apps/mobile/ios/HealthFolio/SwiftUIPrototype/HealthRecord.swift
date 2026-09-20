import Foundation

struct HealthRecord: Identifiable, Hashable {
    let id: UUID
    let ownerProfileId: String?
    let title: String
    let subtitle: String
    let score: Int
    let trust: Int
    let source: String
    let category: HealthRecordKind
    let status: NativeRecordStatus
    let sourceDate: Date
    let valueCount: Int
    let flaggedCount: Int
    let fileName: String
    let fileKey: String?
    let fileType: String?
    let createdAt: Date?
    let ocrStatusRaw: String?
    let ocrProgress: Int
    let ocrStage: String?
    let ocrQueuedAt: Date?
    let ocrStartedAt: Date?
    let ocrCompletedAt: Date?
    let emailIngestKey: String?
    let notes: String
    let metrics: [HealthMetric]

    init(
        id: UUID = UUID(),
        ownerProfileId: String? = nil,
        title: String,
        subtitle: String,
        score: Int,
        trust: Int,
        source: String,
        category: HealthRecordKind = .labReport,
        status: NativeRecordStatus = .ready,
        sourceDate: Date = Date.now,
        valueCount: Int = 0,
        flaggedCount: Int = 0,
        fileName: String = "report.pdf",
        fileKey: String? = nil,
        fileType: String? = nil,
        createdAt: Date? = nil,
        ocrStatusRaw: String? = nil,
        ocrProgress: Int = 0,
        ocrStage: String? = nil,
        ocrQueuedAt: Date? = nil,
        ocrStartedAt: Date? = nil,
        ocrCompletedAt: Date? = nil,
        emailIngestKey: String? = nil,
        notes: String = "",
        metrics: [HealthMetric] = []
    ) {
        self.id = id
        self.ownerProfileId = ownerProfileId
        self.title = title
        self.subtitle = subtitle
        self.score = score
        self.trust = trust
        self.source = source
        self.category = category
        self.status = status
        self.sourceDate = sourceDate
        self.valueCount = valueCount
        self.flaggedCount = flaggedCount
        self.fileName = fileName
        self.fileKey = fileKey
        self.fileType = fileType
        self.createdAt = createdAt
        self.ocrStatusRaw = ocrStatusRaw
        self.ocrProgress = ocrProgress
        self.ocrStage = ocrStage
        self.ocrQueuedAt = ocrQueuedAt
        self.ocrStartedAt = ocrStartedAt
        self.ocrCompletedAt = ocrCompletedAt
        self.emailIngestKey = emailIngestKey
        self.notes = notes
        self.metrics = metrics
    }
}
