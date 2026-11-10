import LocalAuthentication
import SwiftUI

@MainActor
final class HealthFolioAppLock: ObservableObject {
    private static let preferenceKey = "healthfolio:app-lock"
    private var authentication: LAContext?

    @Published private(set) var isEnabled: Bool
    @Published private(set) var isLocked: Bool
    @Published private(set) var isAuthenticating = false
    @Published private(set) var message: String?

    init() {
        let enabled = UserDefaults.standard.bool(forKey: Self.preferenceKey)
        isEnabled = enabled
        isLocked = enabled
    }

    func setEnabled(_ enabled: Bool) async {
        guard enabled != isEnabled else { return }
        let reason = enabled ? "Turn on HealthFolio app lock." : "Turn off HealthFolio app lock."
        guard await authenticate(reason: reason) else { return }

        UserDefaults.standard.set(enabled, forKey: Self.preferenceKey)
        isEnabled = enabled
        isLocked = false
    }

    func unlock() async {
        guard isLocked else { return }
        if await authenticate(reason: "Unlock your HealthFolio records.") {
            isLocked = false
        }
    }

    func lock() {
        authentication?.invalidate()
        authentication = nil
        isAuthenticating = false
        message = nil
        isLocked = isEnabled
    }

    private func authenticate(reason: String) async -> Bool {
        guard authentication == nil else { return false }
        message = nil
        let context = LAContext()
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else {
            message = "Set a device passcode in Settings to use app lock."
            return false
        }

        authentication = context
        isAuthenticating = true
        do {
            let authenticated = try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
            guard authentication === context else { return false }
            authentication = nil
            isAuthenticating = false
            return authenticated
        } catch {
            guard authentication === context else { return false }
            authentication = nil
            isAuthenticating = false
            let code = (error as? LAError)?.code
            if code != .userCancel && code != .systemCancel && code != .appCancel {
                message = "Couldn’t verify this device. Try again."
            }
            return false
        }
    }
}
