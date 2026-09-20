import SwiftUI

enum HealthFolioTab: Hashable {
    case today
    case records
    case trends
    case care
    case assistant

    var title: LocalizedStringKey {
        switch self {
        case .today: "Today"
        case .records: "Records"
        case .trends: "Trends"
        case .care: "Care"
        case .assistant: "AI"
        }
    }

    var symbol: String {
        switch self {
        case .today: "house"
        case .records: "doc.text"
        case .trends: "waveform.path.ecg"
        case .care: "bell"
        case .assistant: "message"
        }
    }
}
