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
        print("Profile unknown-date and sex-mapping regressions passed")
    }
}
