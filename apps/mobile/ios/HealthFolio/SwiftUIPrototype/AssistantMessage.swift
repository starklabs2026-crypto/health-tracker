import Foundation

struct AssistantMessage: Identifiable, Hashable, Codable {
    enum Role: String, Hashable, Codable {
        case user
        case assistant
    }

    let id: UUID
    let role: Role
    let text: String
    let sourceRecordIds: [UUID]
    let createdAt: Date

    init(
        id: UUID = UUID(),
        role: Role,
        text: String,
        sources: [HealthRecord] = [],
        sourceRecordIds: [UUID]? = nil,
        createdAt: Date = Date.now
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.sourceRecordIds = sourceRecordIds ?? sources.map(\.id)
        self.createdAt = createdAt
    }
}
