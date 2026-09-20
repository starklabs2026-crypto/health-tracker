import Foundation

enum FirstLaunchGuideStep: Int, CaseIterable, Identifiable {
    case profile
    case records
    case addRecord
    case upload

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .profile: "Start with the right profile"
        case .records: "Open Records"
        case .addRecord: "Tap the plus button"
        case .upload: "Upload medical documents"
        }
    }

    var body: String {
        switch self {
        case .profile:
            "Choose Me or a family member first. Uploads, trends, care tasks, and assistant answers follow the selected profile."
        case .records:
            "Records is where every uploaded or forwarded document is tracked as ready, reading, or needing attention."
        case .addRecord:
            "Tap the plus button to import blood reports, prescriptions, medicine lists, imaging, scans, and doctor notes."
        case .upload:
            "Choose Files or Photos for clear medical PDFs and images. HealthFolio will tell you if a file does not look medical."
        }
    }

    var systemImage: String {
        switch self {
        case .profile: "person.crop.circle.badge.checkmark"
        case .records: "doc.text.magnifyingglass"
        case .addRecord: "plus.circle.fill"
        case .upload: "square.and.arrow.up"
        }
    }

    var primaryTitle: String {
        switch self {
        case .profile: "Next"
        case .records: "Show Records"
        case .addRecord: "Next"
        case .upload: "Start upload"
        }
    }
}

@MainActor
final class HealthFolioAppModel: ObservableObject {
    @Published var records: [HealthRecord]
    @Published var uploads: [NativeUploadItem] = []
    @Published var careItems: [CarePlanItem]
    @Published var assistantMessages: [AssistantMessage]
    @Published private(set) var assistantRemoteConfig: AssistantRemoteConfig?
    @Published var isAssistantThinking = false
    @Published var profile: HealthFolioProfile
    @Published var signedInProfile: HealthFolioProfile?

    private let assistantRemoteUnavailableMessage = "HealthFolio Assistant is temporarily unavailable. Please check your connection and try again."
    @Published var availableProfiles: [HealthFolioProfile] = []
    @Published var activeProfileId: String?
    @Published var isSignedIn = false
    @Published var isLoadingData = false
    @Published var isSwitchingProfile = false
    @Published var isMergingProfile = false
    @Published var isDeletingAccount = false
    @Published var hasBootstrapped = false
    @Published var sessionMessage: String?
    @Published var consentStatus: NativeConsentStatus = .missing
    @Published var isRecordingConsent = false
    @Published var isPasswordResetRequired = false
    @Published var lastUploadError: String?
    @Published var isShowingFirstLaunchGuide = false
    @Published var firstLaunchGuideStep = FirstLaunchGuideStep.profile
    @Published var shouldOpenFirstLaunchUpload = false

    private let supabase = NativeSupabaseAPI.shared
    private let firstLaunchGuideSeenKey = FirstLaunchGuidePolicy.currentSeenKey
    private let accountDeletionPendingKey = "healthfolio:account-deletion:pending:v1"
    private var firstLaunchAuthIntent: FirstLaunchAuthIntent = .returning
    private var pendingConsentSource: NativeConsentSource?
    private var assistantHistoryProfileKey: String?
    private var assistantResponseTask: Task<Void, Never>?
    private var dashboardGeneration = UUID()
    private var dashboardLoadID: UUID?
    private var assistantConfigTask: Task<Void, Never>?
    private var assistantConfigLoadedAt: Date?

    private static func seedAssistantMessages() -> [AssistantMessage] {
        [
            AssistantMessage(
                role: .assistant,
                text: "Ask about records, abnormal markers, prescriptions, imaging, or what changed recently. I will stay grounded in your uploaded documents."
            )
        ]
    }

    init() {
        records = []
        careItems = CarePlanLocalStore.load()
        profile = HealthFolioProfile.signedOut
        assistantMessages = Self.seedAssistantMessages()
        assistantRemoteConfig = nil

        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-healthfolioScreenshotMode") {
            records = HealthFolioPreviewData.records
            careItems = HealthFolioPreviewData.careItems
            profile = HealthFolioPreviewData.profile
            assistantMessages = HealthFolioPreviewData.assistantMessages
            signedInProfile = HealthFolioPreviewData.profile
            availableProfiles = [HealthFolioPreviewData.profile]
            activeProfileId = HealthFolioPreviewData.profile.id
            isSignedIn = true
            hasBootstrapped = true
            consentStatus = NativeConsentStatus(
                consentVersion: HealthFolioConsentPolicy.consentVersion,
                acceptedAt: Date.now
            )
            sessionMessage = nil
            isShowingFirstLaunchGuide = false
        }
        #endif
    }

    var healthScore: Int {
        let total = records.count
        let ready = records.count { $0.status == .ready }
        let flagged = records.reduce(0) { $0 + $1.flaggedCount }
        let avgTrust = records.isEmpty ? 0 : records.reduce(0) { $0 + $1.trust } / records.count
        let base = 50 + min(20, total * 2) + min(20, ready * 3) + min(10, avgTrust / 10)
        return records.isEmpty ? 0 : max(40, min(96, base - min(18, flagged * 3)))
    }

    var allMetrics: [HealthMetric] {
        records.flatMap(\.metrics)
    }

    var latestMetrics: [HealthMetric] {
        var byName: [String: HealthMetric] = [:]
        for metric in allMetrics {
            if let current = byName[metric.parameterId], current.recordedAt >= metric.recordedAt {
                continue
            }
            byName[metric.parameterId] = metric
        }
        return byName.values.sorted { lhs, rhs in
            if lhs.status != rhs.status {
                return statusRank(lhs.status) < statusRank(rhs.status)
            }
            return lhs.name < rhs.name
        }
    }

    var flaggedMetrics: [HealthMetric] {
        latestMetrics.filter { $0.status != .normal }
    }

    var healthScoreReasons: [String] {
        if records.isEmpty {
            return ["No reports have been uploaded for \(activeProfileName) yet."]
        }

        var reasons: [String] = []
        if !flaggedMetrics.isEmpty {
            let names = flaggedMetrics.prefix(3).map(\.name).joined(separator: ", ")
            reasons.append("\(flaggedMetrics.count) marker\(flaggedMetrics.count == 1 ? "" : "s") need review: \(names).")
        }
        if readyCount < records.count {
            reasons.append("\(records.count - readyCount) report\(records.count - readyCount == 1 ? "" : "s") are still reading or failed.")
        }
        let lowTrustCount = records.count { $0.trust > 0 && $0.trust < 70 }
        if lowTrustCount > 0 {
            reasons.append("\(lowTrustCount) report\(lowTrustCount == 1 ? "" : "s") have low OCR confidence.")
        }
        if latestMetrics.count < 6 {
            reasons.append("Marker coverage is thin; upload recent blood work or vitals for a stronger score.")
        }
        if let latest = records.map(\.sourceDate).max(),
           Calendar.current.dateComponents([.day], from: latest, to: Date.now).day ?? 0 > 180 {
            reasons.append("The newest report is over 6 months old.")
        }
        return reasons.isEmpty ? ["Available records look consistent, with enough readable markers for a strong record signal."] : reasons
    }

    var healthScoreGaps: [String] {
        if records.isEmpty {
            return ["Add blood reports, prescriptions, imaging, and other reports to build a complete baseline."]
        }

        var gaps: [String] = []
        if !records.contains(where: { $0.category == .labReport }) {
            gaps.append("No blood report is attached.")
        }
        if !records.contains(where: { $0.category == .prescription }) && medicineReminderCount == 0 {
            gaps.append("No prescription or medicine schedule is recorded.")
        }
        if latestMetrics.count < 10 {
            gaps.append("Only \(latestMetrics.count) unique marker\(latestMetrics.count == 1 ? "" : "s") are available.")
        }
        if flaggedMetrics.isEmpty {
            gaps.append("No active marker flags; keep adding reports to maintain trend history.")
        }
        return gaps
    }

    var chronologicalAge: Int? {
        guard let dateOfBirth = profile.dateOfBirth else { return nil }
        return Calendar.current.dateComponents([.year], from: dateOfBirth, to: Date.now).year
    }

    var reportBasedAge: Int? {
        guard let chronologicalAge, !records.isEmpty else { return nil }
        let flagPenalty = min(8, flaggedMetrics.count * 2)
        let trustPenalty = records.contains { $0.trust > 0 && $0.trust < 70 } ? 2 : 0
        let coverageAdjustment = latestMetrics.count >= 12 ? -2 : (latestMetrics.count < 6 ? 3 : 0)
        let scoreAdjustment: Int
        if healthScore >= 85 {
            scoreAdjustment = -3
        } else if healthScore >= 70 {
            scoreAdjustment = 0
        } else {
            scoreAdjustment = min(8, (70 - healthScore) / 5)
        }
        return max(0, chronologicalAge + flagPenalty + trustPenalty + coverageAdjustment + scoreAdjustment)
    }

    var readyCount: Int {
        records.count { $0.status == .ready }
    }

    var inProgressCount: Int {
        records.count { $0.status == .inProgress }
    }

    var failedCount: Int {
        records.count { $0.status == .failed }
    }

    var sortedCareItems: [CarePlanItem] {
        careItems.sorted { lhs, rhs in
            let lhsDue = lhs.dueAt()
            let rhsDue = rhs.dueAt()
            if lhs.isCompleted != rhs.isCompleted {
                return !lhs.isCompleted
            }
            if lhsDue != rhsDue {
                return lhsDue < rhsDue
            }
            return lhs.createdAt > rhs.createdAt
        }
    }

    var medicineReminderCount: Int {
        careItems.count { $0.kind == .medicine }
    }

    var followUpReminderCount: Int {
        careItems.count { $0.kind != .medicine }
    }

    var dueTodayReminderCount: Int {
        careItems.count { $0.isDueToday() && !$0.isCompleted }
    }

    func careSummaryShareText() -> String {
        let upcoming = sortedCareItems.prefix(8)
        guard !upcoming.isEmpty else {
            return "HealthFolio care summary for \(activeProfileName): no active reminders."
        }

        let lines = upcoming.map { item in
            let due = item.dueAt().formatted(date: .abbreviated, time: .shortened)
            let detail = item.detail.trimmingCharacters(in: .whitespacesAndNewlines)
            let detailCopy = detail.isEmpty ? "" : " - \(detail)"
            return "- \(item.kind.label): \(item.title)\(detailCopy), \(due)"
        }

        return ([
            "HealthFolio care summary for \(activeProfileName)",
            "Medicines: \(medicineReminderCount)",
            "Tests/visits: \(followUpReminderCount)",
            "Due today: \(dueTodayReminderCount)",
            "",
            lines.joined(separator: "\n"),
            "",
            "Verify medicines and timing with the prescription or clinician."
        ]).joined(separator: "\n")
    }

    var emailIngestionRecords: [HealthRecord] {
        records
            .filter { record in
                record.emailIngestKey?.isEmpty == false
                    || record.source.localizedCaseInsensitiveContains("email")
                    || record.notes.localizedCaseInsensitiveContains("forwarded")
            }
            .sorted { lhs, rhs in
                if lhs.sourceDate != rhs.sourceDate {
                    return lhs.sourceDate > rhs.sourceDate
                }
                return (lhs.createdAt ?? .distantPast) > (rhs.createdAt ?? .distantPast)
            }
    }

    var latestEmailIngestionRecord: HealthRecord? {
        emailIngestionRecords.first
    }

    var activeProfileName: String {
        profile.displayName
    }

    var hasCurrentConsent: Bool {
        consentStatus.isCurrent
    }

    var consentGateMode: ConsentNativeView.Mode {
        pendingConsentSource == .existingUser ? .existingAccount : (firstLaunchAuthIntent == .newAccount ? .newAccount : .existingAccount)
    }

    var consentAcceptanceSource: NativeConsentSource {
        pendingConsentSource ?? .existingUser
    }

    func bootstrap() async {
        guard !hasBootstrapped else { return }
        hasBootstrapped = true
        if await resumePendingAccountDeletionIfNeeded() {
            hasBootstrapped = true
            return
        }
        await loadLiveData(showMissingSessionMessage: false)
        hasBootstrapped = true
    }

    func loadLiveData(showMissingSessionMessage: Bool = true) async {
        guard dashboardLoadID == nil, !isSwitchingProfile, !isLoadingData else { return }
        let generation = dashboardGeneration
        let loadID = UUID()
        dashboardLoadID = loadID
        let wasSignedIn = isSignedIn
        let hadUsableSessionBeforeRefresh = supabase.hasUsableSession()
        isLoadingData = true
        defer {
            if dashboardLoadID == loadID {
                dashboardLoadID = nil
                isLoadingData = false
            }
        }
        do {
            let snapshot = try await supabase.loadDashboard(activeProfileId: activeProfileId)
            guard dashboardGeneration == generation else { return }
            try await finishAuthenticatedFlow(snapshot, acceptedConsentSource: nil)
        } catch {
            guard dashboardGeneration == generation, !isCancelledRequest(error) else { return }
            if isAccountDeletionPending, accountDeletionMayHaveCompleted(error) {
                await completeLocalAccountDeletionCleanup()
                return
            }
            let message = showMissingSessionMessage ? friendlySessionMessage(error) : nil
            if DashboardRefreshFailurePolicy.shouldResetToSignedOut(
                wasSignedIn: wasSignedIn,
                hadUsableSessionBeforeRefresh: hadUsableSessionBeforeRefresh,
                errorRequiresFreshSignIn: errorRequiresFreshSignIn(error)
            ) {
                resetSignedOutState(message: message)
            } else if let message {
                sessionMessage = message
            }
        }
    }

    func signIn(email: String, password: String) async {
        let generation = beginDashboardOperation()
        firstLaunchAuthIntent = .returning
        isLoadingData = true
        defer { if dashboardGeneration == generation { isLoadingData = false } }
        do {
            let snapshot = try await supabase.signIn(email: email, password: password)
            guard dashboardGeneration == generation else { return }
            activeProfileId = nil
            try await finishAuthenticatedFlow(snapshot, acceptedConsentSource: nil)
        } catch {
            guard dashboardGeneration == generation else { return }
            resetSignedOutState(message: friendlySessionMessage(error))
        }
    }

    func signUp(email: String, password: String, consentSource: NativeConsentSource) async {
        let generation = beginDashboardOperation()
        firstLaunchAuthIntent = .newAccount
        isLoadingData = true
        defer { if dashboardGeneration == generation { isLoadingData = false } }
        do {
            if let snapshot = try await supabase.signUp(email: email, password: password) {
                guard dashboardGeneration == generation else { return }
                activeProfileId = nil
                try await finishAuthenticatedFlow(snapshot, acceptedConsentSource: consentSource)
            } else {
                guard dashboardGeneration == generation else { return }
                sessionMessage = "Check your email to finish creating your account."
            }
        } catch {
            guard dashboardGeneration == generation else { return }
            resetSignedOutState(message: friendlySessionMessage(error))
        }
    }

    func signInWithOAuth(
        provider: String,
        authIntent: FirstLaunchAuthIntent = .returning,
        consentSource: NativeConsentSource? = nil
    ) async {
        let generation = beginDashboardOperation()
        firstLaunchAuthIntent = authIntent
        isLoadingData = true
        defer { if dashboardGeneration == generation { isLoadingData = false } }
        do {
            let snapshot = try await supabase.signInWithOAuth(provider: provider)
            guard dashboardGeneration == generation else { return }
            activeProfileId = nil
            try await finishAuthenticatedFlow(snapshot, acceptedConsentSource: consentSource)
        } catch {
            guard dashboardGeneration == generation else { return }
            resetSignedOutState(message: friendlySessionMessage(error))
        }
    }

    func signInWithApple(
        authIntent: FirstLaunchAuthIntent = .returning,
        consentSource: NativeConsentSource? = nil
    ) async {
        let generation = beginDashboardOperation()
        firstLaunchAuthIntent = authIntent
        isLoadingData = true
        defer { if dashboardGeneration == generation { isLoadingData = false } }
        do {
            let snapshot = try await supabase.signInWithApple()
            guard dashboardGeneration == generation else { return }
            activeProfileId = nil
            try await finishAuthenticatedFlow(snapshot, acceptedConsentSource: consentSource)
        } catch {
            guard dashboardGeneration == generation else { return }
            resetSignedOutState(message: friendlySessionMessage(error))
        }
    }

    func sendSignInLink(email: String) async {
        isLoadingData = true
        defer { isLoadingData = false }
        do {
            try await supabase.requestMagicLink(email: email)
            sessionMessage = "Check your email for the HealthFolio sign-in link."
        } catch {
            sessionMessage = friendlySessionMessage(error)
        }
    }

    func requestPasswordReset(email: String) async {
        guard isValidEmail(email) else {
            sessionMessage = "Enter the HealthFolio account email first, then tap Forgot password."
            return
        }

        isLoadingData = true
        defer { isLoadingData = false }
        do {
            try await supabase.requestPasswordReset(email: email)
            sessionMessage = "Check your email for the HealthFolio password reset link."
        } catch {
            sessionMessage = friendlySessionMessage(error)
        }
    }

    func handleAuthCallback(_ url: URL) async {
        let generation = beginDashboardOperation()
        isLoadingData = true
        defer { if dashboardGeneration == generation { isLoadingData = false } }
        do {
            let callback = try await supabase.completeAuthCallback(url)
            guard dashboardGeneration == generation else { return }
            activeProfileId = nil
            isPasswordResetRequired = callback.isRecovery
            if let snapshot = callback.snapshot {
                try await finishAuthenticatedFlow(snapshot, acceptedConsentSource: nil)
            }
            if callback.isRecovery {
                sessionMessage = "Set a new password to finish account recovery."
            }
        } catch {
            guard dashboardGeneration == generation else { return }
            sessionMessage = friendlySessionMessage(error)
        }
    }

    func completePasswordReset(password: String) async -> Bool {
        let generation = dashboardGeneration
        isLoadingData = true
        defer { if dashboardGeneration == generation { isLoadingData = false } }
        do {
            try await supabase.updatePassword(password)
            guard dashboardGeneration == generation else { return false }
            isPasswordResetRequired = false
            sessionMessage = "Password updated."
            isLoadingData = false
            await loadLiveData(showMissingSessionMessage: false)
            return true
        } catch {
            guard dashboardGeneration == generation else { return false }
            sessionMessage = friendlySessionMessage(error)
            return false
        }
    }

    func signOut() async {
        AssistantChatLocalStore.clearAll()
        resetSignedOutState(message: "Signed out.")
        hasBootstrapped = true
        await supabase.signOut()
    }

    func deleteAccount() async -> Bool {
        guard isSignedIn else {
            sessionMessage = "Sign in before deleting your account."
            return false
        }
        guard !isDeletingAccount else { return false }

        isDeletingAccount = true
        defer { isDeletingAccount = false }
        UserDefaults.standard.set(true, forKey: accountDeletionPendingKey)

        do {
            try await supabase.deleteAccount()
            await completeLocalAccountDeletionCleanup()
            return true
        } catch {
            if isAccountDeletionPending, accountDeletionMayHaveCompleted(error) {
                await completeLocalAccountDeletionCleanup()
                return true
            }
            sessionMessage = friendlySessionMessage(error)
            return false
        }
    }

    func cancelAccountDeletionRetry() {
        guard !isDeletingAccount else { return }
        UserDefaults.standard.removeObject(forKey: accountDeletionPendingKey)
    }

    func prepareForNewAccountOnboarding() {
        firstLaunchAuthIntent = .newAccount
    }

    func prepareForReturningAuth() {
        firstLaunchAuthIntent = .returning
    }

    func clearSessionMessage() {
        sessionMessage = nil
    }

    func refreshConsentStatus() async {
        guard let userId = signedInProfile?.id else {
            consentStatus = .missing
            pendingConsentSource = nil
            return
        }

        do {
            consentStatus = try await supabase.currentConsentStatus(userId: userId)
            pendingConsentSource = consentStatus.isCurrent ? nil : .existingUser
            if consentStatus.isCurrent {
                sessionMessage = nil
            }
        } catch {
            consentStatus = .missing
            pendingConsentSource = .existingUser
            sessionMessage = consentRefreshRetryMessage()
        }
    }

    func acceptCurrentConsent(source: NativeConsentSource) async {
        guard let userId = signedInProfile?.id else {
            sessionMessage = "Sign in again before accepting the HealthFolio consent."
            return
        }

        isRecordingConsent = true
        defer { isRecordingConsent = false }

        do {
            let recordedConsent = try await supabase.recordCurrentConsent(userId: userId, source: source)
            guard recordedConsent.isCurrent else {
                consentStatus = .missing
                pendingConsentSource = source
                sessionMessage = consentRecordingRetryMessage()
                return
            }

            consentStatus = recordedConsent
            pendingConsentSource = nil
            sessionMessage = nil
            scheduleFirstLaunchGuideIfNeeded()
        } catch {
            consentStatus = .missing
            pendingConsentSource = source
            sessionMessage = consentRecordingRetryMessage()
        }
    }

    func advanceFirstLaunchGuide() {
        guard let currentIndex = FirstLaunchGuideStep.allCases.firstIndex(of: firstLaunchGuideStep) else {
            finishFirstLaunchGuide()
            return
        }

        let nextIndex = FirstLaunchGuideStep.allCases.index(after: currentIndex)
        if nextIndex < FirstLaunchGuideStep.allCases.endIndex {
            firstLaunchGuideStep = FirstLaunchGuideStep.allCases[nextIndex]
        } else {
            finishFirstLaunchGuide(openUpload: true)
        }
    }

    func finishFirstLaunchGuide(openUpload: Bool = false) {
        UserDefaults.standard.set(true, forKey: firstLaunchGuideSeenKey)
        firstLaunchAuthIntent = .returning
        isShowingFirstLaunchGuide = false
        if openUpload {
            shouldOpenFirstLaunchUpload = true
        }
    }

    func requestFirstLaunchUploadSheet() {
        shouldOpenFirstLaunchUpload = true
    }

    func consumeFirstLaunchUploadRequest() {
        shouldOpenFirstLaunchUpload = false
    }

    @discardableResult
    private func beginDashboardOperation() -> UUID {
        dashboardGeneration = UUID()
        dashboardLoadID = nil
        isLoadingData = false
        return dashboardGeneration
    }

    private func isCancelledRequest(_ error: Error) -> Bool {
        error is CancellationError || (error as? URLError)?.code == .cancelled
    }

    private func resetSignedOutState(message: String?) {
        _ = beginDashboardOperation()
        isLoadingData = false
        isSwitchingProfile = false
        assistantConfigTask?.cancel()
        assistantConfigTask = nil
        assistantConfigLoadedAt = nil
        assistantResponseTask?.cancel()
        assistantResponseTask = nil
        assistantHistoryProfileKey = nil
        assistantMessages = Self.seedAssistantMessages()
        isAssistantThinking = false
        isSignedIn = false
        activeProfileId = nil
        signedInProfile = nil
        availableProfiles = []
        consentStatus = .missing
        isRecordingConsent = false
        pendingConsentSource = nil
        assistantRemoteConfig = nil
        isPasswordResetRequired = false
        isShowingFirstLaunchGuide = false
        shouldOpenFirstLaunchUpload = false
        firstLaunchAuthIntent = .returning
        records = []
        uploads = []
        profile = HealthFolioProfile.signedOut
        sessionMessage = message
    }

    func exportHealthSummaryURL() async throws -> URL {
        try await supabase.exportHealthSummaryURL(profileId: activeProfileId)
    }

    func listDoctorShares() async throws -> [DoctorShareRecord] {
        try await supabase.listDoctorShares()
    }

    func createDoctorShare(
        dateRangeStart: Date,
        dateRangeEnd: Date,
        expiry: NativeShareExpiry,
        singleUse: Bool,
        customNote: String?
    ) async throws -> DoctorShareRecord {
        try await supabase.createDoctorShare(
            profileUserId: activeProfileId ?? profile.id,
            dateRangeStart: dateRangeStart,
            dateRangeEnd: dateRangeEnd,
            expiry: expiry,
            singleUse: singleUse,
            customNote: customNote
        )
    }

    func revokeDoctorShare(id: String) async throws {
        try await supabase.revokeDoctorShare(id: id)
    }

    func selectProfile(_ selected: HealthFolioProfile) async {
        guard selected.id != profile.id || selected.isPrimary != profile.isPrimary else { return }
        guard !isSwitchingProfile else { return }
        let generation = beginDashboardOperation()

        let previousProfile = profile
        let previousRecords = records
        let previousActiveProfileId = activeProfileId
        let previousAssistantHistoryProfileKey = assistantHistoryProfileKey
        let previousAssistantMessages = assistantMessages
        assistantResponseTask?.cancel()
        assistantResponseTask = nil
        isAssistantThinking = false
        activateAssistantHistory(for: selected.id)
        isSwitchingProfile = true
        activeProfileId = selected.isPrimary ? nil : selected.id
        profile = selected
        records = []
        sessionMessage = nil

        do {
            let snapshot = try await supabase.loadDashboard(activeProfileId: activeProfileId)
            guard dashboardGeneration == generation else { return }
            try await finishAuthenticatedFlow(snapshot, acceptedConsentSource: nil)
        } catch {
            guard dashboardGeneration == generation else { return }
            profile = previousProfile
            records = previousRecords
            activeProfileId = previousActiveProfileId
            assistantHistoryProfileKey = previousAssistantHistoryProfileKey
            assistantMessages = previousAssistantMessages
            sessionMessage = friendlySessionMessage(error)
        }
        if dashboardGeneration == generation { isSwitchingProfile = false }
    }

    func updateFamilyRole(_ selected: HealthFolioProfile, role: FamilyProfileRole) async {
        guard let linkId = selected.familyLinkId, !selected.isPrimary else {
            sessionMessage = "Only managed profile roles can be edited."
            return
        }

        do {
            try await supabase.updateFamilyRole(linkId: linkId, role: role)
            if let index = availableProfiles.firstIndex(where: { $0.id == selected.id }) {
                availableProfiles[index].roleRaw = role.rawValue
            }
            if profile.id == selected.id {
                profile.roleRaw = role.rawValue
            }
            sessionMessage = "\(selected.displayName) is now \(role.label)."
            await loadLiveData()
        } catch {
            sessionMessage = friendlySessionMessage(error)
        }
    }

    func mergeProfile(_ source: HealthFolioProfile, into target: HealthFolioProfile) async -> Bool {
        guard isSignedIn else {
            sessionMessage = "Sign in before resolving profile duplicates."
            return false
        }
        guard !source.isPrimary, source.id != target.id else {
            sessionMessage = "Choose a managed profile to merge."
            return false
        }
        guard !isMergingProfile else { return false }

        isMergingProfile = true
        defer { isMergingProfile = false }

        do {
            let result = try await supabase.mergeManagedProfile(
                sourceProfileId: source.id,
                targetProfileId: target.id
            )
            activeProfileId = target.isPrimary ? nil : target.id
            sessionMessage = [
                "Merged \(source.displayName) into \(target.displayName).",
                "\(result.preservedDocuments) document\(result.preservedDocuments == 1 ? "" : "s") kept",
                "\(result.movedReadings) reading\(result.movedReadings == 1 ? "" : "s") linked",
                result.softDeletedDuplicateDocuments > 0 ? "\(result.softDeletedDuplicateDocuments) duplicate document\(result.softDeletedDuplicateDocuments == 1 ? "" : "s") hidden" : nil
            ]
            .compactMap { $0 }
            .joined(separator: " ")
            await loadLiveData()
            return true
        } catch {
            sessionMessage = friendlySessionMessage(error)
            return false
        }
    }

    func reassignRecord(_ record: HealthRecord, to targetProfile: HealthFolioProfile) async -> Bool {
        await reassignDocument(id: record.id, title: record.title, to: targetProfile, uploadId: nil)
    }

    func reassignUpload(_ item: NativeUploadItem, to targetProfile: HealthFolioProfile) async -> Bool {
        guard let documentId = item.documentId else {
            lastUploadError = "This upload does not have a document yet."
            return false
        }
        return await reassignDocument(id: documentId, title: item.name, to: targetProfile, uploadId: item.id)
    }

    func retryUpload(_ item: NativeUploadItem) {
        guard item.status == .failed else { return }
        guard item.fileURL != nil || item.documentId != nil else {
            lastUploadError = "Choose the original PDF or image again before retrying."
            return
        }

        let targetName = item.ownerProfileName ?? profileName(for: item.ownerProfileId)
        updateUpload(item.id, status: .queued, progress: 0.08, message: "Queued for \(targetName)")
        markDocumentUploading(item.localRecordId, message: "Retry queued for \(targetName). HealthFolio will extract markers from the original file.")

        Task {
            await processUpload(item.id)
        }
    }

    func removeUpload(_ item: NativeUploadItem) {
        guard item.status == .failed || item.status == .analyzed else {
            lastUploadError = "Uploads can be removed after they finish or fail."
            return
        }

        uploads.removeAll { $0.id == item.id }
        if item.status == .failed {
            records.removeAll { $0.id == item.localRecordId }
        }
        cleanupStagedFile(item.fileURL)
    }

    func profileName(for profileId: String?) -> String {
        guard let profileId, !profileId.isEmpty else { return activeProfileName }
        return availableProfiles.first(where: { $0.id == profileId })?.displayName ?? activeProfileName
    }

    func filteredRecords(
        searchText: String,
        category: HealthRecordKind,
        status: NativeRecordStatus
    ) -> [HealthRecord] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return records.filter { record in
            let categoryMatches = category == .all || record.category == category
            let statusMatches = status == .all || record.status == status
            let searchMatches = trimmed.isEmpty || searchableText(for: record).localizedStandardContains(trimmed)
            return categoryMatches && statusMatches && searchMatches
        }
    }

    func metrics(for parameterId: String) -> [HealthMetric] {
        allMetrics
            .filter { $0.parameterId == parameterId }
            .sorted { $0.recordedAt > $1.recordedAt }
    }

    func importFileURLs(_ urls: [URL], source: String) {
        lastUploadError = nil
        guard isSignedIn else {
            lastUploadError = "Sign in from Profile first, then upload your reports."
            return
        }

        let targetProfile = profile
        let targetProfileId = activeProfileId ?? profile.id

        for url in urls {
            let name = url.lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { continue }

            let uploadId = UUID()
            do {
                let stagedURL = try stageImportedFile(url, uploadId: uploadId)
                enqueueUpload(
                    id: uploadId,
                    name: name,
                    source: source,
                    fileURL: stagedURL,
                    targetProfile: targetProfile,
                    targetProfileId: targetProfileId
                )
            } catch {
                enqueueFailedUpload(
                    id: uploadId,
                    name: name,
                    source: source,
                    targetProfile: targetProfile,
                    targetProfileId: targetProfileId,
                    message: friendlyUploadMessage(error)
                )
            }
        }
    }

    func importPhotoImages(_ images: [(name: String, data: Data)]) {
        lastUploadError = nil
        guard isSignedIn else {
            lastUploadError = "Sign in from Profile first, then upload your reports."
            return
        }
        guard !images.isEmpty else {
            lastUploadError = "No readable photos were selected."
            return
        }

        let targetProfile = profile
        let targetProfileId = activeProfileId ?? profile.id

        for image in images {
            let uploadId = UUID()
            do {
                let stagedURL = try stageImportedData(image.data, name: image.name, uploadId: uploadId)
                enqueueUpload(
                    id: uploadId,
                    name: image.name,
                    source: "Photos",
                    fileURL: stagedURL,
                    targetProfile: targetProfile,
                    targetProfileId: targetProfileId
                )
            } catch {
                enqueueFailedUpload(
                    id: uploadId,
                    name: image.name,
                    source: "Photos",
                    targetProfile: targetProfile,
                    targetProfileId: targetProfileId,
                    message: friendlyUploadMessage(error)
                )
            }
        }
    }

    private func enqueueUpload(
        id uploadId: UUID,
        name: String,
        source: String,
        fileURL: URL,
        targetProfile: HealthFolioProfile,
        targetProfileId: String
    ) {
        let category = inferRecordKind(from: name)
        let placeholderId = uploadId
        let upload = NativeUploadItem(
            id: uploadId,
            name: name,
            source: source,
            fileURL: fileURL,
            ownerProfileId: targetProfileId,
            ownerProfileName: targetProfile.displayName,
            message: "Queued for \(targetProfile.displayName)"
        )
        uploads.insert(upload, at: 0)

        let record = HealthRecord(
            id: placeholderId,
            ownerProfileId: targetProfileId,
            title: title(for: category, fileName: name),
            subtitle: "\(category.fullLabel) - uploading",
            score: 44,
            trust: 0,
            source: source,
            category: category,
            status: .inProgress,
            sourceDate: Date.now,
            valueCount: 0,
            flaggedCount: 0,
            fileName: name,
            notes: "Upload queued for \(targetProfile.displayName). HealthFolio will extract markers from the original file.",
            metrics: []
        )
        records.insert(record, at: 0)

        Task {
            await processUpload(upload.id)
        }
    }

    private func enqueueFailedUpload(
        id uploadId: UUID,
        name: String,
        source: String,
        targetProfile: HealthFolioProfile,
        targetProfileId: String,
        message: String
    ) {
        lastUploadError = message
        let upload = NativeUploadItem(
            id: uploadId,
            name: name,
            source: source,
            progress: 1,
            status: .failed,
            ownerProfileId: targetProfileId,
            ownerProfileName: targetProfile.displayName,
            message: message
        )
        uploads.insert(upload, at: 0)
    }

    private func stageImportedFile(_ url: URL, uploadId: UUID) throws -> URL {
        let didAccess = url.startAccessingSecurityScopedResource()
        defer {
            if didAccess { url.stopAccessingSecurityScopedResource() }
        }

        let directory = try uploadStagingDirectory()
        let destination = directory.appendingPathComponent("\(uploadId.uuidString)-\(cleanedUploadFileName(url.lastPathComponent))")
        try? FileManager.default.removeItem(at: destination)
        do {
            try FileManager.default.copyItem(at: url, to: destination)
        } catch {
            throw NativeSupabaseError.fileUnavailable
        }
        return destination
    }

    private func stageImportedData(_ data: Data, name: String, uploadId: UUID) throws -> URL {
        guard !data.isEmpty else { throw NativeSupabaseError.emptyFile }
        let directory = try uploadStagingDirectory()
        let destination = directory.appendingPathComponent("\(uploadId.uuidString)-\(cleanedUploadFileName(name))")
        try? FileManager.default.removeItem(at: destination)
        do {
            try data.write(to: destination, options: .atomic)
        } catch {
            throw NativeSupabaseError.fileUnavailable
        }
        return destination
    }

    private func uploadStagingDirectory() throws -> URL {
        let base = try FileManager.default.url(
            for: .cachesDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = base.appendingPathComponent("HealthFolioUploads", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func cleanedUploadFileName(_ name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = trimmed.isEmpty ? "report.pdf" : trimmed
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._- "))
        return String(fallback.unicodeScalars.map { allowed.contains($0) ? Character($0) : "-" })
    }

    func linkableCareRecords(for kind: CarePlanKind) -> [HealthRecord] {
        records
            .filter { $0.status == .ready }
            .sorted { lhs, rhs in
                if kind == .medicine, lhs.category != rhs.category {
                    return lhs.category == .prescription
                }
                if lhs.sourceDate != rhs.sourceDate {
                    return lhs.sourceDate > rhs.sourceDate
                }
                return lhs.title < rhs.title
            }
    }

    func record(with id: UUID?) -> HealthRecord? {
        guard let id else { return nil }
        return records.first { $0.id == id }
    }

    func addCareReminder(
        kind: CarePlanKind,
        title: String,
        detail: String,
        date: Date,
        time: Date,
        sourceNote: String,
        linkedRecord: HealthRecord?
    ) async -> CareReminderScheduleResult {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { return .missingTitle }

        let item = CarePlanItem(
            kind: kind,
            title: trimmedTitle,
            detail: detail.trimmingCharacters(in: .whitespacesAndNewlines),
            date: date,
            time: time,
            sourceNote: sourceNote.trimmingCharacters(in: .whitespacesAndNewlines),
            linkedRecordId: linkedRecord?.id,
            linkedRecordTitle: linkedRecord?.title
        )

        careItems.insert(item, at: 0)
        persistCareItems()
        return await CareReminderScheduler.shared.schedule(item)
    }

    func toggleCareReminderCompletion(id: UUID) async -> CareReminderScheduleResult? {
        guard let index = careItems.firstIndex(where: { $0.id == id }) else { return nil }

        careItems[index].completedAt = careItems[index].completedAt == nil ? Date.now : nil
        let updatedItem = careItems[index]
        persistCareItems()

        if updatedItem.isCompleted {
            await CareReminderScheduler.shared.cancel(id: id)
            return .completedNoNotification
        }

        return await CareReminderScheduler.shared.schedule(updatedItem)
    }

    func removeCareReminder(id: UUID) async {
        careItems.removeAll { $0.id == id }
        persistCareItems()
        await CareReminderScheduler.shared.cancel(id: id)
    }

    private func persistCareItems() {
        CarePlanLocalStore.save(careItems)
    }

    private func cancelPendingCareNotifications() async {
        let reminderIDs = careItems.map(\.id)
        for reminderID in reminderIDs {
            await CareReminderScheduler.shared.cancel(id: reminderID)
        }
    }

    private var isAccountDeletionPending: Bool {
        UserDefaults.standard.bool(forKey: accountDeletionPendingKey)
    }

    private func resumePendingAccountDeletionIfNeeded() async -> Bool {
        guard isAccountDeletionPending else { return false }
        do {
            try await supabase.deleteAccount()
        } catch {
            guard accountDeletionMayHaveCompleted(error) else {
                sessionMessage = friendlySessionMessage(error)
                return false
            }
        }
        await completeLocalAccountDeletionCleanup()
        return true
    }

    private func accountDeletionMayHaveCompleted(_ error: Error) -> Bool {
        (error as? NativeSupabaseError)?.indicatesCompletedAccountDeletion == true
    }

    private func completeLocalAccountDeletionCleanup() async {
        await cancelPendingCareNotifications()
        uploads.forEach { cleanupStagedFile($0.fileURL) }
        CarePlanLocalStore.clear()
        careItems = []
        AssistantChatLocalStore.clearAll()
        await supabase.signOut()
        UserDefaults.standard.removeObject(forKey: accountDeletionPendingKey)
        resetSignedOutState(message: "Your account and HealthFolio data were deleted.")
        hasBootstrapped = true
    }

    private func persistAssistantMessages() {
        guard let assistantHistoryProfileKey else { return }
        AssistantChatLocalStore.save(assistantMessages, profileKey: assistantHistoryProfileKey)
    }

    func askHealthFolio(_ question: String) {
        let trimmed = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isAssistantThinking else { return }
        let maxCharacters = assistantRemoteConfig?.maxQuestionCharacters ?? 2_000
        let boundedQuestion = String(trimmed.prefix(maxCharacters))
        let previousMessages = Array(assistantMessages.suffix(6))
        assistantMessages.append(AssistantMessage(role: .user, text: boundedQuestion))
        persistAssistantMessages()
        isAssistantThinking = true
        let questionProfileKey = assistantHistoryProfileKey
        let targetProfileId = activeProfileId ?? profile.id

        assistantResponseTask = Task { [weak self] in
            guard let self,
                  !Task.isCancelled,
                  self.assistantHistoryProfileKey == questionProfileKey else { return }

            let result: (text: String, sourceRecordIds: [UUID])
            if self.assistantRemoteConfig?.enabled == false {
                result = (self.assistantRemoteUnavailableMessage, [])
            } else {
                do {
                    let remote = try await self.supabase.requestAssistantResponse(
                        profileId: targetProfileId,
                        question: boundedQuestion,
                        history: previousMessages
                    )
                    let sourceRecordIds: [UUID] = remote.sourceRecordIds.compactMap { (sourceId: String) -> UUID? in
                        UUID(uuidString: sourceId)
                    }
                    result = (remote.answer, sourceRecordIds)
                } catch is CancellationError {
                    return
                } catch {
                    result = (self.assistantRemoteUnavailableMessage, [])
                }
            }

            guard !Task.isCancelled, self.assistantHistoryProfileKey == questionProfileKey else { return }
            self.assistantMessages.append(
                AssistantMessage(role: .assistant, text: result.text, sourceRecordIds: result.sourceRecordIds)
            )
            self.persistAssistantMessages()
            self.isAssistantThinking = false
            self.assistantResponseTask = nil
        }
    }

    func clearAssistantHistory() {
        assistantResponseTask?.cancel()
        assistantResponseTask = nil
        isAssistantThinking = false
        if let assistantHistoryProfileKey {
            AssistantChatLocalStore.clear(profileKey: assistantHistoryProfileKey)
        }
        assistantMessages = Self.seedAssistantMessages()
        persistAssistantMessages()
    }

    private func activateAssistantHistory(for profileKey: String) {
        guard assistantHistoryProfileKey != profileKey else { return }
        assistantHistoryProfileKey = profileKey
        let savedMessages = AssistantChatLocalStore.load(profileKey: profileKey)
        assistantMessages = savedMessages.isEmpty ? Self.seedAssistantMessages() : savedMessages
    }

    func sourceRecords(for message: AssistantMessage) -> [HealthRecord] {
        message.sourceRecordIds.compactMap { sourceId in
            records.first { $0.id == sourceId }
        }
    }

    func updateProfile(name: String, dateOfBirth: Date?, sex: String, bloodGroup: String, units: String, alias: String) async -> Bool {
        let generation = beginDashboardOperation()
        let cleanAlias = alias
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacing(" ", with: "-")
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)

        guard isSignedIn else {
            profile.name = cleanName.isEmpty ? profile.name : cleanName
            profile.dateOfBirth = dateOfBirth
            profile.sex = sex
            profile.bloodGroup = bloodGroup
            profile.units = units
            profile.forwardingAlias = cleanAlias.isEmpty ? profile.forwardingAlias : cleanAlias
            sessionMessage = "Saved on this device. Sign in to sync profile corrections."
            return true
        }

        do {
            let updated = try await supabase.updateProfile(
                profile,
                name: cleanName.isEmpty ? profile.name : cleanName,
                dateOfBirth: dateOfBirth,
                sex: sex,
                bloodGroup: bloodGroup,
                units: units,
                alias: cleanAlias.isEmpty ? profile.forwardingAlias : cleanAlias
            )
            guard dashboardGeneration == generation, isSignedIn else { return false }
            let savedGeneration = beginDashboardOperation()
            if let index = availableProfiles.firstIndex(where: { $0.id == updated.id }) {
                availableProfiles[index] = updated
            }
            if profile.id == updated.id {
                profile = updated
            }
            if signedInProfile?.id == updated.id {
                signedInProfile = updated
            }
            sessionMessage = "Profile corrections saved."
            Task { [weak self] in
                guard let self, self.dashboardGeneration == savedGeneration else { return }
                await self.loadLiveData(showMissingSessionMessage: false)
            }
            return true
        } catch {
            guard dashboardGeneration == generation else { return false }
            sessionMessage = friendlySessionMessage(error)
            return false
        }
    }

    private func apply(_ snapshot: NativeDashboardSnapshot) {
        isSignedIn = true
        signedInProfile = snapshot.signedInProfile
        profile = snapshot.activeProfile
        availableProfiles = snapshot.profiles
        records = snapshot.records
        activeProfileId = snapshot.activeProfile.isPrimary ? nil : snapshot.activeProfile.id
        activateAssistantHistory(for: snapshot.activeProfile.id)
        scheduleFirstLaunchGuideIfNeeded()
        refreshAssistantRemoteConfig()
    }

    private func refreshAssistantRemoteConfig() {
        guard assistantConfigTask == nil else { return }
        if let assistantConfigLoadedAt, Date().timeIntervalSince(assistantConfigLoadedAt) < 300 { return }
        let accountID = signedInProfile?.id
        assistantConfigTask = Task { [weak self] in
            guard let self else { return }
            defer { if !Task.isCancelled { self.assistantConfigTask = nil } }
            guard let config = try? await self.supabase.loadAssistantConfig() else { return }
            guard !Task.isCancelled, self.isSignedIn, self.signedInProfile?.id == accountID else { return }
            self.assistantRemoteConfig = config
            self.assistantConfigLoadedAt = Date()
        }
    }

    private func finishAuthenticatedFlow(
        _ snapshot: NativeDashboardSnapshot,
        acceptedConsentSource: NativeConsentSource?
    ) async throws {
        let generation = dashboardGeneration
        let previousConsent = consentStatus
        let sameAccount = signedInProfile?.id == snapshot.signedInProfile.id
        do {
            if let acceptedConsentSource {
                let recordedConsent = try await supabase.recordCurrentConsent(
                    userId: snapshot.signedInProfile.id,
                    source: acceptedConsentSource
                )
                guard dashboardGeneration == generation else { return }
                guard recordedConsent.isCurrent else {
                    apply(snapshot)
                    consentStatus = .missing
                    pendingConsentSource = acceptedConsentSource
                    sessionMessage = consentRecordingRetryMessage()
                    return
                }
                consentStatus = recordedConsent
                pendingConsentSource = nil
                sessionMessage = nil
            } else {
                let refreshedConsent = try await supabase.currentConsentStatus(
                    userId: snapshot.signedInProfile.id
                )
                guard dashboardGeneration == generation else { return }
                consentStatus = refreshedConsent
                pendingConsentSource = consentStatus.isCurrent ? nil : .existingUser
                if consentStatus.isCurrent {
                    sessionMessage = nil
                }
            }
            apply(snapshot)
        } catch {
            guard dashboardGeneration == generation, !isCancelledRequest(error) else { return }
            if errorRequiresFreshSignIn(error) { throw error }
            apply(snapshot)
            if acceptedConsentSource == nil, sameAccount, previousConsent.isCurrent,
               error is URLError {
                consentStatus = previousConsent
                sessionMessage = friendlySessionMessage(error)
                return
            }
            consentStatus = .missing
            pendingConsentSource = acceptedConsentSource ?? .existingUser
            sessionMessage = acceptedConsentSource == nil ? consentRefreshRetryMessage() : consentRecordingRetryMessage()
        }
    }

    private func scheduleFirstLaunchGuideIfNeeded() {
        guard hasCurrentConsent else { return }
        guard FirstLaunchGuidePolicy.shouldShowAfterDashboardLoad(
            isSignedIn: isSignedIn,
            recordsIsEmpty: records.isEmpty,
            isPasswordResetRequired: isPasswordResetRequired,
            isAlreadyShowing: isShowingFirstLaunchGuide,
            hasSeenGuide: UserDefaults.standard.bool(forKey: firstLaunchGuideSeenKey),
            authIntent: firstLaunchAuthIntent
        ) else { return }

        firstLaunchGuideStep = .profile
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 650_000_000)
            guard FirstLaunchGuidePolicy.shouldShowAfterDashboardLoad(
                isSignedIn: self.isSignedIn,
                recordsIsEmpty: self.records.isEmpty,
                isPasswordResetRequired: self.isPasswordResetRequired,
                isAlreadyShowing: self.isShowingFirstLaunchGuide,
                hasSeenGuide: UserDefaults.standard.bool(forKey: self.firstLaunchGuideSeenKey),
                authIntent: self.firstLaunchAuthIntent
            ) else { return }
            self.isShowingFirstLaunchGuide = true
        }
    }

    private func errorRequiresFreshSignIn(_ error: Error) -> Bool {
        guard case NativeSupabaseError.missingSession = error else {
            return false
        }
        return true
    }

    private func processUpload(_ uploadId: UUID) async {
        guard isSignedIn, let accountID = signedInProfile?.id,
              let upload = uploads.first(where: { $0.id == uploadId }) else { return }
        func isCurrentUpload() -> Bool {
            isSignedIn && signedInProfile?.id == accountID && uploads.contains(where: { $0.id == uploadId })
        }
        guard upload.fileURL != nil || upload.documentId != nil else {
            failUpload(uploadId, localRecordId: upload.localRecordId, message: "Choose a PDF or image to run OCR.")
            return
        }

        let targetProfileId = upload.ownerProfileId ?? activeProfileId ?? profile.id
        let targetProfileName = upload.ownerProfileName ?? profileName(for: targetProfileId)
        updateUpload(uploadId, status: .uploading, progress: 0.28, message: "Uploading to \(targetProfileName)")
        do {
            updateUpload(uploadId, status: .processing, progress: 0.62, message: "Reading with OCR")
            let record: HealthRecord
            if upload.fileURL == nil, let documentId = upload.documentId {
                record = try await supabase.resumeOCRProcessing(
                    documentId: documentId,
                    source: upload.source,
                    fallbackFileName: upload.name
                )
            } else if let fileURL = upload.fileURL, let documentId = upload.documentId {
                record = try await supabase.retryExistingUpload(
                    documentId: documentId,
                    fileURL: fileURL,
                    source: upload.source
                )
            } else if let fileURL = upload.fileURL {
                record = try await supabase.uploadAndProcess(
                    fileURL: fileURL,
                    source: upload.source,
                    ownerProfileId: targetProfileId
                )
            } else {
                throw NativeSupabaseError.fileUnavailable
            }
            guard isCurrentUpload() else { return }
            if profile.id == targetProfileId {
                replaceDocument(localRecordId: upload.localRecordId, with: record)
            }
            updateUpload(uploadId, status: .analyzed, progress: 1, message: "Ready in Records", documentId: record.id)
            cleanupStagedFile(upload.fileURL)
            clearUploadFileURL(uploadId)
            await loadLiveData()
        } catch let NativeSupabaseError.uploadProcessing(documentId, message) {
            guard isCurrentUpload() else { return }
            updateUpload(uploadId, status: .failed, progress: 1, message: message, documentId: documentId)
            markDocumentFailed(documentId, message: message)
            lastUploadError = message
            await loadLiveData()
        } catch let NativeSupabaseError.ocrProcessing(documentId, message) {
            guard isCurrentUpload() else { return }
            cleanupStagedFile(upload.fileURL)
            updateUpload(uploadId, status: .failed, progress: 1, message: message, documentId: documentId)
            clearUploadFileURL(uploadId)
            lastUploadError = message
            await loadLiveData()
        } catch {
            guard isCurrentUpload() else { return }
            failUpload(uploadId, localRecordId: upload.localRecordId, message: friendlyUploadMessage(error))
        }
    }

    private func reassignDocument(
        id documentId: UUID,
        title: String,
        to targetProfile: HealthFolioProfile,
        uploadId: UUID?
    ) async -> Bool {
        guard isSignedIn else {
            sessionMessage = "Sign in before moving records between profiles."
            return false
        }
        guard !targetProfile.id.isEmpty else {
            sessionMessage = "Choose a valid profile."
            return false
        }

        do {
            let reassigned = try await supabase.reassignDocument(id: documentId, toOwnerUserId: targetProfile.id)
            if targetProfile.id == profile.id {
                replaceDocument(localRecordId: documentId, with: reassigned)
            } else {
                records.removeAll { $0.id == documentId }
            }

            if let uploadId, let index = uploads.firstIndex(where: { $0.id == uploadId }) {
                uploads[index].message = "Moved to \(targetProfile.displayName)"
                uploads[index].ownerProfileId = targetProfile.id
                uploads[index].ownerProfileName = targetProfile.displayName
            }

            sessionMessage = "Moved \(title) to \(targetProfile.displayName)."
            await loadLiveData()
            return true
        } catch {
            let message = friendlySessionMessage(error)
            sessionMessage = message
            lastUploadError = message
            return false
        }
    }

    private func failUpload(_ uploadId: UUID, localRecordId: UUID?, message: String) {
        lastUploadError = message
        updateUpload(uploadId, status: .failed, progress: 1, message: message)
        if let localRecordId {
            markDocumentFailed(localRecordId, message: message)
        }
    }

    private func updateUpload(
        _ uploadId: UUID,
        status: NativeUploadItem.Status,
        progress: Double,
        message: String,
        documentId: UUID? = nil
    ) {
        guard let index = uploads.firstIndex(where: { $0.id == uploadId }) else { return }
        uploads[index].status = status
        uploads[index].progress = progress
        uploads[index].message = message
        if let documentId {
            let previousRecordId = uploads[index].localRecordId
            if previousRecordId != documentId {
                records.removeAll { $0.id == previousRecordId }
            }
            uploads[index].documentId = documentId
        }
    }

    private func replaceDocument(localRecordId: UUID?, with record: HealthRecord) {
        if localRecordId != record.id {
            records.removeAll { $0.id == record.id }
        }
        if let localRecordId, let index = records.firstIndex(where: { $0.id == localRecordId }) {
            records[index] = record
        } else {
            records.insert(record, at: 0)
        }
    }

    private func markDocumentFailed(_ documentId: UUID, message: String) {
        guard let index = records.firstIndex(where: { $0.id == documentId }) else { return }
        let record = records[index]
        records[index] = HealthRecord(
            id: record.id,
            ownerProfileId: record.ownerProfileId,
            title: record.title,
            subtitle: record.subtitle.replacingOccurrences(of: "uploading", with: "needs attention"),
            score: record.score,
            trust: record.trust,
            source: record.source,
            category: record.category,
            status: .failed,
            sourceDate: record.sourceDate,
            valueCount: record.valueCount,
            flaggedCount: record.flaggedCount,
            fileName: record.fileName,
            fileKey: record.fileKey,
            fileType: record.fileType,
            createdAt: record.createdAt,
            ocrStatusRaw: record.ocrStatusRaw,
            ocrProgress: record.ocrProgress,
            ocrStage: record.ocrStage,
            ocrQueuedAt: record.ocrQueuedAt,
            ocrStartedAt: record.ocrStartedAt,
            ocrCompletedAt: record.ocrCompletedAt,
            emailIngestKey: record.emailIngestKey,
            notes: message,
            metrics: record.metrics
        )
    }

    private func markDocumentUploading(_ documentId: UUID, message: String) {
        guard let index = records.firstIndex(where: { $0.id == documentId }) else { return }
        let record = records[index]
        records[index] = HealthRecord(
            id: record.id,
            ownerProfileId: record.ownerProfileId,
            title: record.title,
            subtitle: record.subtitle.replacingOccurrences(of: "needs attention", with: "uploading"),
            score: record.score,
            trust: record.trust,
            source: record.source,
            category: record.category,
            status: .inProgress,
            sourceDate: record.sourceDate,
            valueCount: record.valueCount,
            flaggedCount: record.flaggedCount,
            fileName: record.fileName,
            fileKey: record.fileKey,
            fileType: record.fileType,
            createdAt: record.createdAt,
            ocrStatusRaw: record.ocrStatusRaw,
            ocrProgress: record.ocrProgress,
            ocrStage: record.ocrStage,
            ocrQueuedAt: record.ocrQueuedAt,
            ocrStartedAt: record.ocrStartedAt,
            ocrCompletedAt: record.ocrCompletedAt,
            emailIngestKey: record.emailIngestKey,
            notes: message,
            metrics: record.metrics
        )
    }

    private func clearUploadFileURL(_ uploadId: UUID) {
        guard let index = uploads.firstIndex(where: { $0.id == uploadId }) else { return }
        uploads[index].fileURL = nil
    }

    private func cleanupStagedFile(_ url: URL?) {
        guard let url, url.isFileURL else { return }
        guard url.path.contains("/HealthFolioUploads/") else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private func friendlyUploadMessage(_ error: Error) -> String {
        if let localized = (error as? LocalizedError)?.errorDescription, !localized.isEmpty {
            return normalizedUploadFailureCopy(localized)
        }
        let message = error.localizedDescription
        if message.localizedCaseInsensitiveContains("not authenticated") {
            return "Sign in from Profile first, then retry this upload."
        }
        return normalizedUploadFailureCopy(message)
    }

    private func normalizedUploadFailureCopy(_ raw: String) -> String {
        let message = raw.replacingOccurrences(of: "null", with: "missing value")
        if message.localizedCaseInsensitiveContains("unsupported_document")
            || message.localizedCaseInsensitiveContains("does not look like a medical record")
            || message.localizedCaseInsensitiveContains("not a medical record") {
            return "This file does not look like a medical record."
        }
        return message
    }

    private func friendlySessionMessage(_ error: Error) -> String {
        if isCancelledRequest(error) { return "Request cancelled." }
        if let networkError = error as? URLError {
            if networkError.code == .notConnectedToInternet {
                return "You are offline. Your loaded records are still available. Reconnect and try again."
            }
            return "The connection was interrupted. Please try again."
        }
        if let localized = (error as? LocalizedError)?.errorDescription, !localized.isEmpty {
            return friendlyAuthCopy(localized)
        }
        return friendlyAuthCopy(error.localizedDescription)
    }

    private func consentRecordingRetryMessage() -> String {
        "HealthFolio signed you in, but could not save the required consent yet. Review the policy and tap Agree and continue again."
    }

    private func consentRefreshRetryMessage() -> String {
        "HealthFolio needs to confirm the current consent before you can continue. Review the policy and tap Agree and continue."
    }

    private func friendlyAuthCopy(_ raw: String) -> String {
        let message = raw.replacingOccurrences(of: "null", with: "missing value")
        if message.localizedCaseInsensitiveContains("invalid email")
            || message.localizedCaseInsensitiveContains("validate email")
            || message.localizedCaseInsensitiveContains("email address") {
            return "Enter a valid HealthFolio account email address."
        }
        if message.localizedCaseInsensitiveContains("redirect") {
            return "The sign-in link could not be opened. Request a new link or contact support."
        }
        if message.localizedCaseInsensitiveContains("rate limit")
            || message.localizedCaseInsensitiveContains("too many")
            || message.localizedCaseInsensitiveContains("email rate") {
            return "Too many requests. Wait a few minutes, then try again."
        }
        if message.localizedCaseInsensitiveContains("WebAuthenticationSession error 1")
            || message.localizedCaseInsensitiveContains("AuthenticationServices.WebAuthenticationSession")
            || message.localizedCaseInsensitiveContains("canceled") {
            return "Sign-in was cancelled."
        }
        if message.localizedCaseInsensitiveContains("invalid login") {
            return "That email or password did not match a HealthFolio account."
        }
        if message.localizedCaseInsensitiveContains("network")
            || message.localizedCaseInsensitiveContains("timed out")
            || message.localizedCaseInsensitiveContains("offline") {
            return "The network request failed. Please check your connection and try again."
        }
        if message.localizedCaseInsensitiveContains("provider is not enabled")
            || message.localizedCaseInsensitiveContains("unsupported provider")
            || message.localizedCaseInsensitiveContains("invalid_client") {
            return "This sign-in provider is not fully configured yet."
        }
        return message.isEmpty ? "Could not sign in. Please try again." : message
    }

    private func isValidEmail(_ email: String) -> Bool {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count <= 254 else { return false }
        let pattern = #"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$"#
        return trimmed.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    private func answer(for question: String) -> (text: String, sources: [HealthRecord]) {
        let lower = question.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

        if !isSignedIn {
            return ("Sign in from Profile first so I can answer from your uploaded records.", [])
        }

        if isAssistantGreeting(lower) {
            return (
                "Hi. I can help you review uploaded medical records, extracted markers, prescriptions, imaging reports, trends, and health-summary gaps.",
                []
            )
        }

        if !isMedicalAssistantQuestion(lower) {
            return (
                "I can only help with medical information in your HealthFolio records. Ask about a report, marker, prescription, scan, trend, or health summary.",
                []
            )
        }

        if records.isEmpty {
            return (
                "I do not see uploaded records for \(activeProfileName) yet. Add reports in Records, then I can answer from stored metadata, notes, OCR status, and extracted values.",
                []
            )
        }

        if medicationAdviceIntent(lower) {
            return medicationAdviceAnswer()
        }

        if medicationTopic(lower) {
            return prescriptionAnswer(question: lower)
        }

        if imagingTopic(lower) {
            return imagingAnswer()
        }

        let parameterMatches = matchingMetrics(for: lower)
        if !parameterMatches.isEmpty {
            return parameterAnswer(parameterMatches)
        }

        if concernTopic(lower) {
            return concernAnswer()
        }

        if latestTopic(lower) {
            return latestRecordAnswer(question: lower)
        }

        if summaryTopic(lower) {
            return summaryAnswer(question: lower)
        }

        if AssistantQuestionPolicy.containsAnyTerm(["score", "readiness", "health score"], in: lower) {
            let ageCopy = chronologicalAge.map { "Current age: \($0)." } ?? ""
            return (
                ([
                    "Health score is \(healthScore)/100 for \(activeProfileName).",
                    ageCopy,
                    "Why: \(healthScoreReasons.prefix(3).joined(separator: " "))",
                    healthScoreGaps.isEmpty ? "" : "Gaps: \(healthScoreGaps.prefix(3).joined(separator: " "))",
                    "This is a records-readiness view, not a diagnosis."
                ].filter { !$0.isEmpty }).joined(separator: " "),
                []
            )
        }

        if AssistantQuestionPolicy.containsAnyTerm(["upload", "add record", "ocr"], in: lower) {
            return ("Open Records, tap Add, then import from Files, Photos, or Prescription. The upload goes to \(activeProfileName) and uses the live Supabase OCR function.", [])
        }

        let relevant = relevantRecords(for: lower, limit: 3)
        if !relevant.isEmpty {
            return (
                ([rawTextBoundaryCopy()] + relevant.map(recordSummaryLine)).joined(separator: "\n"),
                relevant
            )
        }

        return noMatchingRecordAnswer()
    }

    private func isAssistantGreeting(_ question: String) -> Bool {
        AssistantQuestionPolicy.isGreeting(question)
    }

    private func isMedicalAssistantQuestion(_ question: String) -> Bool {
        let knownRecordTerms = Set(records.flatMap { record in
            let identifyingText = record.metrics.flatMap { [$0.name, $0.parameterId] }
                .joined(separator: " ")
            return AssistantQuestionPolicy.words(in: identifyingText).filter { $0.count >= 4 }
        })
        return AssistantQuestionPolicy.isMedicalQuestion(question, knownRecordTerms: knownRecordTerms)
    }

    private func medicationAdviceIntent(_ question: String) -> Bool {
        let directMedicationAdviceTerms = [
            "should i take",
            "what medication should",
            "what medicine should",
            "which medicine",
            "which medication",
            "dosage",
            "dose",
            "prescribe"
        ]
        if AssistantQuestionPolicy.containsAnyTerm(directMedicationAdviceTerms, in: question) { return true }
        return medicationTopic(question)
            && AssistantQuestionPolicy.containsAnyTerm(["stop", "start", "increase", "decrease"], in: question)
    }

    private func medicationTopic(_ question: String) -> Bool {
        AssistantQuestionPolicy.containsAnyTerm(
            ["rx", "prescription", "medicine", "medication", "tablet", "drug", "pill"],
            in: question
        )
    }

    private func concernTopic(_ question: String) -> Bool {
        AssistantQuestionPolicy.containsAnyTerm(
            ["attention", "abnormal", "flag", "low", "high", "concerning", "concern", "worry", "worried", "marker", "markers", "risk"],
            in: question
        )
    }

    private func imagingTopic(_ question: String) -> Bool {
        AssistantQuestionPolicy.containsAnyTerm(
            ["x-ray", "xray", "ct", "mri", "scan", "imaging", "radiology", "ultrasound"],
            in: question
        )
    }

    private func latestTopic(_ question: String) -> Bool {
        AssistantQuestionPolicy.containsAnyTerm(["latest", "recent", "last", "newest"], in: question)
    }

    private func summaryTopic(_ question: String) -> Bool {
        AssistantQuestionPolicy.containsAnyTerm(
            ["summary", "summarize", "overview", "recap", "explain", "documents", "records", "reports"],
            in: question
        )
    }

    private func medicationAdviceAnswer() -> (text: String, sources: [HealthRecord]) {
        let prescriptions = records
            .filter { $0.category == .prescription }
            .sorted { $0.sourceDate > $1.sourceDate }
        let flagCopy = flaggedMetrics.prefix(3).map(compactMetricLine).joined(separator: "; ")

        return (
            [
                "I cannot choose a medicine or dose for you.",
                prescriptions.isEmpty
                    ? "I do not see a prescription record for \(activeProfileName)."
                    : "I can summarize \(prescriptions.count) prescription record(s) and the source notes.",
                flagCopy.isEmpty
                    ? "I do not see flagged extracted markers in the current records."
                    : "Current flagged markers to discuss: \(flagCopy).",
                "Use this as a clinician question list, not as medication instruction."
            ].joined(separator: " "),
            Array(prescriptions.prefix(4))
        )
    }

    private func concernAnswer() -> (text: String, sources: [HealthRecord]) {
        let flagged = Array(flaggedMetrics.prefix(8))
        if flagged.isEmpty {
            return ("I do not see extracted markers currently flagged as high, low, or review for \(activeProfileName). This depends on uploaded records and OCR quality.", [])
        }

        let lines = flagged.map(compactMetricLine).joined(separator: "; ")
        let sourceRecords = records.filter { record in
            record.metrics.contains { metric in flagged.contains(metric) }
        }

        return (
            "Markers that need attention in \(activeProfileName)'s records: \(lines). Verify each value against its source report and discuss unexpected or persistent results with a clinician.",
            Array(sourceRecords.prefix(4))
        )
    }

    private func prescriptionAnswer(question: String) -> (text: String, sources: [HealthRecord]) {
        let prescriptions = relevantRecords(for: question, preferredKind: .prescription, limit: 4)
            .filter { $0.category == .prescription }

        if prescriptions.isEmpty {
            return (
                "I do not see a matching prescription record. You can upload a prescription or use Care plan to manually track medicines.",
                []
            )
        }

        let lines = prescriptions.prefix(3).map { record in
            "\(record.title) from \(recordDate(record)): \(shortNotes(for: record) ?? "\(record.valueCount) extracted value(s), \(record.flaggedCount) review item(s).")"
        }

        return (
            (["I found \(prescriptions.count) prescription record\(prescriptions.count == 1 ? "" : "s")."] + lines + ["I can summarize what is in the record, but not decide intake or dosage."]).joined(separator: "\n"),
            prescriptions
        )
    }

    private func imagingAnswer() -> (text: String, sources: [HealthRecord]) {
        let imaging = records
            .filter { $0.category == .imagingReport }
            .sorted { $0.sourceDate > $1.sourceDate }

        guard let latest = imaging.first else {
            return ("I do not see an imaging report for \(activeProfileName). Use Records > Add to import an X-ray, CT, MRI, or ultrasound report.", [])
        }

        return (
            "\(latest.title) from \(recordDate(latest)): \(shortNotes(for: latest) ?? latest.subtitle) It has \(latest.flaggedCount) item(s) marked for review.",
            [latest]
        )
    }

    private func parameterAnswer(_ metrics: [HealthMetric]) -> (text: String, sources: [HealthRecord]) {
        let selected = Array(metrics.prefix(4))
        let lines = selected.map(metricLine)
        let sourceRecords = records.filter { record in
            record.metrics.contains { metric in selected.contains(metric) }
        }

        let reviewCopy: String
        if selected.contains(where: { $0.status != .normal }) {
            reviewCopy = "At least one matched marker is outside or near the expected range, so verify the source PDF and discuss persistent results with a clinician."
        } else {
            reviewCopy = "The matched marker values are currently inside the available reference ranges."
        }

        return (
            (["From \(activeProfileName)'s records:"] + lines + [reviewCopy]).joined(separator: "\n"),
            Array(sourceRecords.prefix(4))
        )
    }

    private func latestRecordAnswer(question: String) -> (text: String, sources: [HealthRecord]) {
        let tokens = assistantTokens(question)
        let relevant = relevantRecords(for: question, limit: 1)
        let latest = tokens.isEmpty
            ? records.max(by: { $0.sourceDate < $1.sourceDate })
            : relevant.first
        guard let latest else { return noMatchingRecordAnswer() }

        let topMetrics = latest.metrics.prefix(6).map(compactMetricLine).joined(separator: "; ")
        return (
            [
                "The latest document is \(latest.title), dated \(recordDate(latest)).",
                topMetrics.isEmpty ? "No extracted readings are attached to this document yet." : "Extracted readings: \(topMetrics).",
                rawTextBoundaryCopy()
            ].joined(separator: " "),
            [latest]
        )
    }

    private func summaryAnswer(question: String) -> (text: String, sources: [HealthRecord]) {
        let relevant = relevantRecords(for: question, limit: 4)
        let selected: [HealthRecord]
        if relevant.isEmpty {
            guard assistantTokens(question).isEmpty else { return noMatchingRecordAnswer() }
            selected = Array(records.sorted { $0.sourceDate > $1.sourceDate }.prefix(4))
        } else {
            selected = relevant
        }

        return (
            (["Record summary for \(activeProfileName):"] + selected.map(recordSummaryLine) + [rawTextBoundaryCopy()]).joined(separator: "\n"),
            selected
        )
    }

    private func noMatchingRecordAnswer() -> (text: String, sources: [HealthRecord]) {
        (
            "I could not match that medical question to the current records. Try naming a marker, report type, prescription, scan, or date.",
            []
        )
    }

    private func matchingMetrics(for question: String) -> [HealthMetric] {
        let questionTokens = expandedAssistantTokens(question)
        guard !questionTokens.isEmpty else { return [] }

        return latestMetrics
            .map { metric in
                (metric, metricMatchScore(metric, tokens: questionTokens))
            }
            .filter { $0.1 >= 2 }
            .sorted { lhs, rhs in
                if lhs.1 != rhs.1 {
                    return lhs.1 > rhs.1
                }
                return lhs.0.recordedAt > rhs.0.recordedAt
            }
            .map(\.0)
    }

    private func metricMatchScore(_ metric: HealthMetric, tokens: [String]) -> Int {
        let metricTerms = AssistantQuestionPolicy.words(in: "\(metric.parameterId) \(metric.name)")
        let panelTerms = AssistantQuestionPolicy.words(in: metric.panel ?? "")
        return AssistantQuestionPolicy.recordMatchScore(
            questionTerms: tokens,
            recordTerms: metricTerms,
            categoryMatches: false
        ) + AssistantQuestionPolicy.recordMatchScore(
            questionTerms: tokens,
            recordTerms: panelTerms,
            categoryMatches: false
        )
    }

    private func relevantRecords(
        for question: String,
        preferredKind: HealthRecordKind? = nil,
        limit: Int
    ) -> [HealthRecord] {
        let tokens = assistantTokens(question)
        let inferredKind = preferredKind ?? recordKind(fromQuestion: question)
        let scored = records
            .map { record in
                (record, recordScore(record, tokens: tokens, preferredKind: inferredKind))
            }
            .sorted { lhs, rhs in
                if lhs.1 != rhs.1 {
                    return lhs.1 > rhs.1
                }
                return lhs.0.sourceDate > rhs.0.sourceDate
            }

        let matching = scored.filter { $0.1 > 0 }.map(\.0)
        return Array(matching.prefix(limit))
    }

    private func recordScore(
        _ record: HealthRecord,
        tokens: [String],
        preferredKind: HealthRecordKind?
    ) -> Int {
        AssistantQuestionPolicy.recordMatchScore(
            questionTerms: tokens,
            recordTerms: AssistantQuestionPolicy.words(in: recordSearchText(record)),
            categoryMatches: preferredKind == record.category
        )
    }

    private func recordKind(fromQuestion question: String) -> HealthRecordKind? {
        if medicationTopic(question) { return .prescription }
        if imagingTopic(question) { return .imagingReport }
        if AssistantQuestionPolicy.containsAnyTerm(["vaccine", "vaccination"], in: question) { return .vaccinationRecord }
        if AssistantQuestionPolicy.containsAnyTerm(["surgery", "discharge", "hospital"], in: question) { return .dischargeSummary }
        if AssistantQuestionPolicy.containsAnyTerm(["blood", "lab", "cbc", "lipid", "hba1c"], in: question) {
            return .labReport
        }
        return nil
    }

    private func assistantTokens(_ text: String) -> [String] {
        var stopWords: Set<String> = [
            "about", "again", "any", "are", "can", "could", "did", "doc", "docs", "document",
            "documents", "from", "have", "health", "how", "latest", "last", "level", "levels",
            "me", "medical", "mine", "most", "my", "need", "reading", "readings", "record",
            "records", "report", "reports", "result", "results", "sent", "show", "summarize", "summary", "tell", "that",
            "the", "this", "uploaded", "was", "were", "what", "when", "which", "with", "is",
            "ok", "okay", "fine", "good", "bad", "high", "low"
        ]
        stopWords.formUnion(
            activeProfileName
                .lowercased()
                .components(separatedBy: CharacterSet.alphanumerics.inverted)
                .filter { !$0.isEmpty }
        )

        return text
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count > 2 && !stopWords.contains($0) }
    }

    private func expandedAssistantTokens(_ text: String) -> [String] {
        var tokens = assistantTokens(text)
        let lower = text.lowercased()
        let aliases: [String: [String]] = [
            "sugar": ["glucose", "hba1c", "insulin"],
            "diabetes": ["glucose", "hba1c", "insulin"],
            "diabetic": ["glucose", "hba1c", "insulin"],
            "a1c": ["hba1c", "glycated", "hemoglobin"],
            "hba1c": ["hba1c", "glycated", "hemoglobin"],
            "thyroid": ["thyroid", "tsh"],
            "tsh": ["thyroid", "tsh"],
            "bilirubin": ["bilirubin"],
            "platelet": ["platelet"],
            "hemoglobin": ["hemoglobin", "hb"],
            "cholesterol": ["cholesterol", "ldl", "hdl", "triglycerides"]
        ]

        for (trigger, additions) in aliases where AssistantQuestionPolicy.containsTerm(trigger, in: lower) {
            tokens.append(contentsOf: additions)
        }
        return Array(Set(tokens))
    }

    private func concernToken(_ token: String) -> Bool {
        ["attention", "abnormal", "flag", "review", "verify", "risk"].contains(token)
    }

    private func recordSearchText(_ record: HealthRecord) -> String {
        [
            record.id.uuidString,
            record.title,
            record.subtitle,
            record.category.fullLabel,
            record.status.label,
            record.source,
            record.fileName,
            record.fileType,
            record.ocrStatusRaw,
            record.ocrStage,
            record.emailIngestKey,
            record.notes,
            record.metrics.map(metricSearchText).joined(separator: " "),
            recordDate(record)
        ]
            .compactMap { $0 }
            .joined(separator: " ")
            .lowercased()
    }

    private func metricSearchText(_ metric: HealthMetric) -> String {
        [
            metric.parameterId,
            metric.name,
            metric.value,
            metric.trend,
            metric.status.label,
            metric.sourceTitle
        ]
            .compactMap { $0 }
            .joined(separator: " ")
            .lowercased()
    }

    private func compactMetricLine(_ metric: HealthMetric) -> String {
        let range = metric.referenceRangeLabel.map { ", range \($0)" } ?? ""
        return "\(metric.name) \(metric.value) (\(metric.status.label)\(range))"
    }

    private func metricLine(_ metric: HealthMetric) -> String {
        let range = metric.referenceRangeLabel.map { " Reference range: \($0)." } ?? " Reference range is not available."
        let source = metric.sourceTitle.map { " Source: \($0)." } ?? ""
        return "\(metric.name): \(metric.value) on \(metric.recordedAt.formatted(date: .abbreviated, time: .omitted)). Status: \(metric.trend.capitalized).\(range)\(source)"
    }

    private func recordSummaryLine(_ record: HealthRecord) -> String {
        let flagged = record.metrics.filter { $0.status != .normal }
        let lead: String
        if !flagged.isEmpty {
            lead = "\(flagged.count) flagged: \(flagged.prefix(3).map(compactMetricLine).joined(separator: "; "))"
        } else if record.valueCount > 0 {
            lead = "\(record.valueCount) extracted value\(record.valueCount == 1 ? "" : "s")"
        } else {
            lead = "OCR status: \(record.status.label)"
        }

        let notes = shortNotes(for: record)
        return "\(record.title) (\(recordDate(record))): \(lead).\(notes.map { " \($0)" } ?? "")"
    }

    private func shortNotes(for record: HealthRecord) -> String? {
        let trimmed = record.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return trimmed
            .split(separator: "\n")
            .prefix(2)
            .joined(separator: " ")
    }

    private func recordDate(_ record: HealthRecord) -> String {
        record.sourceDate.formatted(date: .abbreviated, time: .omitted)
    }

    private func rawTextBoundaryCopy() -> String {
        "I can read stored metadata, notes, OCR status, and extracted marker values; I do not have full raw PDF text unless it has been extracted into those fields."
    }

    private func inferRecordKind(from name: String) -> HealthRecordKind {
        let lower = name.lowercased()
        if lower.contains("rx") || lower.contains("prescription") || lower.contains("medicine") {
            return .prescription
        }
        if lower.contains("xray") || lower.contains("x-ray") || lower.contains("ct") || lower.contains("mri") || lower.contains("scan") {
            return .imagingReport
        }
        if lower.contains("vaccine") || lower.contains("vaccination") {
            return .vaccinationRecord
        }
        if lower.contains("surgery") || lower.contains("discharge") {
            return .dischargeSummary
        }
        if lower.contains("blood") || lower.contains("lab") || lower.contains("cbc") || lower.contains("hba1c") {
            return .labReport
        }
        return .other
    }

    private func title(for kind: HealthRecordKind, fileName: String) -> String {
        if kind == .other {
            return fileName
        }
        return kind.fullLabel
    }

    private func searchableText(for record: HealthRecord) -> String {
        [
            record.title,
            record.subtitle,
            record.category.fullLabel,
            record.status.label,
            record.fileName,
            record.notes,
            record.metrics.map(\.name).joined(separator: " ")
        ].joined(separator: " ")
    }

    private func statusRank(_ status: HealthMetric.Status) -> Int {
        switch status {
        case .attention: 0
        case .review: 1
        case .normal: 2
        }
    }
}
