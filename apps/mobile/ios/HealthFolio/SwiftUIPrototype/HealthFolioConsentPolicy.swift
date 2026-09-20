import Foundation

enum NativeConsentSource: String {
    case email = "ios_email"
    case apple = "ios_apple"
    case google = "ios_google"
    case existingUser = "ios_existing_user"
}

struct NativeConsentStatus: Decodable, Equatable {
    let consentVersion: String?
    let acceptedAt: Date?

    private enum CodingKeys: String, CodingKey {
        case consentVersion
        case acceptedAt
    }

    init(consentVersion: String?, acceptedAt: Date?) {
        self.consentVersion = consentVersion
        self.acceptedAt = acceptedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        consentVersion = try container.decodeIfPresent(String.self, forKey: .consentVersion)

        guard let rawAcceptedAt = try container.decodeIfPresent(String.self, forKey: .acceptedAt) else {
            acceptedAt = nil
            return
        }

        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let parsed = fractionalFormatter.date(from: rawAcceptedAt)
            ?? ISO8601DateFormatter().date(from: rawAcceptedAt) {
            acceptedAt = parsed
            return
        }

        throw DecodingError.dataCorruptedError(
            forKey: .acceptedAt,
            in: container,
            debugDescription: "Invalid consent acceptance timestamp."
        )
    }

    var isCurrent: Bool {
        consentVersion == HealthFolioConsentPolicy.consentVersion && acceptedAt != nil
    }

    static let missing = NativeConsentStatus(consentVersion: nil, acceptedAt: nil)
}

enum HealthFolioConsentPolicy {
    static let consentVersion = "2026-07-10"
    static let privacyPolicyVersion = "2026-07-10"
    static let privacyURL = URL(string: "https://starklabs2026-crypto.github.io/health-tracker/privacy/")!
    static let privacyChoicesURL = URL(string: "https://starklabs2026-crypto.github.io/health-tracker/privacy-choices/")!
    static let standardEULAURL = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!

    static func requiresBlockingGate(
        isSignedIn: Bool,
        hasCurrentConsent: Bool,
        isPasswordResetRequired: Bool
    ) -> Bool {
        isSignedIn && !hasCurrentConsent && !isPasswordResetRequired
    }
}
