import SwiftUI

enum CarePlanDueState {
    case completed
    case overdue
    case today
    case upcoming

    var label: String {
        switch self {
        case .completed: "Done"
        case .overdue: "Overdue"
        case .today: "Due today"
        case .upcoming: "Due"
        }
    }

    var symbol: String {
        switch self {
        case .completed: "checkmark.circle.fill"
        case .overdue: "exclamationmark.triangle.fill"
        case .today: "bell.badge.fill"
        case .upcoming: "clock.fill"
        }
    }

    var tint: Color {
        switch self {
        case .completed: HealthFolioTheme.green
        case .overdue: .red
        case .today: HealthFolioTheme.amber
        case .upcoming: HealthFolioTheme.blue
        }
    }
}
