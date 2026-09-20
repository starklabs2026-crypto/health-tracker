import CryptoKit
import Foundation
import Security

struct NativeDashboardSnapshot {
    let signedInProfile: HealthFolioProfile
    let activeProfile: HealthFolioProfile
    let profiles: [HealthFolioProfile]
    let records: [HealthRecord]
}

struct NativeAuthCallbackResult {
    let isRecovery: Bool
    let snapshot: NativeDashboardSnapshot?
}

struct ManagedProfileMergeResult: Decodable {
    let sourceProfileId: String
    let targetProfileId: String
    let revokedFamilyLinkId: String?
    let preservedDocuments: Int
    let movedDocuments: Int
    let softDeletedDuplicateDocuments: Int
    let movedReadings: Int
    let updatedShares: Int
    let updatedExports: Int
}

actor NativeSupabaseAPI {
    static let shared = NativeSupabaseAPI()
    private let maximumUploadBytes = 25 * 1024 * 1024
    private let passwordRecoveryVerifierKey = "HealthFolioPasswordRecoveryCodeVerifier"
    private let transientHTTPStatusCodes = Set([429, 500, 502, 503, 504])
    private let sessions = NativeSessionCoordinator()

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    nonisolated func hasUsableSession() -> Bool {
        guard let session = NativeSupabaseSession.saved() else { return false }
        return session.isUsable || session.refreshToken?.isEmpty == false
    }

    func signIn(email: String, password: String) async throws -> NativeDashboardSnapshot {
        let generation = await sessions.beginAuthentication()
        let responseData = try await request(
            path: "/auth/v1/token",
            method: "POST",
            queryItems: [URLQueryItem(name: "grant_type", value: "password")],
            body: ["email": email, "password": password]
        )
        let response = try decoder.decode(SignInResponse.self, from: responseData)
        let expiresAt = response.expiresAt ?? Date().timeIntervalSince1970 + TimeInterval(response.expiresIn ?? 3600)
        let session = NativeSupabaseSession(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: expiresAt
        )
        try await sessions.commit(session, generation: generation)
        return try await loadDashboard(activeProfileId: nil)
    }

    func signUp(email: String, password: String) async throws -> NativeDashboardSnapshot? {
        let generation = await sessions.beginAuthentication()
        let responseData = try await request(
            path: "/auth/v1/signup",
            method: "POST",
            body: ["email": email, "password": password]
        )
        guard let response = try? decoder.decode(SignInResponse.self, from: responseData) else {
            return nil
        }
        let expiresAt = response.expiresAt ?? Date().timeIntervalSince1970 + TimeInterval(response.expiresIn ?? 3600)
        let session = NativeSupabaseSession(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: expiresAt
        )
        try await sessions.commit(session, generation: generation)
        return try await loadDashboard(activeProfileId: nil)
    }

    func signInWithOAuth(provider: String) async throws -> NativeDashboardSnapshot {
        if provider == "apple" {
            return try await signInWithApple()
        }
        if provider == "google" {
            return try await signInWithGoogle()
        }

        let generation = await sessions.beginAuthentication()
        let codeVerifier = randomURLSafeString(byteCount: 48)
        let codeChallenge = codeChallenge(for: codeVerifier)
        let callbackURL = try await startOAuth(provider: provider, codeChallenge: codeChallenge)
        let session = try await session(fromCallbackURL: callbackURL, codeVerifier: codeVerifier)
        try await sessions.commit(session, generation: generation)
        return try await loadDashboard(activeProfileId: nil)
    }

    func signInWithApple() async throws -> NativeDashboardSnapshot {
        let generation = await sessions.beginAuthentication()
        let credential = try await NativeSocialAuth.signInWithApple()
        let session = try await sessionFromIdToken(
            provider: "apple",
            idToken: credential.idToken,
            accessToken: nil,
            nonce: credential.rawNonce
        )
        try await sessions.commit(session, generation: generation)
        await updateAuthUserMetadata(credential.metadata, session: session)
        return try await loadDashboard(activeProfileId: nil)
    }

    func signInWithGoogle() async throws -> NativeDashboardSnapshot {
        let generation = await sessions.beginAuthentication()
        let credential = try await NativeSocialAuth.signInWithGoogle()
        let session = try await sessionFromIdToken(
            provider: "google",
            idToken: credential.idToken,
            accessToken: credential.accessToken,
            nonce: nil
        )
        try await sessions.commit(session, generation: generation)
        await updateAuthUserMetadata(credential.metadata, session: session)
        return try await loadDashboard(activeProfileId: nil)
    }

    func requestMagicLink(email: String) async throws {
        _ = try await request(
            path: "/auth/v1/otp",
            method: "POST",
            body: [
                "email": email,
                "create_user": false,
                "email_redirect_to": NativeSupabaseConfig.authCallbackURL.absoluteString
            ]
        )
    }

    func requestPasswordReset(email: String) async throws {
        let codeVerifier = randomURLSafeString(byteCount: 48)
        let codeChallenge = codeChallenge(for: codeVerifier)
        do {
            _ = try await request(
                path: "/auth/v1/recover",
                method: "POST",
                queryItems: [URLQueryItem(name: "redirect_to", value: NativeSupabaseConfig.passwordRecoveryCallbackURL.absoluteString)],
                body: [
                    "email": email,
                    "code_challenge": codeChallenge,
                    "code_challenge_method": "s256"
                ]
            )
            guard savePasswordRecoveryVerifier(codeVerifier) else {
                throw NativeSupabaseError.backend("HealthFolio could not securely save the password reset request.")
            }
        } catch {
            clearPasswordRecoveryVerifier()
            throw error
        }
    }

    func updatePassword(_ password: String) async throws {
        let session = try await authenticatedSession()
        _ = try await request(
            path: "/auth/v1/user",
            method: "PUT",
            session: session,
            body: ["password": password]
        )
    }

    func isPasswordRecoveryCallback(_ url: URL) -> Bool {
        let params = callbackParams(from: url)
        return params["flow"] == "recovery" || params["type"] == "recovery"
    }

    func completeAuthCallback(_ url: URL) async throws -> NativeAuthCallbackResult {
        let generation = await sessions.beginAuthentication()
        let isRecovery = isPasswordRecoveryCallback(url)
        let verifier = isRecovery ? savedPasswordRecoveryVerifier() : nil
        let session = try await session(fromCallbackURL: url, codeVerifier: verifier)
        try await sessions.commit(session, generation: generation)
        if isRecovery {
            clearPasswordRecoveryVerifier()
        }
        let snapshot: NativeDashboardSnapshot?
        if isRecovery {
            snapshot = try? await loadDashboard(activeProfileId: nil)
        } else {
            snapshot = try await loadDashboard(activeProfileId: nil)
        }
        return NativeAuthCallbackResult(isRecovery: isRecovery, snapshot: snapshot)
    }

    func currentConsentStatus(userId: String) async throws -> NativeConsentStatus {
        let session = try await authenticatedSession()
        return try await currentConsentStatus(userId: userId, session: session)
    }

    func recordCurrentConsent(userId: String, source: NativeConsentSource) async throws -> NativeConsentStatus {
        let session = try await authenticatedSession()
        let existing = try await currentConsentStatus(userId: userId, session: session)
        if existing.isCurrent {
            return existing
        }

        let data = try await request(
            path: "/rest/v1/UserConsent",
            method: "POST",
            session: session,
            queryItems: [
                URLQueryItem(name: "select", value: "consentVersion,acceptedAt"),
                URLQueryItem(name: "on_conflict", value: "userId,consentVersion")
            ],
            body: [
                "userId": userId,
                "consentVersion": HealthFolioConsentPolicy.consentVersion,
                "privacyPolicyVersion": HealthFolioConsentPolicy.privacyPolicyVersion,
                "eulaType": "apple_standard",
                "healthDataProcessingAccepted": true,
                "source": source.rawValue
            ],
            prefer: "resolution=ignore-duplicates,return=representation"
        )
        let rows = try decoder.decode([NativeConsentStatus].self, from: data)
        if let inserted = rows.first {
            return inserted
        }
        return try await currentConsentStatus(userId: userId, session: session)
    }

    func signOut() async {
        let session = await sessions.signOut()
        await NativeSocialAuth.signOutGoogle()
        if let session {
            _ = try? await request(
                path: "/auth/v1/logout", method: "POST", session: session,
                queryItems: [URLQueryItem(name: "scope", value: "local")],
                timeoutInterval: 10, allowsSessionRecovery: false
            )
        }
    }

    func deleteAccount() async throws {
        let session = try await authenticatedSession()
        let data = try await request(
            path: "/functions/v1/delete-account",
            method: "POST",
            session: session,
            body: ["confirm": true]
        )
        let response = try decoder.decode(DeleteAccountResponse.self, from: data)
        guard response.ok else {
            throw NativeSupabaseError.backend("Account deletion did not complete.")
        }
    }

    func loadDashboard(activeProfileId: String?) async throws -> NativeDashboardSnapshot {
        let session = try await authenticatedSession()
        let authUser = try await currentAuthUser(session: session)
        let appUser = try await requireAppUser(authUser: authUser, session: session)
        let userWithAlias = await userWithEnsuredAlias(appUser, session: session)
        let managedProfiles = try await listManagedProfiles(appUserId: appUser.id, session: session)
        let signedInProfile = makeProfile(from: userWithAlias, isPrimary: true, status: "active")
        let profiles = ([signedInProfile] + managedProfiles).uniquedById()
        let active = profiles.first(where: { $0.id == activeProfileId }) ?? signedInProfile
        async let documentsRequest = listDocuments(ownerUserId: active.id, session: session)
        async let readingsRequest = listReadings(userId: active.id, session: session)
        async let catalogRequest = listParameterCatalog(session: session)
        let documents = try await documentsRequest
        let readings = try await readingsRequest
        let catalog = (try? await catalogRequest) ?? []
        let referencesById = Dictionary(uniqueKeysWithValues: catalog.map { ($0.id, $0) })
        let rangeContext = ParameterRangeContext(profile: active)
        let documentIds = Set(documents.map(\.id))
        let readingsByDocument = Dictionary(grouping: readings.filter { $0.documentId != nil }) { $0.documentId ?? "" }
        var records = documents.map { document in
            makeRecord(
                document: document,
                readings: readingsByDocument[document.id] ?? [],
                fallbackFileName: fileName(from: document),
                fallbackSource: sourceLabel(for: document),
                fileKey: storagePath(from: document.fileUrl),
                referencesById: referencesById,
                rangeContext: rangeContext
            )
        }
        let unlinkedReadings = readings.filter { reading in
            guard let documentId = reading.documentId, !documentId.isEmpty else { return true }
            return !documentIds.contains(documentId)
        }
        if !unlinkedReadings.isEmpty {
            records.append(makeReadingsRecord(unlinkedReadings, referencesById: referencesById, rangeContext: rangeContext))
        }
        return NativeDashboardSnapshot(
            signedInProfile: signedInProfile,
            activeProfile: active,
            profiles: profiles,
            records: records
        )
    }

    func uploadAndProcess(fileURL: URL, source: String, ownerProfileId: String?) async throws -> HealthRecord {
        let session = try await authenticatedSession()
        let authUser = try await currentAuthUser(session: session)
        let appUser = try await requireAppUser(authUser: authUser, session: session)
        let ownerUserId = ownerProfileId?.isEmpty == false ? ownerProfileId! : appUser.id
        let mime = try validateUploadFile(fileURL)
        let document = try await createDocument(
            ownerUserId: ownerUserId,
            uploaderUserId: appUser.id,
            mimeType: mime,
            kind: inferKind(from: fileURL.lastPathComponent),
            session: session
        )
        return try await uploadExistingDocument(
            document: document,
            fileURL: fileURL,
            source: source,
            session: session,
            authUserId: authUser.id
        )
    }

    func resumeOCRProcessing(documentId: UUID, source: String, fallbackFileName: String) async throws -> HealthRecord {
        let session = try await authenticatedSession()
        var detail = try await getDocument(id: documentId.uuidString.lowercased(), session: session)
        if detail.document.ocrStatus == "failed" {
            try await invokeOCR(documentId: documentId.uuidString.lowercased(), session: session)
            detail = try await getDocument(id: documentId.uuidString.lowercased(), session: session)
        }
        detail = try await awaitOCRCompletion(documentId: documentId.uuidString.lowercased(), session: session)
        if detail.document.ocrStatus == "failed" {
            throw ocrFailure(for: detail.document)
        }
        return makeRecord(
            document: detail.document,
            readings: detail.readings,
            fallbackFileName: fallbackFileName,
            fallbackSource: source,
            fileKey: storagePath(from: detail.document.fileUrl)
        )
    }

    func retryExistingUpload(
        documentId: UUID,
        fileURL: URL,
        source: String
    ) async throws -> HealthRecord {
        let session = try await authenticatedSession()
        let authUser = try await currentAuthUser(session: session)
        let detail = try await getDocument(id: documentId.uuidString.lowercased(), session: session)
        let mime = try validateUploadFile(fileURL)
        return try await uploadExistingDocument(
            document: detail.document,
            fileURL: fileURL,
            source: source,
            session: session,
            authUserId: authUser.id,
            mimeType: mime
        )
    }

    private func uploadExistingDocument(
        document: DocumentRow,
        fileURL: URL,
        source: String,
        session: NativeSupabaseSession,
        authUserId: String,
        mimeType: String? = nil
    ) async throws -> HealthRecord {
        let mime: String
        if let mimeType {
            mime = mimeType
        } else {
            mime = try self.mimeType(for: fileURL)
        }
        let fileKey = storagePath(from: document.fileUrl)
            ?? "\(authUserId)/documents/\(document.id)/report.\(fileExtension(for: mime))"
        do {
            try await uploadFile(fileURL, fileKey: fileKey, mimeType: mime, session: session)
        } catch {
            let message = "Upload did not finish. Choose the original PDF, JPG, or PNG and try again."
            _ = try? await updateDocument(
                document.id,
                body: [
                    "ocrStatus": "failed",
                    "ocrProgress": 0,
                    "ocrStage": "upload_failed",
                    "ocrCompletedAt": isoString(Date()),
                    "ocrError": message
                ],
                session: session
            )
            guard let backendDocumentId = UUID(uuidString: document.id) else {
                throw NativeSupabaseError.backend(message)
            }
            throw NativeSupabaseError.uploadProcessing(documentId: backendDocumentId, message: message)
        }

        do {
            _ = try await updateDocument(
                document.id,
                body: [
                    "fileUrl": fileKey,
                    "ocrStatus": "queued",
                    "ocrProgress": 5,
                    "ocrStage": "queued",
                    "ocrQueuedAt": isoString(Date()),
                    "ocrStartedAt": NSNull(),
                    "ocrCompletedAt": NSNull(),
                    "ocrError": NSNull()
                ],
                session: session
            )
            try await invokeOCR(documentId: document.id, session: session)
        } catch let error as NativeSupabaseError {
            if case .ocrProcessing = error { throw error }
            guard let backendDocumentId = UUID(uuidString: document.id) else { throw error }
            throw NativeSupabaseError.uploadProcessing(
                documentId: backendDocumentId,
                message: "The file was uploaded, but HealthFolio could not start OCR. Tap Retry to try the same document again."
            )
        } catch {
            guard let backendDocumentId = UUID(uuidString: document.id) else { throw error }
            throw NativeSupabaseError.uploadProcessing(
                documentId: backendDocumentId,
                message: "The file was uploaded, but HealthFolio could not start OCR. Tap Retry to try the same document again."
            )
        }

        let detail = try await awaitOCRCompletion(documentId: document.id, session: session)
        if detail.document.ocrStatus == "failed" {
            throw ocrFailure(for: detail.document)
        }
        return makeRecord(
            document: detail.document,
            readings: detail.readings,
            fallbackFileName: fileURL.lastPathComponent,
            fallbackSource: source,
            fileKey: fileKey
        )
    }

    private func ocrFailure(for document: DocumentRow) -> NativeSupabaseError {
        guard let documentId = UUID(uuidString: document.id) else {
            return .backend(document.ocrError ?? "OCR could not read this file.")
        }
        return .ocrProcessing(
            documentId: documentId,
            message: document.ocrError ?? "OCR could not read this file. Tap Retry to run OCR again."
        )
    }

    func signedDownloadURL(fileKey: String, documentId: UUID? = nil, fileName: String? = nil, fileType: String? = nil) async throws -> URL {
        if let directURL = URL(string: fileKey),
           directURL.scheme?.hasPrefix("http") == true,
           storagePath(from: fileKey) == fileKey {
            return directURL
        }
        let session = try await authenticatedSession()
        let authUser = try await currentAuthUser(session: session)
        let candidates = storageCandidatePaths(
            fileKey: fileKey,
            documentId: documentId,
            fileName: fileName,
            fileType: fileType,
            authUserId: authUser.id
        )

        var lastError: Error?
        for candidate in candidates {
            do {
                let url = try await signedStorageURL(fileKey: candidate, session: session)
                // Signed storage URLs are GET resources; some Supabase/CDN paths
                // reject HEAD even though the subsequent preview download works.
                return url
            } catch {
                lastError = error
            }
        }

        if let resolved = try await recoverStorageObjectPath(
            documentId: documentId,
            fileName: fileName,
            fileType: fileType,
            authUserId: authUser.id,
            session: session
        ) {
            let url = try await signedStorageURL(fileKey: resolved, session: session)
            return url
        }

        if let lastError { throw lastError }
        throw NativeSupabaseError.backend("The original file could not be found in secure storage. Re-upload the source file or refresh after storage sync finishes.")
    }

    private func signedStorageURL(fileKey: String, session: NativeSupabaseSession) async throws -> URL {
        let data = try await request(
            path: "/storage/v1/object/sign/\(NativeSupabaseConfig.documentBucket)/\(fileKey)",
            method: "POST",
            session: session,
            body: ["expiresIn": 300]
        )
        let response = try decoder.decode(SignedURLResponse.self, from: data)
        guard let url = URL(string: response.signedURL, relativeTo: NativeSupabaseConfig.url)?.absoluteURL else {
            throw NativeSupabaseError.fileUnavailable
        }
        return url
    }

    private func remoteFileExists(at url: URL) async -> Bool {
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 12
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return false }
            return 200..<400 ~= http.statusCode
        } catch {
            return false
        }
    }

    private func storageCandidatePaths(
        fileKey: String,
        documentId: UUID?,
        fileName: String?,
        fileType: String?,
        authUserId: String
    ) -> [String] {
        var candidates: [String] = []
        func add(_ raw: String?) {
            guard let path = storagePath(from: raw), !path.isEmpty, !path.hasPrefix("http") else { return }
            if !candidates.contains(path) {
                candidates.append(path)
            }
        }

        add(fileKey)
        let normalizedKey = storagePath(from: fileKey) ?? fileKey
        if normalizedKey.hasPrefix("documents/") || normalizedKey.hasPrefix("email/") {
            add("\(authUserId)/\(normalizedKey)")
        }

        guard let documentId else { return candidates }
        let ext = storageFileExtension(fileKey: normalizedKey, fileName: fileName, fileType: fileType)
        var fileNames: [String] = []
        for candidate in [
            fileName,
            URL(fileURLWithPath: normalizedKey).lastPathComponent,
            "report.\(ext)",
            "attachment.\(ext)"
        ] {
            guard let value = candidate?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty,
                  !fileNames.contains(value)
            else { continue }
            fileNames.append(value)
        }

        for name in fileNames {
            add("\(authUserId)/documents/\(documentId.uuidString.lowercased())/\(name)")
            add("\(authUserId)/email/\(documentId.uuidString.lowercased())/\(name)")
        }
        return candidates
    }

    private func recoverStorageObjectPath(
        documentId: UUID?,
        fileName: String?,
        fileType: String?,
        authUserId: String,
        session: NativeSupabaseSession
    ) async throws -> String? {
        guard let documentId else { return nil }
        let ext = storageFileExtension(fileKey: nil, fileName: fileName, fileType: fileType)
        let targetNames = Set([
            fileName,
            "report.\(ext)",
            "attachment.\(ext)"
        ]
        .compactMap { $0?.lowercased() }
        .filter { !$0.isEmpty })

        for prefix in ["\(authUserId)/documents/\(documentId.uuidString.lowercased())", "\(authUserId)/email/\(documentId.uuidString.lowercased())"] {
            let objects = try await listStorageObjects(prefix: prefix, session: session)
            if let exact = objects.first(where: { targetNames.contains($0.name.lowercased()) }) {
                return "\(prefix)/\(exact.name)"
            }
            if let onlyFile = objects.first(where: { $0.looksLikeFile }) {
                return "\(prefix)/\(onlyFile.name)"
            }
        }
        return nil
    }

    private func listStorageObjects(prefix: String, session: NativeSupabaseSession) async throws -> [StorageObjectRow] {
        let data = try await request(
            path: "/storage/v1/object/list/\(NativeSupabaseConfig.documentBucket)",
            method: "POST",
            session: session,
            body: [
                "prefix": prefix,
                "limit": 100,
                "offset": 0,
                "sortBy": [
                    "column": "name",
                    "order": "asc"
                ]
            ]
        )
        return try decoder.decode([StorageObjectRow].self, from: data)
    }

    func exportHealthSummaryURL(profileId: String?) async throws -> URL {
        let session = try await authenticatedSession()
        let data = try await request(
            path: "/functions/v1/export-health-summary",
            method: "POST",
            session: session,
            body: profileId?.isEmpty == false ? ["profileId": profileId!] : [:]
        )
        let response = try decoder.decode(ExportHealthSummaryResponse.self, from: data)
        guard let url = URL(string: response.downloadURL) else {
            throw NativeSupabaseError.backend("Export did not return a download URL.")
        }
        return url
    }

    func loadAssistantConfig() async throws -> AssistantRemoteConfig {
        let session = try await authenticatedSession()
        let data = try await request(
            baseURL: NativeSupabaseConfig.functionsURL,
            path: "/assistant-config",
            method: "POST",
            session: session,
            timeoutInterval: 15,
            retryTransientFailure: true
        )
        return try decoder.decode(AssistantRemoteConfig.self, from: data)
    }

    func requestAssistantResponse(
        profileId: String?,
        question: String,
        history: [AssistantMessage]
    ) async throws -> AssistantRemoteResponse {
        let session = try await authenticatedSession()
        let historyPayload: [[String: Any]] = history.suffix(6).map { message in
            [
                "role": message.role.rawValue,
                "content": message.text
            ]
        }
        var body: [String: Any] = [
            "question": question,
            "history": historyPayload
        ]
        if let profileId, !profileId.isEmpty {
            body["profileId"] = profileId
        }

        let data = try await request(
            baseURL: NativeSupabaseConfig.functionsURL,
            path: "/assistant-response",
            method: "POST",
            session: session,
            body: body,
            timeoutInterval: 60,
            retryTransientFailure: false
        )
        return try decoder.decode(AssistantRemoteResponse.self, from: data)
    }

    func listDoctorShares() async throws -> [DoctorShareRecord] {
        let session = try await authenticatedSession()
        let authUser = try await currentAuthUser(session: session)
        let appUser = try await requireAppUser(authUser: authUser, session: session)
        let data = try await request(
            path: "/rest/v1/DoctorShare",
            method: "GET",
            session: session,
            queryItems: [
                URLQueryItem(name: "select", value: "*"),
                URLQueryItem(name: "ownerUserId", value: "eq.\(appUser.id)"),
                URLQueryItem(name: "order", value: "createdAt.desc")
            ]
        )
        let rows = try decoder.decode([DoctorShareRow].self, from: data)
        return rows.compactMap(mapDoctorShare)
    }

    func createDoctorShare(
        profileUserId: String?,
        dateRangeStart: Date,
        dateRangeEnd: Date,
        expiry: NativeShareExpiry,
        singleUse: Bool,
        customNote: String?
    ) async throws -> DoctorShareRecord {
        let session = try await authenticatedSession()
        let authUser = try await currentAuthUser(session: session)
        let appUser = try await requireAppUser(authUser: authUser, session: session)
        let profileId = profileUserId?.isEmpty == false ? profileUserId! : appUser.id
        let cleanNote = customNote?.trimmingCharacters(in: .whitespacesAndNewlines)
        let data = try await request(
            path: "/rest/v1/DoctorShare",
            method: "POST",
            session: session,
            queryItems: [URLQueryItem(name: "select", value: "*")],
            body: [
                "ownerUserId": appUser.id,
                "profileUserId": profileId,
                "shareToken": randomHexString(byteCount: 32),
                "dateRangeStart": isoString(dateRangeStart),
                "dateRangeEnd": isoString(dateRangeEnd),
                "parameterSet": [],
                "includeDocuments": true,
                "expiresAt": isoString(Date().addingTimeInterval(expiry.duration)),
                "singleUse": singleUse,
                "customNote": cleanNote?.isEmpty == false ? cleanNote! : NSNull()
            ],
            prefer: "return=representation"
        )
        let row = try decodeSingle(DoctorShareRow.self, from: data)
        guard let share = mapDoctorShare(row) else {
            throw NativeSupabaseError.backend("The share link was created, but HealthFolio could not read its dates.")
        }
        return share
    }

    func revokeDoctorShare(id: String) async throws {
        let session = try await authenticatedSession()
        _ = try await request(
            path: "/rest/v1/DoctorShare",
            method: "PATCH",
            session: session,
            queryItems: [URLQueryItem(name: "id", value: "eq.\(id)")],
            body: ["revokedAt": isoString(Date())]
        )
    }

    func updateFamilyRole(linkId: String, role: FamilyProfileRole) async throws {
        let session = try await authenticatedSession()
        _ = try await request(
            path: "/rest/v1/FamilyLink",
            method: "PATCH",
            session: session,
            queryItems: [URLQueryItem(name: "id", value: "eq.\(linkId)")],
            body: ["role": role.rawValue]
        )
    }

    func mergeManagedProfile(sourceProfileId: String, targetProfileId: String?) async throws -> ManagedProfileMergeResult {
        let session = try await authenticatedSession()
        var body: [String: Any] = ["p_source_user_id": sourceProfileId]
        if let targetProfileId, !targetProfileId.isEmpty {
            body["p_target_user_id"] = targetProfileId
        }
        let data = try await request(
            path: "/rest/v1/rpc/merge_managed_profile",
            method: "POST",
            session: session,
            body: body
        )
        return try decoder.decode(ManagedProfileMergeResult.self, from: data)
    }

    func updateProfile(
        _ profile: HealthFolioProfile,
        name: String,
        dateOfBirth: Date?,
        sex: String,
        bloodGroup: String,
        units: String,
        alias: String
    ) async throws -> HealthFolioProfile {
        let session = try await authenticatedSession()
        var body: [String: Any] = [
            "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
            "dob": dateOfBirth.map(isoString) as Any? ?? NSNull(),
            "sex": HealthFolioProfile.backendSex(for: sex) as Any? ?? NSNull(),
            "unitsPreference": units == "US" ? "us" : "metric",
            "bloodGroup": cleanOptionalText(bloodGroup)
        ]

        let cleanAlias = normalizedAlias(alias)
        if !cleanAlias.isEmpty {
            body["inboundEmailAlias"] = cleanAlias
        }

        let data = try await request(
            path: "/rest/v1/User",
            method: "PATCH",
            session: session,
            queryItems: [
                URLQueryItem(name: "id", value: "eq.\(profile.id)"),
                URLQueryItem(name: "select", value: "id,email,phone,name,dob,sex,unitsPreference,bloodGroup,inboundEmailAlias")
            ],
            body: body,
            prefer: "return=representation"
        )
        let updated = try decodeSingle(AppUser.self, from: data)
        return makeProfile(
            from: updated,
            isPrimary: profile.isPrimary,
            status: profile.status,
            familyLinkId: profile.familyLinkId,
            roleRaw: profile.roleRaw
        )
    }

    func reassignDocument(id: UUID, toOwnerUserId ownerUserId: String) async throws -> HealthRecord {
        let session = try await authenticatedSession()
        let documentId = id.uuidString.lowercased()
        let document = try await updateDocument(
            documentId,
            body: ["ownerUserId": ownerUserId],
            session: session
        )
        _ = try await request(
            path: "/rest/v1/ParameterReading",
            method: "PATCH",
            session: session,
            queryItems: [URLQueryItem(name: "documentId", value: "eq.\(documentId)")],
            body: ["userId": ownerUserId]
        )
        let detail = try await getDocument(id: document.id, session: session)
        return makeRecord(
            document: detail.document,
            readings: detail.readings,
            fallbackFileName: fileName(from: detail.document),
            fallbackSource: sourceLabel(for: detail.document),
            fileKey: storagePath(from: detail.document.fileUrl)
        )
    }

    private func authenticatedSession() async throws -> NativeSupabaseSession {
        try await sessions.session { [self] saved in
            try await refreshSession(saved)
        }
    }

    private func refreshSession(_ session: NativeSupabaseSession) async throws -> NativeSupabaseSession {
        guard let refreshToken = session.refreshToken, !refreshToken.isEmpty else {
            throw NativeSupabaseError.missingSession
        }
        let data = try await request(
            path: "/auth/v1/token",
            method: "POST",
            queryItems: [URLQueryItem(name: "grant_type", value: "refresh_token")],
            body: ["refresh_token": refreshToken],
            retryTransientFailure: true
        )
        let response = try decoder.decode(SignInResponse.self, from: data)
        let expiresAt = response.expiresAt ?? Date().timeIntervalSince1970 + TimeInterval(response.expiresIn ?? 3600)
        return NativeSupabaseSession(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken ?? refreshToken,
            expiresAt: expiresAt
        )
    }

    private func startOAuth(provider: String, codeChallenge: String) async throws -> URL {
        var components = URLComponents(url: NativeSupabaseConfig.url, resolvingAgainstBaseURL: false)!
        components.path = "/auth/v1/authorize"
        components.queryItems = [
            URLQueryItem(name: "provider", value: provider),
            URLQueryItem(name: "redirect_to", value: NativeSupabaseConfig.authCallbackURL.absoluteString),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "s256"),
            URLQueryItem(name: "skip_http_redirect", value: "false")
        ]
        guard let url = components.url else {
            throw NativeSupabaseError.backend("Invalid sign-in URL.")
        }
        return try await NativeOAuthPresenter.shared.authenticate(url: url, callbackScheme: NativeSupabaseConfig.callbackScheme)
    }

    private func session(fromCallbackURL url: URL, codeVerifier: String?) async throws -> NativeSupabaseSession {
        let params = callbackParams(from: url)
        if let errorDescription = params["error_description"], !errorDescription.isEmpty {
            throw NativeSupabaseError.backend(errorDescription)
        }
        if let error = params["error"], !error.isEmpty {
            throw NativeSupabaseError.backend(error)
        }
        if let accessToken = params["access_token"], !accessToken.isEmpty {
            let expiresAt: TimeInterval?
            if let raw = params["expires_at"], let value = TimeInterval(raw) {
                expiresAt = value
            } else if let raw = params["expires_in"], let value = TimeInterval(raw) {
                expiresAt = Date().timeIntervalSince1970 + value
            } else {
                expiresAt = nil
            }
            return NativeSupabaseSession(
                accessToken: accessToken,
                refreshToken: params["refresh_token"],
                expiresAt: expiresAt
            )
        }

        if let tokenHash = params["token_hash"], !tokenHash.isEmpty,
           let type = params["type"], !type.isEmpty {
            return try await session(fromTokenHash: tokenHash, type: type)
        }

        guard let code = params["code"], !code.isEmpty else {
            throw NativeSupabaseError.backend("The sign-in callback did not include a session.")
        }
        guard let codeVerifier else {
            throw NativeSupabaseError.backend("This sign-in link needs to be opened from the current HealthFolio sign-in attempt.")
        }
        let data = try await request(
            path: "/auth/v1/token",
            method: "POST",
            queryItems: [URLQueryItem(name: "grant_type", value: "pkce")],
            body: [
                "auth_code": code,
                "code_verifier": codeVerifier
            ]
        )
        let response = try decoder.decode(SignInResponse.self, from: data)
        let expiresAt = response.expiresAt ?? Date().timeIntervalSince1970 + TimeInterval(response.expiresIn ?? 3600)
        return NativeSupabaseSession(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: expiresAt
        )
    }

    private func session(fromTokenHash tokenHash: String, type: String) async throws -> NativeSupabaseSession {
        let data = try await request(
            path: "/auth/v1/verify",
            method: "POST",
            body: [
                "token_hash": tokenHash,
                "type": type
            ]
        )
        let response = try decoder.decode(SignInResponse.self, from: data)
        let expiresAt = response.expiresAt ?? Date().timeIntervalSince1970 + TimeInterval(response.expiresIn ?? 3600)
        return NativeSupabaseSession(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: expiresAt
        )
    }

    private func sessionFromIdToken(provider: String, idToken: String, accessToken: String?, nonce: String?) async throws -> NativeSupabaseSession {
        var body: [String: Any] = [
            "provider": provider,
            "id_token": idToken
        ]
        if let accessToken, !accessToken.isEmpty {
            body["access_token"] = accessToken
        }
        if let nonce, !nonce.isEmpty {
            body["nonce"] = nonce
        }
        let data = try await request(
            path: "/auth/v1/token",
            method: "POST",
            queryItems: [URLQueryItem(name: "grant_type", value: "id_token")],
            body: body
        )
        let response = try decoder.decode(SignInResponse.self, from: data)
        let expiresAt = response.expiresAt ?? Date().timeIntervalSince1970 + TimeInterval(response.expiresIn ?? 3600)
        return NativeSupabaseSession(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: expiresAt
        )
    }

    private func updateAuthUserMetadata(_ metadata: [String: String], session: NativeSupabaseSession) async {
        guard !metadata.isEmpty else { return }
        _ = try? await request(
            path: "/auth/v1/user",
            method: "PUT",
            session: session,
            body: ["data": metadata]
        )
    }

    private func currentAuthUser(session: NativeSupabaseSession) async throws -> AuthUser {
        let data = try await request(path: "/auth/v1/user", method: "GET", session: session)
        return try decoder.decode(AuthUser.self, from: data)
    }

    private func requireAppUser(authUser: AuthUser, session: NativeSupabaseSession) async throws -> AppUser {
        if let user = try await findAppUser(authUser: authUser, session: session) {
            return user
        }

        _ = try await request(
            path: "/rest/v1/rpc/upsert_app_user_profile",
            method: "POST",
            session: session,
            body: [
                "p_name": defaultName(for: authUser),
                "p_dob": "2000-01-01T00:00:00.000Z",
                "p_sex": "other",
                "p_units_preference": "metric",
                "p_blood_group": NSNull(),
                "p_has_blood_group": false
            ]
        )

        if let user = try await findAppUser(authUser: authUser, session: session) {
            return user
        }
        throw NativeSupabaseError.backend("HealthFolio profile could not be created.")
    }

    private func userWithEnsuredAlias(_ user: AppUser, session: NativeSupabaseSession) async -> AppUser {
        guard user.inboundEmailAlias == nil else { return user }
        guard let data = try? await request(path: "/rest/v1/rpc/ensure_inbound_email_alias", method: "POST", session: session, body: [:]),
              let alias = try? decoder.decode(String?.self, from: data)
        else { return user }
        var patched = user
        patched.inboundEmailAlias = alias
        return patched
    }

    private func findAppUser(authUser: AuthUser, session: NativeSupabaseSession) async throws -> AppUser? {
        if let user = try await singleUser(queryItems: [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "authUserId", value: "eq.\(authUser.id)"),
            URLQueryItem(name: "limit", value: "1")
        ], session: session) {
            return user
        }

        if let email = authUser.email, !email.isEmpty {
            return try await singleUser(queryItems: [
                URLQueryItem(name: "select", value: "*"),
                URLQueryItem(name: "email", value: "eq.\(email)"),
                URLQueryItem(name: "limit", value: "1")
            ], session: session)
        }

        return nil
    }

    private func singleUser(queryItems: [URLQueryItem], session: NativeSupabaseSession) async throws -> AppUser? {
        let data = try await request(path: "/rest/v1/User", method: "GET", session: session, queryItems: queryItems)
        let rows = try decoder.decode([AppUser].self, from: data)
        return rows.first
    }

    private func listManagedProfiles(appUserId: String, session: NativeSupabaseSession) async throws -> [HealthFolioProfile] {
        let data = try await request(
            path: "/rest/v1/FamilyLink",
            method: "GET",
            session: session,
            queryItems: [
                URLQueryItem(name: "select", value: "id,ownerUserId,memberUserId,role,status,member:User!FamilyLink_memberUserId_fkey(id,name,email,phone,dob,sex,unitsPreference,bloodGroup,inboundEmailAlias)"),
                URLQueryItem(name: "ownerUserId", value: "eq.\(appUserId)"),
                URLQueryItem(name: "memberUserId", value: "neq.\(appUserId)"),
                URLQueryItem(name: "status", value: "neq.revoked"),
                URLQueryItem(name: "order", value: "invitedAt.desc")
            ]
        )
        let links = try decoder.decode([FamilyMemberLinkRow].self, from: data)
        return links.compactMap { link in
            guard let member = link.member else { return nil }
            return makeProfile(
                from: member,
                isPrimary: false,
                status: link.status,
                familyLinkId: link.id,
                roleRaw: link.role
            )
        }
    }

    private func listDocuments(ownerUserId: String, session: NativeSupabaseSession) async throws -> [DocumentRow] {
        let data = try await request(
            path: "/rest/v1/Document",
            method: "GET",
            session: session,
            queryItems: [
                URLQueryItem(name: "select", value: "*"),
                URLQueryItem(name: "ownerUserId", value: "eq.\(ownerUserId)"),
                URLQueryItem(name: "deletedAt", value: "is.null"),
                URLQueryItem(name: "order", value: "sourceDate.desc,createdAt.desc"),
                URLQueryItem(name: "limit", value: "200")
            ]
        )
        return try decoder.decode([DocumentRow].self, from: data)
    }

    private func listReadings(userId: String, session: NativeSupabaseSession) async throws -> [ParameterReadingRow] {
        let data = try await request(
            path: "/rest/v1/ParameterReading",
            method: "GET",
            session: session,
            queryItems: [
                URLQueryItem(name: "select", value: "*"),
                URLQueryItem(name: "userId", value: "eq.\(userId)"),
                URLQueryItem(name: "order", value: "recordedAt.desc,createdAt.desc"),
                URLQueryItem(name: "limit", value: "500")
            ]
        )
        return try decoder.decode([ParameterReadingRow].self, from: data)
    }

    private func listParameterCatalog(session: NativeSupabaseSession) async throws -> [ParameterCatalogRow] {
        let data = try await request(
            path: "/rest/v1/ParameterCatalog",
            method: "GET",
            session: session,
            queryItems: [
                URLQueryItem(name: "select", value: "id,canonicalName,unit,panel,rangeDefault,criticalLow,criticalHigh"),
                URLQueryItem(name: "limit", value: "200")
            ]
        )
        return try decoder.decode([ParameterCatalogRow].self, from: data)
    }

    private func createDocument(
        ownerUserId: String,
        uploaderUserId: String,
        mimeType: String,
        kind: HealthRecordKind,
        session: NativeSupabaseSession
    ) async throws -> DocumentRow {
        let data = try await request(
            path: "/rest/v1/Document",
            method: "POST",
            session: session,
            queryItems: [URLQueryItem(name: "select", value: "*")],
            body: [
                "ownerUserId": ownerUserId,
                "uploadedByUserId": uploaderUserId,
                "fileType": mimeType,
                "docType": docType(for: kind),
                "sourceDate": isoString(Date()),
                "labName": NSNull(),
                "orderingPhysician": NSNull(),
                "notes": NSNull(),
                "ocrStatus": "pending_upload",
                "ocrProgress": 0,
                "ocrStage": "awaiting_upload"
            ],
            prefer: "return=representation"
        )
        return try decodeSingle(DocumentRow.self, from: data)
    }

    private func updateDocument(_ id: String, body: [String: Any], session: NativeSupabaseSession) async throws -> DocumentRow {
        let data = try await request(
            path: "/rest/v1/Document",
            method: "PATCH",
            session: session,
            queryItems: [
                URLQueryItem(name: "id", value: "eq.\(id)"),
                URLQueryItem(name: "select", value: "*")
            ],
            body: body,
            prefer: "return=representation"
        )
        return try decodeSingle(DocumentRow.self, from: data)
    }

    private func uploadFile(_ fileURL: URL, fileKey: String, mimeType: String, session: NativeSupabaseSession) async throws {
        let didAccess = fileURL.startAccessingSecurityScopedResource()
        defer {
            if didAccess { fileURL.stopAccessingSecurityScopedResource() }
        }

        let bytes: Data
        do {
            bytes = try Data(contentsOf: fileURL)
        } catch {
            throw NativeSupabaseError.fileUnavailable
        }
        guard !bytes.isEmpty else { throw NativeSupabaseError.emptyFile }

        _ = try await request(
            path: "/storage/v1/object/\(NativeSupabaseConfig.documentBucket)/\(fileKey)",
            method: "POST",
            session: session,
            rawBody: bytes,
            contentType: mimeType,
            extraHeaders: ["x-upsert": "true"]
        )
    }

    private func invokeOCR(documentId: String, session: NativeSupabaseSession) async throws {
        let data = try await request(
            baseURL: NativeSupabaseConfig.functionsURL,
            path: "/process-document-ocr",
            method: "POST",
            session: session,
            body: ["documentId": documentId],
            timeoutInterval: 180
        )
        let response = try decoder.decode(OCRInvocationResponse.self, from: data)
        if let failed = response.documents.first(where: { $0.documentId == documentId && $0.status == "failed" }) {
            throw NativeSupabaseError.backend(failed.error ?? "OCR could not read this file.")
        }
    }

    private func awaitOCRCompletion(
        documentId: String,
        session: NativeSupabaseSession,
        timeout: TimeInterval = 150
    ) async throws -> DocumentDetail {
        let terminalStatuses = Set(["ready_for_review", "failed"])
        let deadline = Date().addingTimeInterval(timeout)
        guard let acceptedDocumentId = UUID(uuidString: documentId) else {
            throw NativeSupabaseError.backend("OCR is still processing. Refresh Records to check it again.")
        }

        func fetchAcceptedDocument() async throws -> DocumentDetail {
            do {
                return try await getDocument(id: documentId, session: session)
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                throw NativeSupabaseError.ocrProcessing(
                    documentId: acceptedDocumentId,
                    message: "OCR was accepted, but HealthFolio could not refresh its status. Tap Retry to check the same document again."
                )
            }
        }

        var detail = try await fetchAcceptedDocument()

        while !terminalStatuses.contains(detail.document.ocrStatus ?? ""), Date() < deadline {
            try await Task.sleep(nanoseconds: 2_000_000_000)
            detail = try await fetchAcceptedDocument()
        }
        guard terminalStatuses.contains(detail.document.ocrStatus ?? "") else {
            throw NativeSupabaseError.ocrProcessing(
                documentId: acceptedDocumentId,
                message: "OCR is still processing. The document remains in Records; tap Retry to check it again."
            )
        }
        return detail
    }

    private func getDocument(id: String, session: NativeSupabaseSession) async throws -> DocumentDetail {
        let docData = try await request(
            path: "/rest/v1/Document",
            method: "GET",
            session: session,
            queryItems: [
                URLQueryItem(name: "select", value: "*"),
                URLQueryItem(name: "id", value: "eq.\(id)"),
                URLQueryItem(name: "limit", value: "1")
            ]
        )
        let document = try decodeSingle(DocumentRow.self, from: docData)

        let readingData = try await request(
            path: "/rest/v1/ParameterReading",
            method: "GET",
            session: session,
            queryItems: [
                URLQueryItem(name: "select", value: "*"),
                URLQueryItem(name: "documentId", value: "eq.\(id)"),
                URLQueryItem(name: "order", value: "createdAt.asc")
            ]
        )
        let readings = try decoder.decode([ParameterReadingRow].self, from: readingData)
        return DocumentDetail(document: document, readings: readings)
    }

    private func currentConsentStatus(userId: String, session: NativeSupabaseSession) async throws -> NativeConsentStatus {
        let data = try await request(
            path: "/rest/v1/UserConsent",
            method: "GET",
            session: session,
            queryItems: [
                URLQueryItem(name: "select", value: "consentVersion,acceptedAt"),
                URLQueryItem(name: "userId", value: "eq.\(userId)"),
                URLQueryItem(name: "consentVersion", value: "eq.\(HealthFolioConsentPolicy.consentVersion)"),
                URLQueryItem(name: "order", value: "acceptedAt.desc"),
                URLQueryItem(name: "limit", value: "1")
            ]
        )
        let rows = try decoder.decode([NativeConsentStatus].self, from: data)
        return rows.first ?? .missing
    }

    private func request(
        baseURL: URL = NativeSupabaseConfig.url,
        path: String,
        method: String,
        session: NativeSupabaseSession? = nil,
        queryItems: [URLQueryItem] = [],
        body: [String: Any]? = nil,
        rawBody: Data? = nil,
        contentType: String = "application/json",
        prefer: String? = nil,
        extraHeaders: [String: String] = [:],
        timeoutInterval: TimeInterval? = nil,
        retryTransientFailure: Bool? = nil,
        allowsSessionRecovery: Bool = true
    ) async throws -> Data {
        if let session, allowsSessionRecovery, !(await sessions.isCurrent(session)) {
            throw CancellationError()
        }
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = path
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components.url else { throw NativeSupabaseError.backend("Invalid Supabase URL.") }

        var request = URLRequest(url: url)
        request.timeoutInterval = timeoutInterval ?? (rawBody == nil ? 30 : 120)
        request.httpMethod = method
        request.setValue(NativeSupabaseConfig.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        if let session {
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        }
        if let prefer { request.setValue(prefer, forHTTPHeaderField: "Prefer") }
        for (key, value) in extraHeaders {
            request.setValue(value, forHTTPHeaderField: key)
        }
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } else {
            request.httpBody = rawBody
        }

        let shouldRetryTransientFailure = retryTransientFailure ?? (method == "GET" || method == "HEAD")
        var (data, response) = try await performDataRequest(request, retryTransientFailure: shouldRetryTransientFailure)
        if let session, allowsSessionRecovery,
           (response as? HTTPURLResponse)?.statusCode == 401 {
            let refreshed = try await sessions.session(rejected: session) { [self] saved in
                try await refreshSession(saved)
            }
            request.setValue("Bearer \(refreshed.accessToken)", forHTTPHeaderField: "Authorization")
            // A rejected authentication request was not applied. Replay once with the refreshed token.
            (data, response) = try await performDataRequest(request, retryTransientFailure: shouldRetryTransientFailure)
        }
        guard let http = response as? HTTPURLResponse else {
            throw NativeSupabaseError.backend("Supabase did not return a valid response.")
        }
        guard 200..<300 ~= http.statusCode else {
            throw NativeSupabaseError.http(
                statusCode: http.statusCode,
                message: errorMessage(from: data, statusCode: http.statusCode)
            )
        }
        return data
    }

    private func performDataRequest(
        _ request: URLRequest,
        retryTransientFailure: Bool
    ) async throws -> (Data, URLResponse) {
        let maximumAttempts = retryTransientFailure ? 2 : 1
        var lastError: Error?

        for attempt in 1...maximumAttempts {
            do {
                let result = try await URLSession.shared.data(for: request)
                if attempt < maximumAttempts,
                   let http = result.1 as? HTTPURLResponse,
                   transientHTTPStatusCodes.contains(http.statusCode) {
                    try await Task.sleep(nanoseconds: 350_000_000)
                    continue
                }
                return result
            } catch {
                lastError = error
                guard attempt < maximumAttempts, isTransientNetworkError(error) else {
                    throw error
                }
                try await Task.sleep(nanoseconds: 350_000_000)
            }
        }

        throw lastError ?? NativeSupabaseError.backend("The network request did not complete.")
    }

    private func isTransientNetworkError(_ error: Error) -> Bool {
        guard let urlError = error as? URLError else { return false }
        return [
            .timedOut,
            .cannotFindHost,
            .cannotConnectToHost,
            .networkConnectionLost,
            .dnsLookupFailed,
            .notConnectedToInternet,
            .internationalRoamingOff,
            .dataNotAllowed
        ].contains(urlError.code)
    }

    private func decodeSingle<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        if let row = try? decoder.decode(T.self, from: data) {
            return row
        }
        let rows = try decoder.decode([T].self, from: data)
        guard let first = rows.first else { throw NativeSupabaseError.backend("Supabase returned no rows.") }
        return first
    }

    private func makeRecord(
        document: DocumentRow,
        readings: [ParameterReadingRow],
        fallbackFileName: String,
        fallbackSource: String,
        fileKey: String?,
        referencesById: [String: ParameterCatalogRow] = [:],
        rangeContext: ParameterRangeContext? = nil
    ) -> HealthRecord {
        let recordId = UUID(uuidString: document.id) ?? UUID()
        let metrics = readings.map {
            makeMetric(
                $0,
                recordId: recordId,
                sourceTitle: displayTitle(for: document, fallbackFileName: fallbackFileName),
                reference: referencesById[$0.parameterId],
                rangeContext: rangeContext
            )
        }
        let trust = averageTrust(readings)
        let reviewCount = metrics.filter { $0.status != .normal }.count
        let sourceDate = parseDate(document.sourceDate) ?? parseDate(document.createdAt) ?? Date.now

        return HealthRecord(
            id: recordId,
            ownerProfileId: document.ownerUserId,
            title: recordTitle(for: document, fallbackFileName: fallbackFileName),
            subtitle: subtitle(for: document, fallbackSource: fallbackSource),
            score: score(valueCount: readings.count, trust: trust, reviewCount: reviewCount),
            trust: trust,
            source: fallbackSource,
            category: kind(for: document.docType ?? "other"),
            status: recordStatus(for: document.ocrStatus),
            sourceDate: sourceDate,
            valueCount: readings.count,
            flaggedCount: reviewCount,
            fileName: fallbackFileName,
            fileKey: fileKey,
            fileType: document.fileType,
            createdAt: parseDate(document.createdAt),
            ocrStatusRaw: document.ocrStatus,
            ocrProgress: document.ocrProgress ?? 0,
            ocrStage: document.ocrStage,
            ocrQueuedAt: parseDate(document.ocrQueuedAt),
            ocrStartedAt: parseDate(document.ocrStartedAt),
            ocrCompletedAt: parseDate(document.ocrCompletedAt),
            emailIngestKey: document.emailIngestKey,
            notes: note(for: document, valueCount: readings.count, reviewCount: reviewCount),
            metrics: metrics
        )
    }

    private func makeReadingsRecord(
        _ readings: [ParameterReadingRow],
        referencesById: [String: ParameterCatalogRow] = [:],
        rangeContext: ParameterRangeContext? = nil
    ) -> HealthRecord {
        let recordId = UUID()
        let metrics = readings.map {
            makeMetric(
                $0,
                recordId: recordId,
                sourceTitle: "Imported readings",
                reference: referencesById[$0.parameterId],
                rangeContext: rangeContext
            )
        }
        let trust = averageTrust(readings)
        let reviewCount = metrics.filter { $0.status != .normal }.count
        let sourceDate = readings.compactMap { parseDate($0.recordedAt) }.max() ?? Date.now

        return HealthRecord(
            id: recordId,
            ownerProfileId: readings.first?.userId,
            title: "Imported readings",
            subtitle: "HealthFolio markers - \(sourceDate.formatted(.dateTime.month(.abbreviated).day()))",
            score: score(valueCount: readings.count, trust: trust, reviewCount: reviewCount),
            trust: trust,
            source: "Records",
            category: .other,
            status: .ready,
            sourceDate: sourceDate,
            valueCount: readings.count,
            flaggedCount: reviewCount,
            fileName: "readings",
            fileKey: nil,
            notes: "\(readings.count) reading\(readings.count == 1 ? "" : "s") are stored without a source document link.",
            metrics: metrics
        )
    }

    private func makeMetric(
        _ reading: ParameterReadingRow,
        recordId: UUID?,
        sourceTitle: String?,
        reference: ParameterCatalogRow? = nil,
        rangeContext: ParameterRangeContext? = nil
    ) -> HealthMetric {
        let range = reference?.resolvedRange(context: rangeContext)
        return HealthMetric(
            parameterId: reading.parameterId,
            recordId: recordId,
            sourceTitle: sourceTitle,
            name: reference?.canonicalName ?? displayName(reading.parameterId),
            value: displayValue(value: reading.value, unit: reading.unit),
            numericValue: reading.value,
            unit: reading.unit,
            trend: trend(for: reading.rangeFlag),
            status: metricStatus(for: reading.rangeFlag),
            referenceRangeLabel: referenceRangeLabel(range: range, qualitative: reference?.rangeDefault.qualitativeNormal, unit: reading.unit ?? reference?.unit),
            referenceLow: range?.min,
            referenceHigh: range?.max,
            panel: reference?.panel,
            recordedAt: parseDate(reading.recordedAt) ?? Date.now
        )
    }

    private func makeProfile(
        from user: AppUser,
        isPrimary: Bool,
        status: String,
        familyLinkId: String? = nil,
        roleRaw: String? = nil
    ) -> HealthFolioProfile {
        HealthFolioProfile(
            id: user.id,
            name: user.name?.isEmpty == false ? user.name! : (isPrimary ? "Me" : "Profile"),
            email: user.email ?? "",
            dateOfBirth: parseDate(user.dob),
            sex: displaySex(user.sex),
            bloodGroup: user.bloodGroup ?? "Not set",
            units: user.unitsPreference == "us" ? "US" : "Metric",
            forwardingAlias: user.inboundEmailAlias ?? aliasFromEmail(user.email),
            isPrimary: isPrimary,
            status: status,
            familyLinkId: familyLinkId,
            roleRaw: roleRaw ?? (isPrimary ? FamilyProfileRole.owner.rawValue : FamilyProfileRole.viewer.rawValue)
        )
    }

    private func isoString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    private func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let isoFraction = ISO8601DateFormatter()
        isoFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFraction.date(from: raw) { return date }
        if let date = ISO8601DateFormatter().date(from: raw) { return date }

        let formats = ["yyyy-MM-dd'T'HH:mm:ss.SSS", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd"]
        for format in formats {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = format
            if let date = formatter.date(from: raw) { return date }
        }
        return nil
    }

    private func errorMessage(from data: Data, statusCode: Int) -> String {
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            for key in ["message", "msg", "error", "error_description", "hint"] {
                if let message = object[key] as? String, !message.isEmpty {
                    return cleanedBackendMessage(message, statusCode: statusCode)
                }
            }
        }
        return "Supabase request failed with status \(statusCode)."
    }

    private func cleanedBackendMessage(_ message: String, statusCode: Int) -> String {
        if statusCode == 400, message.localizedCaseInsensitiveContains("invalid login") {
            return "That email or password did not match a HealthFolio account."
        }
        if statusCode == 401 || statusCode == 403 {
            return "Your session could not access this data. Sign in again, then retry."
        }
        if message.localizedCaseInsensitiveContains("row-level security") {
            return "This profile does not have permission for that data."
        }
        return message.replacingOccurrences(of: "null", with: "missing value")
    }

    private func callbackParams(from url: URL) -> [String: String] {
        var items: [String: String] = [:]
        if let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems {
            for item in queryItems {
                items[item.name] = item.value
            }
        }
        if let fragment = url.fragment {
            for pair in fragment.split(separator: "&") {
                let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
                guard parts.count == 2 else { continue }
                items[parts[0].removingPercentEncoding ?? parts[0]] = parts[1].removingPercentEncoding ?? parts[1]
            }
        }
        return items
    }

    private func savedPasswordRecoveryVerifier() -> String? {
        var query = passwordRecoveryVerifierQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let verifier = String(data: data, encoding: .utf8),
              !verifier.isEmpty else { return nil }
        return verifier
    }

    private func savePasswordRecoveryVerifier(_ verifier: String) -> Bool {
        clearPasswordRecoveryVerifier()
        guard let data = verifier.data(using: .utf8) else { return false }
        var query = passwordRecoveryVerifierQuery()
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    private func clearPasswordRecoveryVerifier() {
        SecItemDelete(passwordRecoveryVerifierQuery() as CFDictionary)
    }

    private func passwordRecoveryVerifierQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Bundle.main.bundleIdentifier ?? "com.starklabs.healthfolio",
            kSecAttrAccount as String: passwordRecoveryVerifierKey
        ]
    }

    private func randomURLSafeString(byteCount: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        _ = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        return Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func randomHexString(byteCount: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        _ = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    private func codeChallenge(for verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return Data(digest)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func sha256Hex(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func defaultName(for user: AuthUser) -> String {
        if let name = user.userMetadata?["name"], !name.isEmpty { return name }
        if let name = user.userMetadata?["full_name"], !name.isEmpty { return name }
        if let email = user.email, let prefix = email.split(separator: "@").first { return String(prefix) }
        return "HealthFolio"
    }

    private func averageTrust(_ readings: [ParameterReadingRow]) -> Int {
        guard !readings.isEmpty else { return 0 }
        let values = readings.map { reading in
            let score = reading.confidenceScore ?? 0
            return score <= 1 ? score * 100 : score
        }
        return max(0, min(100, Int((values.reduce(0, +) / Double(values.count)).rounded())))
    }

    private func score(valueCount: Int, trust: Int, reviewCount: Int) -> Int {
        max(38, min(96, 52 + min(18, valueCount) + min(18, trust / 5) - min(16, reviewCount * 3)))
    }

    private func note(for document: DocumentRow, valueCount: Int, reviewCount: Int) -> String {
        if document.ocrStatus == "failed" {
            return document.ocrError ?? "OCR needs another pass. Try the original PDF or a clearer image."
        }
        if valueCount == 0 {
            return "Uploaded to HealthFolio. OCR values will appear after processing."
        }
        return "\(valueCount) value\(valueCount == 1 ? "" : "s") extracted. \(reviewCount) need\(reviewCount == 1 ? "s" : "") review."
    }

    private func subtitle(for document: DocumentRow, fallbackSource: String) -> String {
        var parts = [kind(for: document.docType ?? "other").fullLabel]
        parts.append(shortDate(document.sourceDate ?? document.createdAt))
        if let physician = document.orderingPhysician?.trimmingCharacters(in: .whitespacesAndNewlines),
           !physician.isEmpty {
            parts.append(physician)
        }
        return parts.joined(separator: " · ")
    }

    private func shortDate(_ raw: String?) -> String {
        guard let date = parseDate(raw) else { return "Today" }
        return date.formatted(.dateTime.month(.abbreviated).day().year())
    }

    private func displayName(_ parameterId: String) -> String {
        parameterId
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .capitalized
    }

    private func displayValue(value: Double?, unit: String?) -> String {
        guard let value else { return "Pending" }
        let formatted = value.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", value)
            : String(format: "%.2f", value).replacingOccurrences(of: #"0+$"#, with: "", options: .regularExpression)
        let cleanUnit = unit?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return cleanUnit.isEmpty ? formatted : "\(formatted) \(cleanUnit)"
    }

    private func referenceRangeLabel(range: NumericRange?, qualitative: String?, unit: String?) -> String? {
        if let qualitative, !qualitative.isEmpty {
            return qualitative
        }
        guard let range else { return nil }
        let cleanUnit = unit?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let suffix = cleanUnit.isEmpty ? "" : " \(cleanUnit)"
        switch (range.min, range.max) {
        case (.some(let min), .some(let max)):
            return "\(formatRangeNumber(min))-\(formatRangeNumber(max))\(suffix)"
        case (.some(let min), nil):
            return ">= \(formatRangeNumber(min))\(suffix)"
        case (nil, .some(let max)):
            return "<= \(formatRangeNumber(max))\(suffix)"
        case (nil, nil):
            return nil
        }
    }

    private func formatRangeNumber(_ value: Double) -> String {
        value.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", value)
            : String(format: "%.1f", value)
    }

    private func trend(for rangeFlag: String?) -> String {
        switch rangeFlag {
        case "low": "below range"
        case "high", "critical": "above range"
        case "normal": "in range"
        default: "verify"
        }
    }

    private func metricStatus(for rangeFlag: String?) -> HealthMetric.Status {
        switch rangeFlag {
        case "normal": .normal
        case "low", "high", "critical": .attention
        default: .review
        }
    }

    private func recordStatus(for ocrStatus: String?) -> NativeRecordStatus {
        switch ocrStatus {
        case "failed": .failed
        case "ready_for_review": .ready
        case "queued", "processing", "pending_upload": .inProgress
        default: .ready
        }
    }

    private func title(for docType: String, fileName: String) -> String {
        let kind = kind(for: docType)
        return kind == .other ? fileName : kind.fullLabel
    }

    private func recordTitle(for document: DocumentRow, fallbackFileName: String) -> String {
        if let institution = document.labName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !institution.isEmpty {
            return institution
        }
        return title(for: document.docType ?? "other", fileName: fallbackFileName)
    }

    private func displayTitle(for document: DocumentRow, fallbackFileName: String) -> String {
        if let labName = document.labName, !labName.isEmpty { return labName }
        return title(for: document.docType ?? "other", fileName: fallbackFileName)
    }

    private func sourceLabel(for document: DocumentRow) -> String {
        if document.emailIngestKey?.isEmpty == false { return "Email" }
        let fileType = document.fileType ?? ""
        if fileType == "application/pdf" { return "PDF" }
        if fileType.hasPrefix("image/") { return "Image" }
        return "Files"
    }

    private func fileName(from document: DocumentRow) -> String {
        guard let fileUrl = document.fileUrl, !fileUrl.isEmpty else {
            return "\(kind(for: document.docType ?? "other").fullLabel).pdf"
        }
        if let url = URL(string: fileUrl), let last = url.pathComponents.last, !last.isEmpty {
            return last
        }
        let last = URL(fileURLWithPath: fileUrl).lastPathComponent
        return last.isEmpty ? "report.pdf" : last
    }

    private func storagePath(from fileUrl: String?) -> String? {
        guard var fileUrl = fileUrl?.trimmingCharacters(in: .whitespacesAndNewlines), !fileUrl.isEmpty else { return nil }
        fileUrl = fileUrl.removingPercentEncoding ?? fileUrl

        if fileUrl.hasPrefix("http"), let url = URL(string: fileUrl) {
            let decodedPath = url.path.removingPercentEncoding ?? url.path
            let prefixes = [
                "/storage/v1/object/public/\(NativeSupabaseConfig.documentBucket)/",
                "/storage/v1/object/sign/\(NativeSupabaseConfig.documentBucket)/",
                "/storage/v1/object/authenticated/\(NativeSupabaseConfig.documentBucket)/",
                "/storage/v1/object/\(NativeSupabaseConfig.documentBucket)/"
            ]
            for prefix in prefixes where decodedPath.hasPrefix(prefix) {
                return cleanStoragePath(String(decodedPath.dropFirst(prefix.count)))
            }
            return fileUrl
        }

        if fileUrl.hasPrefix("storage://") {
            fileUrl.removeFirst("storage://".count)
        }
        if fileUrl.hasPrefix("\(NativeSupabaseConfig.documentBucket)/") {
            fileUrl.removeFirst("\(NativeSupabaseConfig.documentBucket)/".count)
        }
        return cleanStoragePath(fileUrl)
    }

    private func cleanStoragePath(_ raw: String) -> String? {
        var value = raw.replacingOccurrences(of: "\\", with: "/")
        while value.hasPrefix("/") {
            value.removeFirst()
        }
        value = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    private func storageFileExtension(fileKey: String?, fileName: String?, fileType: String?) -> String {
        for raw in [fileName, fileKey] {
            guard let raw else { continue }
            let ext = URL(fileURLWithPath: raw).pathExtension.lowercased()
            if !ext.isEmpty { return ext }
        }
        if let fileType {
            return fileExtension(for: fileType.lowercased())
        }
        return "pdf"
    }

    private func kind(for docType: String) -> HealthRecordKind {
        switch docType {
        case "lab_report": .labReport
        case "prescription": .prescription
        case "imaging_report": .imagingReport
        case "discharge_summary": .dischargeSummary
        case "vaccination_record": .vaccinationRecord
        default: .other
        }
    }

    private func docType(for kind: HealthRecordKind) -> String {
        switch kind {
        case .labReport: "lab_report"
        case .prescription: "prescription"
        case .imagingReport: "imaging_report"
        case .dischargeSummary: "discharge_summary"
        case .vaccinationRecord: "vaccination_record"
        default: "other"
        }
    }

    private func inferKind(from fileName: String) -> HealthRecordKind {
        let lower = fileName.lowercased()
        if lower.contains("rx") || lower.contains("prescription") || lower.contains("medicine") { return .prescription }
        if lower.contains("xray") || lower.contains("x-ray") || lower.contains("ct") || lower.contains("mri") || lower.contains("scan") { return .imagingReport }
        if lower.contains("vaccine") || lower.contains("vaccination") { return .vaccinationRecord }
        if lower.contains("surgery") || lower.contains("discharge") { return .dischargeSummary }
        if lower.contains("blood") || lower.contains("lab") || lower.contains("cbc") || lower.contains("hba1c") { return .labReport }
        return .other
    }

    private func validateUploadFile(_ fileURL: URL) throws -> String {
        let mime = try mimeType(for: fileURL)
        let values: URLResourceValues
        do {
            values = try fileURL.resourceValues(forKeys: [.fileSizeKey])
        } catch {
            throw NativeSupabaseError.fileUnavailable
        }
        guard let fileSize = values.fileSize else { throw NativeSupabaseError.fileUnavailable }
        guard fileSize > 0 else { throw NativeSupabaseError.emptyFile }
        guard fileSize <= maximumUploadBytes else { throw NativeSupabaseError.fileTooLarge }
        return mime
    }

    private func mimeType(for fileURL: URL) throws -> String {
        switch fileURL.pathExtension.lowercased() {
        case "pdf": "application/pdf"
        case "png": "image/png"
        case "jpg", "jpeg": "image/jpeg"
        default: throw NativeSupabaseError.unsupportedFileType
        }
    }

    private func fileExtension(for mime: String) -> String {
        switch mime {
        case "application/pdf": "pdf"
        case "image/png": "png"
        default: "jpg"
        }
    }

    private func aliasFromEmail(_ email: String?) -> String {
        email?.split(separator: "@").first.map(String.init) ?? "me"
    }

    private func displaySex(_ sex: String?) -> String {
        switch sex?.lowercased() {
        case "male":
            return "Male"
        case "female":
            return "Female"
        case "other":
            return "Other"
        default:
            return "Not set"
        }
    }

    private func normalizedAlias(_ alias: String) -> String {
        let trimmed = alias.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-"))
        let replacedWhitespace = trimmed.replacingOccurrences(of: #"[\s._]+"#, with: "-", options: .regularExpression)
        let cleaned = String(replacedWhitespace.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" })
            .replacingOccurrences(of: #"-+"#, with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return cleaned
    }

    private func cleanOptionalText(_ value: String) -> Any {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty || trimmed == "Not set" ? NSNull() : trimmed
    }

    private func mapDoctorShare(_ row: DoctorShareRow) -> DoctorShareRecord? {
        guard
            let dateRangeStart = parseDate(row.dateRangeStart),
            let dateRangeEnd = parseDate(row.dateRangeEnd),
            let expiresAt = parseDate(row.expiresAt),
            let createdAt = parseDate(row.createdAt)
        else { return nil }
        return DoctorShareRecord(
            id: row.id,
            ownerUserId: row.ownerUserId,
            profileUserId: row.profileUserId,
            shareToken: row.shareToken,
            dateRangeStart: dateRangeStart,
            dateRangeEnd: dateRangeEnd,
            expiresAt: expiresAt,
            singleUse: row.singleUse,
            revokedAt: parseDate(row.revokedAt),
            customNote: row.customNote,
            createdAt: createdAt
        )
    }
}

private struct SignInResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int?
    let expiresAt: TimeInterval?

    private enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
    }
}

private struct DeleteAccountResponse: Decodable {
    let ok: Bool
}

private struct AuthUser: Decodable {
    let id: String
    let email: String?
    let userMetadata: [String: String]?

    private enum CodingKeys: String, CodingKey {
        case id
        case email
        case userMetadata = "user_metadata"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        userMetadata = try container.decodeIfPresent([String: LossyMetadataValue].self, forKey: .userMetadata)?
            .compactMapValues(\.stringValue)
    }
}

private struct LossyMetadataValue: Decodable {
    let stringValue: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) {
            stringValue = value
        } else if let value = try? container.decode(Int.self) {
            stringValue = String(value)
        } else if let value = try? container.decode(Double.self) {
            stringValue = String(value)
        } else if let value = try? container.decode(Bool.self) {
            stringValue = value ? "true" : "false"
        } else {
            stringValue = nil
        }
    }
}

private struct AppUser: Decodable {
    let id: String
    let email: String?
    let phone: String?
    let name: String?
    let dob: String?
    let sex: String?
    let unitsPreference: String?
    let bloodGroup: String?
    var inboundEmailAlias: String?
}

private struct FamilyMemberLinkRow: Decodable {
    let id: String
    let memberUserId: String
    let role: String
    let status: String
    let member: AppUser?
}

private struct DocumentRow: Decodable {
    let id: String
    let ownerUserId: String?
    let fileUrl: String?
    let fileType: String?
    let docType: String?
    let sourceDate: String?
    let labName: String?
    let orderingPhysician: String?
    let notes: String?
    let ocrStatus: String?
    let ocrError: String?
    let ocrProgress: Int?
    let ocrStage: String?
    let ocrQueuedAt: String?
    let ocrStartedAt: String?
    let ocrCompletedAt: String?
    let createdAt: String?
    let emailIngestKey: String?
}

private struct OCRInvocationResponse: Decodable {
    let documents: [OCRInvocationDocument]
}

private struct OCRInvocationDocument: Decodable {
    let documentId: String
    let status: String
    let error: String?
}

private struct StorageObjectRow: Decodable {
    let name: String
    let id: String?

    var looksLikeFile: Bool {
        id != nil || !URL(fileURLWithPath: name).pathExtension.isEmpty
    }
}

private struct DoctorShareRow: Decodable {
    let id: String
    let ownerUserId: String
    let profileUserId: String
    let shareToken: String
    let dateRangeStart: String
    let dateRangeEnd: String
    let expiresAt: String
    let singleUse: Bool
    let revokedAt: String?
    let customNote: String?
    let createdAt: String
}

private struct ParameterReadingRow: Decodable {
    let id: String?
    let userId: String?
    let documentId: String?
    let parameterId: String
    let value: Double?
    let unit: String?
    let recordedAt: String?
    let confidenceScore: Double?
    let rangeFlag: String?
}

private struct ParameterCatalogRow: Decodable {
    let id: String
    let canonicalName: String
    let unit: String
    let panel: String
    let rangeDefault: ParameterRangeDefinition
    let criticalLow: Double?
    let criticalHigh: Double?

    func resolvedRange(context: ParameterRangeContext?) -> NumericRange? {
        if let age = context?.ageYears,
           let ageRange = rangeDefault.byAge?.first(where: { age >= $0.minAge && age <= $0.maxAge }) {
            return ageRange.range
        }

        if let sex = context?.sex,
           let sexRange = rangeDefault.bySex?[sex] {
            return sexRange
        }

        return rangeDefault.defaultRange
    }
}

private struct ParameterRangeDefinition: Decodable {
    let defaultRange: NumericRange?
    let bySex: [String: NumericRange]?
    let byAge: [AgeRangeDefinition]?
    let qualitativeNormal: String?

    private enum CodingKeys: String, CodingKey {
        case defaultRange = "default"
        case bySex
        case byAge
        case qualitativeNormal
    }
}

private struct NumericRange: Decodable {
    let min: Double?
    let max: Double?
}

private struct AgeRangeDefinition: Decodable {
    let minAge: Double
    let maxAge: Double
    let range: NumericRange
}

private struct ParameterRangeContext {
    let sex: String?
    let ageYears: Double?

    init(profile: HealthFolioProfile, calendar: Calendar = .current, now: Date = Date.now) {
        switch profile.sex.lowercased() {
        case "male", "female":
            sex = profile.sex.lowercased()
        default:
            sex = nil
        }

        if let dateOfBirth = profile.dateOfBirth,
           let years = calendar.dateComponents([.year], from: dateOfBirth, to: now).year {
            ageYears = Double(max(0, years))
        } else {
            ageYears = nil
        }
    }
}

private struct DocumentDetail {
    let document: DocumentRow
    let readings: [ParameterReadingRow]
}

private struct SignedURLResponse: Decodable {
    let signedURL: String

    private enum CodingKeys: String, CodingKey {
        case signedURL = "signedURL"
    }
}

private struct ExportHealthSummaryResponse: Decodable {
    let downloadURL: String
    let expiresAt: String?

    private enum CodingKeys: String, CodingKey {
        case downloadURL = "downloadUrl"
        case expiresAt
    }
}

private extension Array where Element == HealthFolioProfile {
    func uniquedById() -> [HealthFolioProfile] {
        var seen = Set<String>()
        var result: [HealthFolioProfile] = []
        for profile in self where !profile.id.isEmpty && !seen.contains(profile.id) {
            seen.insert(profile.id)
            result.append(profile)
        }
        return result
    }
}
