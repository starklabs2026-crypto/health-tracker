import Foundation

enum FirstLaunchAuthIntent {
    case returning
    case newAccount
}

struct FirstLaunchGuidePolicy {
    static let currentSeenKey = "healthfolio.native.firstLaunchGuide.v2.contextual"

    static func shouldShowAfterDashboardLoad(
        isSignedIn: Bool,
        recordsIsEmpty: Bool,
        isPasswordResetRequired: Bool,
        isAlreadyShowing: Bool,
        hasSeenGuide: Bool,
        authIntent: FirstLaunchAuthIntent
    ) -> Bool {
        guard isSignedIn else { return false }
        guard recordsIsEmpty else { return false }
        guard !isPasswordResetRequired else { return false }
        guard !isAlreadyShowing else { return false }
        if authIntent == .newAccount {
            return true
        }
        return !hasSeenGuide
    }
}

struct DashboardRefreshFailurePolicy {
    static func shouldResetToSignedOut(
        wasSignedIn: Bool,
        hadUsableSessionBeforeRefresh: Bool,
        errorRequiresFreshSignIn: Bool
    ) -> Bool {
        guard errorRequiresFreshSignIn else { return false }
        guard !wasSignedIn else { return false }
        return !hadUsableSessionBeforeRefresh
    }
}
