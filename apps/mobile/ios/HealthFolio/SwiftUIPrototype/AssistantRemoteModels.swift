import Foundation

struct AssistantRemoteConfig: Decodable, Equatable {
    let version: String
    let enabled: Bool
    let responseSchemaVersion: String
    let maxQuestionCharacters: Int
}

struct AssistantRemoteResponse: Decodable {
    let answer: String
    let sourceRecordIds: [String]
    let isRefusal: Bool
    let configVersion: String
    let responseSchemaVersion: String
}
