import Foundation

enum AssistantChatLocalStore {
    private static let historyDirectoryName = "AssistantHistory"
    private static let legacyFileName = "assistant-history.json"

    static func load(
        profileKey: String,
        baseURL: URL = URL.applicationSupportDirectory.appending(path: "HealthFolio")
    ) -> [AssistantMessage] {
        removeLegacyHistory(baseURL: baseURL)
        let fileURL = historyFileURL(profileKey: profileKey, baseURL: baseURL)
        guard let data = try? Data(contentsOf: fileURL) else { return [] }

        do {
            return try JSONDecoder().decode([AssistantMessage].self, from: data)
        } catch {
            return []
        }
    }

    static func save(
        _ messages: [AssistantMessage],
        profileKey: String,
        baseURL: URL = URL.applicationSupportDirectory.appending(path: "HealthFolio")
    ) {
        let fileURL = historyFileURL(profileKey: profileKey, baseURL: baseURL)
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            let data = try JSONEncoder().encode(messages)
            #if os(iOS)
            try data.write(to: fileURL, options: [.atomic, .completeFileProtection])
            #else
            try data.write(to: fileURL, options: [.atomic])
            #endif
        } catch {
            return
        }
    }

    static func clear(
        profileKey: String,
        baseURL: URL = URL.applicationSupportDirectory.appending(path: "HealthFolio")
    ) {
        try? FileManager.default.removeItem(at: historyFileURL(profileKey: profileKey, baseURL: baseURL))
    }

    static func clearAll(
        baseURL: URL = URL.applicationSupportDirectory.appending(path: "HealthFolio")
    ) {
        try? FileManager.default.removeItem(at: baseURL.appending(path: historyDirectoryName, directoryHint: .isDirectory))
        removeLegacyHistory(baseURL: baseURL)
    }

    private static func historyFileURL(profileKey: String, baseURL: URL) -> URL {
        let safeKey = Data(profileKey.utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "=", with: "")
        return baseURL
            .appending(path: historyDirectoryName, directoryHint: .isDirectory)
            .appending(path: "\(safeKey.isEmpty ? "unknown" : safeKey).json")
    }

    private static func removeLegacyHistory(baseURL: URL) {
        try? FileManager.default.removeItem(at: baseURL.appending(path: legacyFileName))
    }
}
