import Foundation

@main
struct AssistantRemoteModelTests {
    static func main() throws {
        let configData = Data("""
        {"version":"7","enabled":true,"responseSchemaVersion":"1","maxQuestionCharacters":2000}
        """.utf8)
        let responseData = Data("""
        {"answer":"Your latest report has one marker to review.","sourceRecordIds":["document-1"],"isRefusal":false,"configVersion":"7","responseSchemaVersion":"1"}
        """.utf8)

        let decoder = JSONDecoder()
        let config = try decoder.decode(AssistantRemoteConfig.self, from: configData)
        precondition(config.version == "7")
        precondition(config.enabled)
        precondition(config.responseSchemaVersion == "1")
        precondition(config.maxQuestionCharacters == 2000)

        let response = try decoder.decode(AssistantRemoteResponse.self, from: responseData)
        precondition(response.answer.contains("latest report"))
        precondition(response.sourceRecordIds == ["document-1"])
        precondition(!response.isRefusal)
        precondition(response.configVersion == "7")
        precondition(response.responseSchemaVersion == "1")

        print("Assistant remote model decoding tests passed")
    }
}
