import Foundation

enum FamilyProfileRole: String, CaseIterable, Identifiable, Hashable, Codable {
    case owner
    case viewer
    case contributor
    case guardian

    var id: String { rawValue }

    var label: String {
        switch self {
        case .owner: "Owner"
        case .viewer: "Viewer"
        case .contributor: "Contributor"
        case .guardian: "Guardian"
        }
    }

    var detail: String {
        switch self {
        case .owner: "Personal profile"
        case .viewer: "Can view shared records"
        case .contributor: "Can help add records"
        case .guardian: "Can manage care records"
        }
    }

    static var editableCases: [FamilyProfileRole] {
        [.viewer, .contributor, .guardian]
    }

    static func from(_ rawValue: String?) -> FamilyProfileRole {
        guard let rawValue else { return .viewer }
        return FamilyProfileRole(rawValue: rawValue.lowercased()) ?? .viewer
    }
}
