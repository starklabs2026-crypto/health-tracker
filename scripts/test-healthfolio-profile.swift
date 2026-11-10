import Foundation

@main
struct ProfileRegressionTests {
    static func main() {
        let missingDate: Date? = HealthFolioProfile.signedOut.dateOfBirth
        precondition(missingDate == nil, "Unknown date of birth must not become January 1, 1970")
        precondition(HealthFolioProfile.backendSex(for: "Not set") == nil)
        precondition(HealthFolioProfile.backendSex(for: "") == nil)
        precondition(HealthFolioProfile.backendSex(for: "Other") == "other")
        precondition(HealthFolioProfile.backendSex(for: " Female ") == "female")
        var olderProfile = HealthFolioProfile.signedOut
        olderProfile.dateOfBirth = Date(timeIntervalSince1970: -315_619_200)
        precondition(olderProfile.dateOfBirth != nil, "Pre-1970 dates are valid birth dates")
        let placeholder = Date(timeIntervalSince1970: 946_684_800)
        precondition(ProfileFieldPolicy.isPlaceholderDateOfBirth(placeholder), "1 Jan 2000 UTC is the creation placeholder")
        precondition(ProfileFieldPolicy.displayedDateOfBirth(placeholder) == nil, "placeholder birthday must not display")
        precondition(ProfileFieldPolicy.displayedSex("Other", dateOfBirth: placeholder) == "Not set")
        let realBirthday = Date(timeIntervalSince1970: 946_688_400)
        precondition(ProfileFieldPolicy.displayedDateOfBirth(realBirthday) != nil, "a later instant on 1 Jan 2000 is a real birthday")
        precondition(ProfileFieldPolicy.displayedSex("Other", dateOfBirth: realBirthday) == "Other")
        precondition(ProfileFieldPolicy.displayedSex("Not selected", dateOfBirth: nil) == "Not set")
        precondition(ProfileFieldPolicy.displayedSex("Not entered", dateOfBirth: nil) == "Not set")
        precondition(HealthFolioProfile.backendSex(for: " Custom description ") == "Custom description")
        precondition(ProfileFieldPolicy.displayedSex("Custom description", dateOfBirth: nil) == "Custom description")

        var profile = HealthFolioProfile.signedOut
        profile.sex = "Custom description"
        profile.dateOfBirth = realBirthday
        let saved = ProfileEditorDraft(profile: profile)
        precondition(saved.sexChoice == .other && saved.otherSex == "Custom description")
        var edited = saved
        edited.name += " "
        edited.alias = edited.alias.uppercased()
        edited.otherSex += " "
        edited.dateOfBirth = Calendar.current.startOfDay(for: realBirthday)
        precondition(edited == saved, "Formatting and time-of-day changes must not mark the form dirty")
        edited.otherSex = "Updated description"
        precondition(edited != saved && edited.sex == "Updated description")
        edited = saved
        edited.dateOfBirth = nil
        precondition(edited != saved, "Clearing an existing date is a real edit")

        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = .gmt
        edited.selectDateOfBirth(placeholder, calendar: utc)
        precondition(edited.dateOfBirth.map { utc.isDate($0, inSameDayAs: placeholder) } == true)
        precondition(ProfileFieldPolicy.displayedDateOfBirth(edited.dateOfBirth) != nil, "An explicit birthday must survive legacy-placeholder filtering")
        print("Optional birthdays, custom sex values, and profile draft regressions passed")
    }
}
