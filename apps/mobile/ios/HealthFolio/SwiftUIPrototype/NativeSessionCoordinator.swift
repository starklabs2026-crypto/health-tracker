import Foundation

/// Serializes refresh-token rotation and prevents old requests from restoring a signed-out account.
actor NativeSessionCoordinator {
    typealias Refresh = @Sendable (NativeSupabaseSession) async throws -> NativeSupabaseSession
    private let read: @Sendable () -> NativeSupabaseSession?
    private let write: @Sendable (NativeSupabaseSession) -> Void
    private let clear: @Sendable () -> Void
    private var generation = UUID()
    private var retiredTokens = Set<String>()
    private var pending: (id: UUID, task: Task<NativeSupabaseSession, Error>)?

    init(
        read: @escaping @Sendable () -> NativeSupabaseSession? = { NativeSupabaseSession.saved() },
        write: @escaping @Sendable (NativeSupabaseSession) -> Void = { $0.save() },
        clear: @escaping @Sendable () -> Void = { NativeSupabaseSession.clearSavedSession() }
    ) {
        self.read = read
        self.write = write
        self.clear = clear
    }

    func beginAuthentication() -> UUID {
        invalidatePending()
        return generation
    }

    func commit(_ session: NativeSupabaseSession, generation expected: UUID) throws {
        guard generation == expected else { throw CancellationError() }
        invalidatePending()
        write(session)
    }

    func signOut() -> NativeSupabaseSession? {
        let previous = read()
        invalidatePending()
        clear()
        return previous
    }

    func isCurrent(_ session: NativeSupabaseSession) -> Bool {
        guard let saved = read() else { return false }
        return saved.accessToken == session.accessToken || retiredTokens.contains(session.accessToken)
    }

    func session(rejected: NativeSupabaseSession? = nil, refresh: @escaping Refresh) async throws -> NativeSupabaseSession {
        try Task.checkCancellation()
        if let rejected, !isCurrent(rejected) { throw CancellationError() }
        guard let saved = read() else { throw NativeSupabaseError.missingSession }
        if saved.isUsable, rejected?.accessToken != saved.accessToken { return saved }
        guard saved.refreshToken?.isEmpty == false else {
            invalidatePending()
            clear()
            throw NativeSupabaseError.missingSession
        }

        let expectedGeneration = generation
        let operation: (id: UUID, task: Task<NativeSupabaseSession, Error>)
        if let pending {
            operation = pending
        } else {
            operation = (UUID(), Task { try await refresh(saved) })
            pending = operation
        }
        do {
            let refreshed = try await operation.task.value
            guard generation == expectedGeneration else { throw CancellationError() }
            if pending?.id == operation.id {
                retiredTokens.insert(saved.accessToken)
                write(refreshed)
                pending = nil
            }
            try Task.checkCancellation()
            return refreshed
        } catch {
            guard generation == expectedGeneration else { throw CancellationError() }
            if pending?.id == operation.id {
                pending = nil
                if case let NativeSupabaseError.http(statusCode, _) = error,
                   [400, 401, 403].contains(statusCode) {
                    invalidatePending()
                    clear()
                    throw NativeSupabaseError.missingSession
                }
            }
            throw error
        }
    }

    private func invalidatePending() {
        generation = UUID()
        pending?.task.cancel()
        pending = nil
        retiredTokens.removeAll()
    }
}
