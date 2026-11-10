import Foundation

enum NativeShareExpiry: String, CaseIterable, Identifiable, Hashable {
    case oneDay
    case oneWeek
    case oneMonth

    var id: String { rawValue }

    var label: String {
        switch self {
        case .oneDay: "24 hr"
        case .oneWeek: "7 days"
        case .oneMonth: "30 days"
        }
    }

    var duration: TimeInterval {
        switch self {
        case .oneDay: 24 * 60 * 60
        case .oneWeek: 7 * 24 * 60 * 60
        case .oneMonth: 30 * 24 * 60 * 60
        }
    }
}

struct DoctorShareRecord: Identifiable, Hashable {
    let id: String
    let ownerUserId: String
    let profileUserId: String
    let shareToken: String
    let dateRangeStart: Date
    let dateRangeEnd: Date
    let expiresAt: Date
    let singleUse: Bool
    let revokedAt: Date?
    let customNote: String?
    let createdAt: Date

    var shareURL: URL {
        NativeSupabaseConfig.doctorShareBaseURL
            .appendingPathComponent("share")
            .appendingPathComponent(shareToken)
    }

    var isActive: Bool {
        revokedAt == nil && expiresAt > Date()
    }
}
