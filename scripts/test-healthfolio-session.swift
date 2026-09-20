import Foundation

private final class MemorySession: @unchecked Sendable {
    private let lock = NSLock()
    private var value: NativeSupabaseSession?
    init(_ value: NativeSupabaseSession?) { self.value = value }
    func read() -> NativeSupabaseSession? { lock.lock(); defer { lock.unlock() }; return value }
    func write(_ value: NativeSupabaseSession?) { lock.lock(); defer { lock.unlock() }; self.value = value }
    var coordinator: NativeSessionCoordinator {
        NativeSessionCoordinator(read: { self.read() }, write: { self.write($0) }, clear: { self.write(nil) })
    }
}

private actor RefreshProbe {
    private(set) var calls = 0
    private var continuation: CheckedContinuation<NativeSupabaseSession, Error>?
    func run() async throws -> NativeSupabaseSession {
        calls += 1
        return try await withCheckedThrowingContinuation { continuation = $0 }
    }
    func finish(_ session: NativeSupabaseSession) { continuation?.resume(returning: session); continuation = nil }
    func waitUntilStarted() async { while calls == 0 { await Task.yield() } }
}

@main
struct SessionRegressionTests {
    static func main() async throws {
        let now = Date().timeIntervalSince1970
        let expired = NativeSupabaseSession(accessToken: "expired", refreshToken: "refresh", expiresAt: now - 10)
        precondition(!expired.isUsable, "An expired access token must never be sent to Supabase")
        let nearExpiry = NativeSupabaseSession(accessToken: "nearly-expired", refreshToken: "refresh", expiresAt: now + 20)
        precondition(!nearExpiry.isUsable, "Refresh before a request can outlive its token")
        let fresh = NativeSupabaseSession(accessToken: "fresh", refreshToken: "refresh", expiresAt: now + 3600)
        precondition(fresh.isUsable)
        let store = MemorySession(expired)
        let coordinator = store.coordinator
        let probe = RefreshProbe()
        async let first = coordinator.session { _ in try await probe.run() }
        await probe.waitUntilStarted()
        async let second = coordinator.session { _ in try await probe.run() }
        for _ in 0..<20 { await Task.yield() }
        let calls = await probe.calls
        precondition(calls == 1, "Concurrent callers must share one refresh-token exchange")
        await probe.finish(fresh)
        let results = try await [first, second]
        precondition(results.allSatisfy { $0 == fresh })
        precondition(store.read() == fresh)

        let reused = try await coordinator.session(rejected: expired) { _ in
            preconditionFailure("A concurrent 401 must reuse the already-rotated token")
        }
        precondition(reused == fresh)

        let pendingStore = MemorySession(expired)
        let pendingCoordinator = pendingStore.coordinator
        let pendingProbe = RefreshProbe()
        let oldRequest = Task { try await pendingCoordinator.session { _ in try await pendingProbe.run() } }
        await pendingProbe.waitUntilStarted()
        _ = await pendingCoordinator.signOut()
        await pendingProbe.finish(fresh)
        do { _ = try await oldRequest.value; preconditionFailure("Sign-out must invalidate an in-flight refresh") }
        catch is CancellationError {} catch { throw error }
        precondition(pendingStore.read() == nil, "A late refresh must not restore the signed-out account")

        let oldLogin = await pendingCoordinator.beginAuthentication()
        _ = await pendingCoordinator.signOut()
        do { try await pendingCoordinator.commit(fresh, generation: oldLogin); preconditionFailure("Stale login must not commit") }
        catch is CancellationError {} catch { throw error }
        let newLogin = await pendingCoordinator.beginAuthentication()
        try await pendingCoordinator.commit(fresh, generation: newLogin)
        do {
            _ = try await pendingCoordinator.session(rejected: expired) { _ in fresh }
            preconditionFailure("An old account's request must never replay using a new account's token")
        } catch is CancellationError {} catch { throw error }

        let offlineStore = MemorySession(expired)
        do {
            _ = try await offlineStore.coordinator.session { _ in throw URLError(.notConnectedToInternet) }
            preconditionFailure("Expected offline failure")
        } catch is URLError {} catch { throw error }
        precondition(offlineStore.read() == expired, "Offline refresh must preserve the refresh token")

        let revokedStore = MemorySession(expired)
        do {
            _ = try await revokedStore.coordinator.session { _ in throw NativeSupabaseError.http(statusCode: 401, message: "revoked") }
            preconditionFailure("Expected revoked refresh failure")
        } catch NativeSupabaseError.missingSession {} catch { throw error }
        precondition(revokedStore.read() == nil)
        let accountB = NativeSupabaseSession(accessToken: "account-b", refreshToken: "refresh-b", expiresAt: now + 3600)
        let intervalStore = MemorySession(expired)
        let intervalCoordinator = intervalStore.coordinator
        let loginB = await intervalCoordinator.beginAuthentication()
        let intervalProbe = RefreshProbe()
        let oldAccountRefresh = Task { try await intervalCoordinator.session { _ in try await intervalProbe.run() } }
        await intervalProbe.waitUntilStarted()
        try await intervalCoordinator.commit(accountB, generation: loginB)
        await intervalProbe.finish(fresh)
        do { _ = try await oldAccountRefresh.value; preconditionFailure("Login commit must invalidate old-account refresh begun during login") }
        catch is CancellationError {} catch { throw error }
        precondition(intervalStore.read() == accountB)

        let completedStore = MemorySession(expired)
        let completedCoordinator = completedStore.coordinator
        let nextLogin = await completedCoordinator.beginAuthentication()
        _ = try await completedCoordinator.session { _ in fresh }
        try await completedCoordinator.commit(accountB, generation: nextLogin)
        do {
            _ = try await completedCoordinator.session(rejected: expired) { _ in accountB }
            preconditionFailure("Login commit must clear old-account retired-token replay eligibility")
        } catch is CancellationError {} catch { throw error }
        print("PASS: expiry margin, refresh single-flight, 401 reuse, sign-out race, stale login, account isolation, offline preservation, revoked session")
    }
}
