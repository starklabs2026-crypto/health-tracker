import Foundation

enum CareReminderScheduleResult: Equatable {
    case scheduled
    case completedNoNotification
    case notScheduledPastDue
    case notificationsDisabled
    case missingTitle
    case failed(String)

    var message: String {
        switch self {
        case .scheduled:
            "Reminder saved and notification scheduled."
        case .completedNoNotification:
            "Reminder marked done and its notification was cancelled."
        case .notScheduledPastDue:
            "Reminder saved, but no notification was scheduled because the due time has already passed."
        case .notificationsDisabled:
            "Reminder saved. Enable notifications in Settings to receive alerts."
        case .missingTitle:
            "Add a medicine, test, or visit name."
        case .failed(let detail):
            "Reminder saved, but notification scheduling failed: \(detail)"
        }
    }
}
