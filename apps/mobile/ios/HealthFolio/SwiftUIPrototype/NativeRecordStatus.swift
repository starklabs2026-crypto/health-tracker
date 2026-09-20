import SwiftUI

enum NativeRecordStatus: String, CaseIterable, Identifiable, Hashable {
    case all
    case ready
    case inProgress
    case failed

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "All"
        case .ready: "Ready"
        case .inProgress: "In progress"
        case .failed: "Failed"
        }
    }

    var tint: Color {
        switch self {
        case .all: HealthFolioTheme.blue
        case .ready: HealthFolioTheme.green
        case .inProgress: HealthFolioTheme.blue
        case .failed: .red
        }
    }

    var symbol: String {
        switch self {
        case .all: "tray.full"
        case .ready: "checkmark.circle.fill"
        case .inProgress: "clock.arrow.circlepath"
        case .failed: "exclamationmark.triangle.fill"
        }
    }
}
