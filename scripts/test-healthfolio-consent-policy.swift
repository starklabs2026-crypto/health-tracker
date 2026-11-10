import Foundation

@main
struct HealthFolioConsentPolicyTests {
    static func main() {
        var failures: [String] = []

        expect(
            HealthFolioConsentPolicy.consentVersion == "2026-11-10.2",
            "consent version changed unexpectedly",
            failures: &failures
        )

        expect(
            HealthFolioConsentPolicy.privacyPolicyVersion == "2026-11-10.2",
            "privacy version changed unexpectedly",
            failures: &failures
        )

        expect(
            NativeConsentSource.apple.rawValue == "ios_apple",
            "Apple source must match SQL",
            failures: &failures
        )

        expect(
            HealthFolioConsentPolicy.requiresBlockingGate(
                isSignedIn: true,
                hasCurrentConsent: false,
                isPasswordResetRequired: false
            ),
            "signed-in users without consent must be blocked",
            failures: &failures
        )

        expect(
            !HealthFolioConsentPolicy.requiresBlockingGate(
                isSignedIn: true,
                hasCurrentConsent: false,
                isPasswordResetRequired: true
            ),
            "password recovery must remain usable",
            failures: &failures
        )

        do {
            let payload = Data(#"{"consentVersion":"2026-11-10.2","acceptedAt":"2026-11-10T10:00:00.123456+00:00"}"#.utf8)
            let status = try JSONDecoder().decode(NativeConsentStatus.self, from: payload)
            expect(
                status.isCurrent,
                "PostgREST fractional-second timestamps must decode as current consent",
                failures: &failures
            )
        } catch {
            failures.append("PostgREST fractional-second timestamp failed to decode: \(error)")
        }

        let previousConsent = NativeConsentStatus(
            consentVersion: "2026-07-10",
            acceptedAt: Date()
        )
        expect(
            !previousConsent.isCurrent,
            "users who only accepted the old policy must see the new disclosure",
            failures: &failures
        )

        if failures.isEmpty {
            print("HealthFolio consent policy tests passed.")
        } else {
            for failure in failures {
                fputs("FAIL: \(failure)\n", stderr)
            }
            exit(1)
        }
    }

    private static func expect(_ condition: Bool, _ message: String, failures: inout [String]) {
        if !condition {
            failures.append(message)
        }
    }
}
