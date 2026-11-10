import Foundation

enum ProfileSexChoice: String, CaseIterable {
    case notSet = "Not set"
    case female = "Female"
    case male = "Male"
    case other = "Other"
}

struct ProfileEditorDraft: Equatable {
    let profileID: String
    var name: String
    var dateOfBirth: Date?
    var sexChoice: ProfileSexChoice
    var otherSex: String
    var bloodGroup: String
    var units: String
    var alias: String

    init(profile: HealthFolioProfile) {
        profileID = profile.id
        name = profile.name
        dateOfBirth = profile.dateOfBirth
        let savedSex = ProfileFieldPolicy.displayedSex(profile.sex, dateOfBirth: profile.dateOfBirth)
        sexChoice = ProfileSexChoice(rawValue: savedSex) ?? .other
        otherSex = ProfileSexChoice(rawValue: savedSex) == nil ? savedSex : ""
        bloodGroup = profile.bloodGroup.isEmpty ? "Not set" : profile.bloodGroup
        units = profile.units
        alias = profile.forwardingAlias
    }

    var normalizedAlias: String {
        alias.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    var sex: String {
        if sexChoice == .other, let custom = HealthFolioProfile.backendSex(for: otherSex) {
            return custom
        }
        return sexChoice.rawValue
    }

    mutating func selectDateOfBirth(_ date: Date, calendar: Calendar = .current) {
        if let dateOfBirth, calendar.isDate(dateOfBirth, inSameDayAs: date) { return }
        let day = calendar.startOfDay(for: date)
        // Preserve an explicitly selected birthday that would match a legacy placeholder.
        dateOfBirth = ProfileFieldPolicy.isPlaceholderDateOfBirth(day) ? day.addingTimeInterval(1) : day
    }

    static func == (lhs: Self, rhs: Self) -> Bool {
        let calendar = Calendar.current
        return lhs.profileID == rhs.profileID
            && lhs.name.trimmingCharacters(in: .whitespacesAndNewlines) == rhs.name.trimmingCharacters(in: .whitespacesAndNewlines)
            && lhs.dateOfBirth.map { calendar.startOfDay(for: $0) } == rhs.dateOfBirth.map { calendar.startOfDay(for: $0) }
            && HealthFolioProfile.backendSex(for: lhs.sex) == HealthFolioProfile.backendSex(for: rhs.sex)
            && lhs.bloodGroup == rhs.bloodGroup
            && lhs.units == rhs.units
            && lhs.normalizedAlias == rhs.normalizedAlias
    }

    var validationMessage: String? {
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Enter a name." }
        if let dateOfBirth, dateOfBirth > Date.now { return "Date of birth cannot be in the future." }
        if !["Metric", "US"].contains(units) { return "Choose Metric or US units." }
        let cleanAlias = normalizedAlias
        if cleanAlias.isEmpty { return "Enter a forwarding alias." }
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789-")
        if cleanAlias.unicodeScalars.contains(where: { !allowed.contains($0) }) || cleanAlias.hasPrefix("-") || cleanAlias.hasSuffix("-") || cleanAlias.contains("--") {
            return "Use letters, numbers, and single hyphens between words for the forwarding alias."
        }
        return nil
    }
}
