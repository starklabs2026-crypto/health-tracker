import Foundation

enum CarePlanKind: String, CaseIterable, Codable, Identifiable {
    case medicine
    case test
    case visit

    var id: String { rawValue }

    var label: String {
        switch self {
        case .medicine: "Medicine"
        case .test: "Test"
        case .visit: "Visit"
        }
    }

    var rowTitle: String {
        switch self {
        case .medicine: "Medicine"
        case .test: "Repeat test"
        case .visit: "Doctor visit"
        }
    }

    var inputLabel: String {
        switch self {
        case .medicine: "Medicine"
        case .test: "Test"
        case .visit: "Visit"
        }
    }

    var placeholder: String {
        switch self {
        case .medicine: "Metformin"
        case .test: "CBC / Lipids"
        case .visit: "Cardiology follow-up"
        }
    }

    var symbol: String {
        switch self {
        case .medicine: "pills"
        case .test: "waveform.path.ecg"
        case .visit: "calendar.badge.clock"
        }
    }
}
