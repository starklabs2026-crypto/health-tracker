import Foundation

enum CarePlanLocalStore {
    private static let key = "healthfolio:care-reminders:native:v1"

    static func load() -> [CarePlanItem] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }

        do {
            return try JSONDecoder().decode([CarePlanItem].self, from: data)
        } catch {
            return []
        }
    }

    static func save(_ items: [CarePlanItem]) {
        guard let data = try? JSONEncoder().encode(items) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
