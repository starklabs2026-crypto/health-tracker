import AuthenticationServices
import Foundation
import UIKit

struct NativeAppleIdentityToken {
    let idToken: String
    let nonce: String
}

@MainActor
final class NativeAppleSignInPresenter: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let shared = NativeAppleSignInPresenter()

    private var activeContinuation: CheckedContinuation<NativeAppleIdentityToken, Error>?
    private var activeNonce: String?

    func signIn(nonce: String, hashedNonce: String) async throws -> NativeAppleIdentityToken {
        if activeContinuation != nil {
            throw NativeSupabaseError.backend("A sign-in attempt is already in progress.")
        }

        return try await withCheckedThrowingContinuation { continuation in
            activeContinuation = continuation
            activeNonce = nonce

            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = hashedNonce

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let identityToken = credential.identityToken,
            let idToken = String(data: identityToken, encoding: .utf8),
            let nonce = activeNonce
        else {
            finish(throwing: NativeSupabaseError.backend("Apple did not return a usable identity token."))
            return
        }

        finish(returning: NativeAppleIdentityToken(idToken: idToken, nonce: nonce))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            finish(throwing: NativeSupabaseError.backend("Sign-in was cancelled."))
            return
        }
        finish(throwing: NativeSupabaseError.backend("Apple sign-in could not be completed. Please try again."))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.healthFolioPresentationAnchor()
    }

    private func finish(returning token: NativeAppleIdentityToken) {
        let continuation = activeContinuation
        activeContinuation = nil
        activeNonce = nil
        continuation?.resume(returning: token)
    }

    private func finish(throwing error: Error) {
        let continuation = activeContinuation
        activeContinuation = nil
        activeNonce = nil
        continuation?.resume(throwing: error)
    }
}
