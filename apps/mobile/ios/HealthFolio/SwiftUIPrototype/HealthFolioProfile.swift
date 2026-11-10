import Foundation

struct HealthFolioProfile: Identifiable, Hashable {
    var id: String
    var name: String
    var email: String
    var dateOfBirth: Date?
    var sex: String
    var bloodGroup: String
    var units: String
    var forwardingAlias: String
    var isPrimary: Bool
    var status: String
    var familyLinkId: String?
    var roleRaw: String

    var forwardingAddress: String {
        let alias = forwardingAlias.trimmingCharacters(in: .whitespacesAndNewlines)
        if alias.isEmpty { return "Not set" }
        return "\(alias)@records.healthfolio.app"
    }

    var role: FamilyProfileRole {
        FamilyProfileRole.from(roleRaw)
    }

    var displayName: String {
        isPrimary ? "Me" : name
    }

    var relationshipLabel: String {
        isPrimary ? FamilyProfileRole.owner.label : role.label
    }

    static let signedOut = HealthFolioProfile(
        name: "Profile",
        email: "",
        dateOfBirth: nil,
        sex: "Not set",
        bloodGroup: "Not set",
        units: "Metric",
        forwardingAlias: "profile",
        status: "locked"
    )

    init(
        id: String = "",
        name: String,
        email: String,
        dateOfBirth: Date?,
        sex: String = "Not set",
        bloodGroup: String,
        units: String,
        forwardingAlias: String,
        isPrimary: Bool = true,
        status: String = "active",
        familyLinkId: String? = nil,
        roleRaw: String = FamilyProfileRole.owner.rawValue
    ) {
        self.id = id
        self.name = name
        self.email = email
        self.dateOfBirth = dateOfBirth
        self.sex = sex
        self.bloodGroup = bloodGroup
        self.units = units
        self.forwardingAlias = forwardingAlias
        self.isPrimary = isPrimary
        self.status = status
        self.familyLinkId = familyLinkId
        self.roleRaw = roleRaw
    }

    static func backendSex(for value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        switch trimmed.lowercased() {
        case "", "not set", "not selected", "not entered": return nil
        case "male", "m": return "male"
        case "female", "f": return "female"
        case "other": return "other"
        default: return trimmed
        }
    }
}

enum ProfileFieldPolicy {
    /// Account creation used to persist these instants when the person had not entered a birthday.
    static func isPlaceholderDateOfBirth(_ date: Date) -> Bool {
        let instant = date.timeIntervalSince1970
        if abs(instant) < 1 { return true }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        let parts = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        return parts.year == 2000 && parts.month == 1 && parts.day == 1
            && parts.hour == 0 && parts.minute == 0 && (parts.second ?? 0) == 0
    }

    static func displayedDateOfBirth(_ date: Date?) -> Date? {
        guard let date, !isPlaceholderDateOfBirth(date) else { return nil }
        return date
    }

    /// "Other" paired with a creation placeholder is the untouched default, not a choice the person made.
    static func displayedSex(_ sex: String, dateOfBirth: Date?) -> String {
        switch HealthFolioProfile.backendSex(for: sex) {
        case nil:
            return "Not set"
        case "male":
            return "Male"
        case "female":
            return "Female"
        case "other":
            if let dateOfBirth, isPlaceholderDateOfBirth(dateOfBirth) { return "Not set" }
            return "Other"
        case let value?:
            return value
        }
    }
}
