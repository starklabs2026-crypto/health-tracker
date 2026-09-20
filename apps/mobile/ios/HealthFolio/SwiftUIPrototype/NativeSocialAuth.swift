import AuthenticationServices
import CryptoKit
import Foundation
import GoogleSignIn
import Security
import UIKit

struct NativeAppleSignInResult {
    let idToken: String
    let rawNonce: String
    let metadata: [String: String]
}

struct NativeGoogleSignInResult {
    let idToken: String
    let accessToken: String?
    let metadata: [String: String]
}

enum NativeSocialAuth {
    static func handleGoogleURL(_ url: URL) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }

    @MainActor
    static func signInWithApple() async throws -> NativeAppleSignInResult {
        try await NativeAppleSignInCoordinator.shared.signIn()
    }

    @MainActor
    static func signInWithGoogle() async throws -> NativeGoogleSignInResult {
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: NativeSupabaseConfig.googleIOSClientId,
            serverClientID: NativeSupabaseConfig.googleWebClientId
        )

        let presentingController = try rootViewController()
        let signInResult: GIDSignInResult = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<GIDSignInResult, Error>) in
            GIDSignIn.sharedInstance.signIn(
                withPresenting: presentingController,
                hint: nil,
                additionalScopes: ["openid", "email", "profile"]
            ) { result, error in
                if let error {
                    continuation.resume(throwing: NativeSupabaseError.backend(authMessage(from: error, provider: "Google")))
                    return
                }
                guard let result else {
                    continuation.resume(throwing: NativeSupabaseError.backend("Google sign-in was cancelled."))
                    return
                }
                continuation.resume(returning: result)
            }
        }

        guard let idToken = signInResult.user.idToken?.tokenString, !idToken.isEmpty else {
            throw NativeSupabaseError.backend("Google did not return an identity token.")
        }

        var metadata: [String: String] = [:]
        if let name = signInResult.user.profile?.name, !name.isEmpty {
            metadata["full_name"] = name
            metadata["name"] = name
        }
        if let givenName = signInResult.user.profile?.givenName, !givenName.isEmpty {
            metadata["given_name"] = givenName
        }
        if let familyName = signInResult.user.profile?.familyName, !familyName.isEmpty {
            metadata["family_name"] = familyName
        }
        if let email = signInResult.user.profile?.email, !email.isEmpty {
            metadata["email"] = email
        }

        return NativeGoogleSignInResult(
            idToken: idToken,
            accessToken: signInResult.user.accessToken.tokenString,
            metadata: metadata
        )
    }

    @MainActor
    static func signOutGoogle() {
        GIDSignIn.sharedInstance.signOut()
    }

    @MainActor
    private static func rootViewController() throws -> UIViewController {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let activeScene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        let root = activeScene?.windows.first { $0.isKeyWindow }?.rootViewController
            ?? activeScene?.windows.first?.rootViewController
        guard let root else {
            throw NativeSupabaseError.backend("Could not open the sign-in window.")
        }
        return topMostViewController(from: root)
    }

    @MainActor
    private static func topMostViewController(from root: UIViewController) -> UIViewController {
        if let presented = root.presentedViewController {
            return topMostViewController(from: presented)
        }
        if let navigation = root as? UINavigationController, let visible = navigation.visibleViewController {
            return topMostViewController(from: visible)
        }
        if let tab = root as? UITabBarController, let selected = tab.selectedViewController {
            return topMostViewController(from: selected)
        }
        return root
    }

    fileprivate static func randomURLSafeString(byteCount: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        _ = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        return Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    fileprivate static func sha256Hex(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func authMessage(from error: Error, provider: String) -> String {
        let nsError = error as NSError
        if nsError.domain == kGIDSignInErrorDomain, nsError.code == -5 {
            return "\(provider) sign-in was cancelled."
        }
        let message = error.localizedDescription
        return message.isEmpty ? "Could not sign in with \(provider)." : message
    }
}

@MainActor
private final class NativeAppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let shared = NativeAppleSignInCoordinator()

    private var continuation: CheckedContinuation<NativeAppleSignInResult, Error>?
    private var activeController: ASAuthorizationController?
    private var rawNonce: String?

    func signIn() async throws -> NativeAppleSignInResult {
        if continuation != nil {
            throw NativeSupabaseError.backend("Another Apple sign-in attempt is already running.")
        }

        let nonce = NativeSocialAuth.randomURLSafeString(byteCount: 32)
        rawNonce = nonce

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = NativeSocialAuth.sha256Hex(nonce)

        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<NativeAppleSignInResult, Error>) in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            activeController = controller
            controller.performRequests()
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let activeScene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        return activeScene?.windows.first { $0.isKeyWindow } ?? activeScene?.windows.first ?? UIWindow()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let appleCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            finish(throwing: NativeSupabaseError.backend("Apple sign-in could not be verified."))
            return
        }
        guard let tokenData = appleCredential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              !token.isEmpty,
              let rawNonce
        else {
            finish(throwing: NativeSupabaseError.backend("Apple did not return an identity token."))
            return
        }

        var metadata: [String: String] = ["apple_user_id": appleCredential.user]
        let formatter = PersonNameComponentsFormatter()
        if let fullName = appleCredential.fullName {
            let formatted = formatter.string(from: fullName).trimmingCharacters(in: .whitespacesAndNewlines)
            if !formatted.isEmpty {
                metadata["full_name"] = formatted
                metadata["name"] = formatted
            }
            if let givenName = fullName.givenName, !givenName.isEmpty {
                metadata["given_name"] = givenName
            }
            if let familyName = fullName.familyName, !familyName.isEmpty {
                metadata["family_name"] = familyName
            }
        }
        if let email = appleCredential.email, !email.isEmpty {
            metadata["email"] = email
        }

        finish(returning: NativeAppleSignInResult(idToken: token, rawNonce: rawNonce, metadata: metadata))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            finish(throwing: NativeSupabaseError.backend("Apple sign-in was cancelled."))
            return
        }
        finish(throwing: NativeSupabaseError.backend(error.localizedDescription))
    }

    private func finish(returning result: NativeAppleSignInResult) {
        continuation?.resume(returning: result)
        continuation = nil
        activeController = nil
        rawNonce = nil
    }

    private func finish(throwing error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
        activeController = nil
        rawNonce = nil
    }
}
