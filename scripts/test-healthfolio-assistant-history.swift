import Foundation

struct HealthRecord {
    let id: UUID
}

private func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else {
        fputs("FAIL: \(message)\n", stderr)
        exit(1)
    }
}

@main
struct AssistantHistoryTestRunner {
    static func main() {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("healthfolio-assistant-history-tests-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let profileAMessages = [AssistantMessage(role: .user, text: "My bilirubin?")]
        let profileBMessages = [AssistantMessage(role: .user, text: "My prescription?")]

        AssistantChatLocalStore.save(profileAMessages, profileKey: "profile-a", baseURL: root)
        AssistantChatLocalStore.save(profileBMessages, profileKey: "profile-b", baseURL: root)

        expect(
            AssistantChatLocalStore.load(profileKey: "profile-a", baseURL: root) == profileAMessages,
            "profile A should load only profile A history"
        )
        expect(
            AssistantChatLocalStore.load(profileKey: "profile-b", baseURL: root) == profileBMessages,
            "profile B should load only profile B history"
        )

        AssistantChatLocalStore.clear(profileKey: "profile-a", baseURL: root)
        expect(
            AssistantChatLocalStore.load(profileKey: "profile-a", baseURL: root).isEmpty,
            "clearing profile A should remove profile A history"
        )
        expect(
            AssistantChatLocalStore.load(profileKey: "profile-b", baseURL: root) == profileBMessages,
            "clearing profile A must preserve profile B history"
        )

        AssistantChatLocalStore.clearAll(baseURL: root)
        expect(
            AssistantChatLocalStore.load(profileKey: "profile-b", baseURL: root).isEmpty,
            "clear all should remove all profile histories"
        )

        print("HealthFolio assistant history tests passed")
    }
}
