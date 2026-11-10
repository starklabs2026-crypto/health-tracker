import Foundation

enum AuthCallback {
    static func make(urlScheme: String) -> URL {
        let scheme = urlScheme
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "://", with: "")
            .split(separator: ":")
            .first
            .map(String.init) ?? "healthfolio"
        return URL(string: "\(scheme)://auth/callback")!
    }

    static func isRecovery(_ params: [String: String]) -> Bool {
        let type = (params["type"] ?? params["flow"] ?? "").lowercased()
        return type == "recovery"
    }

    /// PKCE recovery emails often redirect with only `code`. The recovery verifier
    /// is stored separately from OAuth, so a code-only callback is recovery when
    /// that verifier is still present and the link does not name another type.
    static func isRecoveryCallback(_ params: [String: String], hasStoredRecoveryVerifier: Bool) -> Bool {
        if isRecovery(params) { return true }
        let explicitType = (params["type"] ?? params["flow"] ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !explicitType.isEmpty || !hasStoredRecoveryVerifier { return false }
        return !(params["code"] ?? "").isEmpty
    }

    static func isExpiredOrUsedLink(_ params: [String: String]) -> Bool {
        let code = (params["error_code"] ?? "").lowercased()
        if code == "otp_expired" || code == "otp_disabled" { return true }
        let description = [
            params["error_description"],
            params["error"],
            params["message"],
        ]
        .compactMap { $0 }
        .joined(separator: " ")
        .lowercased()
        return description.contains("expired")
            || description.contains("invalid or has expired")
            || (description.contains("invalid") && description.contains("link"))
    }
}

enum PasswordResetCooldown {
    static let seconds = 60

    static func remaining(until availableAt: Date?, now: Date = Date()) -> Int {
        guard let availableAt else { return 0 }
        return max(0, Int(ceil(availableAt.timeIntervalSince(now))))
    }

    static func isRateLimited(statusCode: Int, message: String) -> Bool {
        if statusCode == 429 { return true }
        let lower = message.lowercased()
        return lower.contains("rate limit")
            || lower.contains("too many")
            || lower.contains("only request this after")
            || lower.contains("security purposes")
    }
}

enum NativeSupabaseConfig {
    static let projectRef = "qojdeuacwkmlxmodeabt"
    static let url = URL(string: "https://qojdeuacwkmlxmodeabt.supabase.co")!
    static let functionsURL = URL(string: "https://qojdeuacwkmlxmodeabt.functions.supabase.co")!
    static let publishableKey = "sb_publishable_d-pZ2zQvS-0QA5KR5EdloA_KOw1MUoI"
    static let documentBucket = "medical-documents"
    static let doctorShareBaseURL = URL(string: "https://healthfolio.app")!
    static let authStorageKey = "sb-qojdeuacwkmlxmodeabt-auth-token"
    static let callbackScheme = "healthfolio"

    /// Same URL for sign-up, magic link, OAuth, and password reset. Built from the
    /// release-identity URL scheme so Supabase never falls back to the Site URL.
    static var authCallbackURL: URL {
        AuthCallback.make(urlScheme: bundledIdentityValue(for: "HealthFolioURLScheme") ?? callbackScheme)
    }

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
