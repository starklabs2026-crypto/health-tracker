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
        "test.healthfolio+\(forwardingAlias)@gmail.com"
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
        switch value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "male", "m": "male"
        case "female", "f": "female"
        case "other": "other"
        default: nil
        }
    }
}
