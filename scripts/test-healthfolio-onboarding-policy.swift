import Foundation

@main
struct HealthFolioOnboardingPolicyTests {
    static func main() {
        var failures: [String] = []

        expect(
            FirstLaunchGuidePolicy.currentSeenKey.contains(".v2."),
            "first-launch guide key should be versioned past build 69/70 v1",
            failures: &failures
        )

        expect(
            FirstLaunchGuidePolicy.shouldShowAfterDashboardLoad(
                isSignedIn: true,
                recordsIsEmpty: true,
                isPasswordResetRequired: false,
                isAlreadyShowing: false,
                hasSeenGuide: true,
                authIntent: .newAccount
            ),
            "new-account auth should show the guide even if an older guide was seen",
            failures: &failures
        )

        expect(
            !FirstLaunchGuidePolicy.shouldShowAfterDashboardLoad(
                isSignedIn: true,
                recordsIsEmpty: true,
                isPasswordResetRequired: false,
                isAlreadyShowing: false,
                hasSeenGuide: true,
                authIntent: .returning
            ),
            "returning sign-in should not force the guide after it was seen",
            failures: &failures
        )

        expect(
            !FirstLaunchGuidePolicy.shouldShowAfterDashboardLoad(
                isSignedIn: true,
                recordsIsEmpty: false,
                isPasswordResetRequired: false,
                isAlreadyShowing: false,
                hasSeenGuide: false,
                authIntent: .newAccount
            ),
            "new-account guide should not cover profiles that already have records",
            failures: &failures
        )

        expect(
            !DashboardRefreshFailurePolicy.shouldResetToSignedOut(
                wasSignedIn: true,
                hadUsableSessionBeforeRefresh: true,
                errorRequiresFreshSignIn: false
            ),
            "signed-in dashboard refresh failures should keep the current screen",
            failures: &failures
        )

        expect(
            DashboardRefreshFailurePolicy.shouldResetToSignedOut(
                wasSignedIn: false,
                hadUsableSessionBeforeRefresh: false,
                errorRequiresFreshSignIn: true
            ),
            "cold start without a session should remain on signed-out auth",
            failures: &failures
        )

        if failures.isEmpty {
            print("HealthFolio onboarding policy tests passed.")
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
