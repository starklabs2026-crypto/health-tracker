import Foundation
import UserNotifications

actor CareReminderScheduler {
    static let shared = CareReminderScheduler()

    private let center = UNUserNotificationCenter.current()

    func schedule(_ item: CarePlanItem, calendar: Calendar = .current) async -> CareReminderScheduleResult {
        await cancel(id: item.id)

        if item.isCompleted {
            return .completedNoNotification
        }

        let dueAt = item.dueAt(calendar: calendar)
        guard dueAt > Date.now else {
            return .notScheduledPastDue
        }

        do {
            let settings = await center.notificationSettings()
            let authorized = try await authorizationAllowed(currentStatus: settings.authorizationStatus)
            guard authorized else {
                return .notificationsDisabled
            }

            let content = UNMutableNotificationContent()
            content.title = "Care reminder"
            content.body = notificationBody(for: item)
            content.sound = .default
            content.userInfo = [
                "careReminderId": item.id.uuidString,
                "linkedRecordId": item.linkedRecordId?.uuidString ?? ""
            ]

            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: dueAt)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            let request = UNNotificationRequest(
                identifier: item.notificationIdentifier,
                content: content,
                trigger: trigger
            )

            try await center.add(request)
            return .scheduled
        } catch {
            return .failed(error.localizedDescription)
        }
    }

    func cancel(id: UUID) async {
        let identifier = CarePlanItem.notificationIdentifier(for: id)
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        center.removeDeliveredNotifications(withIdentifiers: [identifier])
    }

    private func authorizationAllowed(currentStatus: UNAuthorizationStatus) async throws -> Bool {
        switch currentStatus {
        case .authorized, .provisional, .ephemeral:
            true
        case .denied:
            false
        case .notDetermined:
            try await center.requestAuthorization(options: [.alert, .badge, .sound])
        @unknown default:
            false
        }
    }

    private func notificationBody(for item: CarePlanItem) -> String {
        let detail = item.detail.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = item.linkedRecordTitle ?? item.sourceNote
        let sourceCopy = source.trimmingCharacters(in: .whitespacesAndNewlines)

        if !detail.isEmpty, !sourceCopy.isEmpty {
            return "\(item.title) - \(detail) - Source: \(sourceCopy)"
        }

        if !detail.isEmpty {
            return "\(item.title) - \(detail)"
        }

        if !sourceCopy.isEmpty {
            return "\(item.title) - Source: \(sourceCopy)"
        }

        return item.title
    }
}
