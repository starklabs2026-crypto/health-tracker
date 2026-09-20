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
        print("Profile unknown-date and sex-mapping regressions passed")
    }
}
