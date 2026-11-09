import Foundation

enum NativeSupabaseConfig {
    static let projectRef = "qojdeuacwkmlxmodeabt"
    static let url = URL(string: "https://qojdeuacwkmlxmodeabt.supabase.co")!
    static let functionsURL = URL(string: "https://qojdeuacwkmlxmodeabt.functions.supabase.co")!
    static let publishableKey = "sb_publishable_d-pZ2zQvS-0QA5KR5EdloA_KOw1MUoI"
    static let documentBucket = "medical-documents"
    static let doctorShareBaseURL = URL(string: "https://healthfolio.app")!
    static let authStorageKey = "sb-qojdeuacwkmlxmodeabt-auth-token"
    static let callbackScheme = "healthfolio"
    static let authCallbackURL = URL(string: "healthfolio://auth/callback")!
    static let passwordRecoveryCallbackURL = URL(string: "healthfolio://auth/callback?flow=recovery")!

    /// Storage sign responses are relative to `/storage/v1`, not the project origin.
    /// Resolving them against the origin requests `/object/sign/...` and the file download 404s.
    static func absoluteSignedStorageURL(signedPath: String, projectURL: URL = url) -> URL? {
        if let absolute = URL(string: signedPath), absolute.scheme?.hasPrefix("http") == true {
            return absolute
        }
        let origin = projectURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var path = signedPath.hasPrefix("/") ? signedPath : "/" + signedPath
        if path.hasPrefix("/object/") {
            path = "/storage/v1" + path
        }
        return URL(string: origin + path)
    }
    static var googleIosClientId: String {
        bundledIdentityValue(for: "HealthFolioGoogleIosClientId") ?? "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com"
    }

    static var googleWebClientId: String {
        bundledIdentityValue(for: "HealthFolioGoogleWebClientId") ?? "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
    }

    /// Kept so existing call sites compile. Values come from release-identity.json via Info.plist.
    static var googleIOSClientId: String { googleIosClientId }

    private static func bundledIdentityValue(for key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed.hasPrefix("$(") || trimmed.contains("YOUR_") { return nil }
        return trimmed
    }
}
