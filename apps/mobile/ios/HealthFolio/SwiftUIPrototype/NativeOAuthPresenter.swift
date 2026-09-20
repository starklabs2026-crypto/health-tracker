import AuthenticationServices
import UIKit

@MainActor
final class NativeOAuthPresenter: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = NativeOAuthPresenter()

    private var activeSession: ASWebAuthenticationSession?

    func authenticate(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callbackURL, error in
                self.activeSession = nil
                if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else if let authError = error as? ASWebAuthenticationSessionError, authError.code == .canceledLogin {
                    continuation.resume(throwing: NativeSupabaseError.backend("Sign-in was cancelled."))
                } else if let error {
                    continuation.resume(throwing: NativeSupabaseError.backend("The sign-in window could not complete. Please try again."))
                } else {
                    continuation.resume(throwing: NativeSupabaseError.backend("Sign in was cancelled."))
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            activeSession = session
            if !session.start() {
                activeSession = nil
                continuation.resume(throwing: NativeSupabaseError.backend("Could not open the sign-in window."))
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.healthFolioPresentationAnchor()
    }
}

extension UIApplication {
    func healthFolioPresentationAnchor() -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
            ?? UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first { !$0.isHidden }
            ?? ASPresentationAnchor()
    }
}
