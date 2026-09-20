import SwiftUI

extension Notification.Name {
    static let healthFolioAuthCallbackURL = Notification.Name("HealthFolioAuthCallbackURL")
}

enum HealthFolioAuthCallbackUserInfoKey {
    static let url = "url"
}

enum HealthFolioAuthCallbackRouter {
    private static let lock = NSLock()
    private static var pendingURLs: [URL] = []

    @discardableResult
    static func route(_ url: URL) -> Bool {
        let normalizedPath = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard
            url.scheme?.lowercased() == NativeSupabaseConfig.callbackScheme,
            url.host?.lowercased() == "auth",
            normalizedPath == "callback"
        else {
            return false
        }

        lock.lock()
        pendingURLs.append(url)
        lock.unlock()

        NotificationCenter.default.post(
            name: .healthFolioAuthCallbackURL,
            object: nil,
            userInfo: [HealthFolioAuthCallbackUserInfoKey.url: url]
        )
        return true
    }

    static func markHandled(_ url: URL) {
        lock.lock()
        pendingURLs.removeAll { $0 == url }
        lock.unlock()
    }

    static func drainPendingURLs() -> [URL] {
        lock.lock()
        let urls = pendingURLs
        pendingURLs.removeAll()
        lock.unlock()
        return urls
    }
}

struct HealthFolioRootView: View {
    @State private var selectedTab = HealthFolioTab.today
    @StateObject private var model = HealthFolioAppModel()

    init() {
        #if DEBUG
        _selectedTab = State(initialValue: Self.screenshotTabArgument())
        #endif
    }

    var body: some View {
        Group {
            if !model.hasBootstrapped {
                ProgressView()
                    .tint(HealthFolioTheme.blue)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(HealthFolioTheme.background.ignoresSafeArea())
            } else if !model.isSignedIn {
                AuthNativeView()
            } else if HealthFolioConsentPolicy.requiresBlockingGate(
                isSignedIn: model.isSignedIn,
                hasCurrentConsent: model.hasCurrentConsent,
                isPasswordResetRequired: model.isPasswordResetRequired
            ) {
                ConsentNativeView(
                    mode: model.consentGateMode,
                    onAccept: {
                        Task { await model.acceptCurrentConsent(source: model.consentAcceptanceSource) }
                    },
                    onSignOut: {
                        Task { await model.signOut() }
                    }
                )
            } else {
                appTabs
            }
        }
        .tint(HealthFolioTheme.blue)
        .environmentObject(model)
        .overlay {
            if model.isShowingFirstLaunchGuide
                && !HealthFolioConsentPolicy.requiresBlockingGate(
                    isSignedIn: model.isSignedIn,
                    hasCurrentConsent: model.hasCurrentConsent,
                    isPasswordResetRequired: model.isPasswordResetRequired
                )
                && !model.isPasswordResetRequired {
                FirstLaunchGuideOverlay(
                    step: model.firstLaunchGuideStep,
                    onPrimary: handleFirstLaunchGuidePrimaryAction,
                    onSkip: { model.finishFirstLaunchGuide() }
                )
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        .animation(.easeInOut(duration: 0.18), value: model.isShowingFirstLaunchGuide)
        .animation(.easeInOut(duration: 0.18), value: model.firstLaunchGuideStep)
        .task {
            await model.bootstrap()
            await handlePendingAuthCallbacks()
        }
        .sheet(isPresented: $model.isPasswordResetRequired) {
            PasswordResetNativeView()
                .environmentObject(model)
                .interactiveDismissDisabled()
        }
        .onReceive(NotificationCenter.default.publisher(for: .healthFolioAuthCallbackURL)) { notification in
            guard let url = notification.userInfo?[HealthFolioAuthCallbackUserInfoKey.url] as? URL else {
                return
            }
            HealthFolioAuthCallbackRouter.markHandled(url)
            Task {
                await model.handleAuthCallback(url)
            }
        }
        .onChange(of: model.firstLaunchGuideStep) { step in
            if step == .records || step == .addRecord || step == .upload {
                selectedTab = .records
            }
        }
    }

    private var appTabs: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                TodayNativeView(selectedTab: $selectedTab)
            }
            .tabItem {
                Label(HealthFolioTab.today.title, systemImage: HealthFolioTab.today.symbol)
            }
            .tag(HealthFolioTab.today)

            NavigationStack {
                RecordsNativeView()
            }
            .tabItem {
                Label(HealthFolioTab.records.title, systemImage: HealthFolioTab.records.symbol)
            }
            .tag(HealthFolioTab.records)

            NavigationStack {
                TrendsNativeView()
            }
            .tabItem {
                Label(HealthFolioTab.trends.title, systemImage: HealthFolioTab.trends.symbol)
            }
            .tag(HealthFolioTab.trends)

            NavigationStack {
                CarePlanNativeView()
            }
            .tabItem {
                Label(HealthFolioTab.care.title, systemImage: HealthFolioTab.care.symbol)
            }
            .tag(HealthFolioTab.care)

            NavigationStack {
                AssistantNativeView()
            }
            .tabItem {
                Label(HealthFolioTab.assistant.title, systemImage: HealthFolioTab.assistant.symbol)
            }
            .tag(HealthFolioTab.assistant)
        }
    }

    private func handlePendingAuthCallbacks() async {
        for url in HealthFolioAuthCallbackRouter.drainPendingURLs() {
            await model.handleAuthCallback(url)
        }
    }

    private func handleFirstLaunchGuidePrimaryAction() {
        switch model.firstLaunchGuideStep {
        case .profile:
            model.advanceFirstLaunchGuide()
        case .records:
            selectedTab = .records
            model.advanceFirstLaunchGuide()
        case .addRecord:
            selectedTab = .records
            model.advanceFirstLaunchGuide()
            model.requestFirstLaunchUploadSheet()
        case .upload:
            selectedTab = .records
            model.finishFirstLaunchGuide(openUpload: true)
        }
    }

    #if DEBUG
    private static func screenshotTabArgument() -> HealthFolioTab {
        let arguments = ProcessInfo.processInfo.arguments
        guard arguments.contains("-healthfolioScreenshotMode"),
              let keyIndex = arguments.firstIndex(of: "-healthfolioScreenshotTab"),
              arguments.indices.contains(keyIndex + 1)
        else { return .today }

        switch arguments[keyIndex + 1].lowercased() {
        case "records": return .records
        case "trends": return .trends
        case "care": return .care
        case "assistant": return .assistant
        default: return .today
        }
    }
    #endif
}

private struct FirstLaunchGuideOverlay: View {
    let step: FirstLaunchGuideStep
    let onPrimary: () -> Void
    let onSkip: () -> Void

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                Color.black.opacity(0.34)
                    .ignoresSafeArea()

                FirstLaunchGuideCardContainer(placement: step.cardPlacement, safeArea: proxy.safeAreaInsets) {
                    FirstLaunchGuideCard(
                        step: step,
                        onPrimary: onPrimary,
                        onSkip: onSkip
                    )
                }
            }
        }
        .accessibilityElement(children: .contain)
    }
}

private enum FirstLaunchGuideCardPlacement {
    case top
    case bottom
    case aboveTabBar
}

private struct FirstLaunchGuideCardContainer<Content: View>: View {
    let placement: FirstLaunchGuideCardPlacement
    let safeArea: EdgeInsets
    let content: Content

    init(
        placement: FirstLaunchGuideCardPlacement,
        safeArea: EdgeInsets,
        @ViewBuilder content: () -> Content
    ) {
        self.placement = placement
        self.safeArea = safeArea
        self.content = content()
    }

    var body: some View {
        VStack {
            if placement == .top {
                content
                Spacer(minLength: 0)
            } else {
                Spacer(minLength: 0)
                content
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, placement == .top ? safeArea.top + 18 : 0)
        .padding(.bottom, bottomPadding)
    }

    private var bottomPadding: CGFloat {
        switch placement {
        case .top:
            18
        case .bottom:
            max(18, safeArea.bottom + 10)
        case .aboveTabBar:
            safeArea.bottom + 96
        }
    }
}

private struct FirstLaunchGuideCard: View {
    let step: FirstLaunchGuideStep
    let onPrimary: () -> Void
    let onSkip: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: step.systemImage)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(HealthFolioTheme.blue)
                    .frame(width: 50, height: 50)
                    .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 4) {
                    Text("First steps")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    Text(step.title)
                        .font(.title3.bold())
                        .foregroundStyle(HealthFolioTheme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }

            Text(step.body)
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                ForEach(FirstLaunchGuideStep.allCases) { item in
                    Capsule()
                        .fill(item == step ? HealthFolioTheme.blue : HealthFolioTheme.border)
                        .frame(width: item == step ? 28 : 8, height: 8)
                }
            }
            .accessibilityHidden(true)

            HStack(spacing: 12) {
                Button("Skip", action: onSkip)
                    .font(.body.bold())
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(HealthFolioTheme.background, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))

                Button(step.primaryTitle, action: onPrimary)
                    .font(.body.bold())
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(HealthFolioTheme.blue, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))
            }
        }
        .padding(20)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 26))
        .overlay {
            RoundedRectangle(cornerRadius: 26)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.16), radius: 24, x: 0, y: 12)
    }
}

private extension FirstLaunchGuideStep {
    var cardPlacement: FirstLaunchGuideCardPlacement {
        switch self {
        case .records:
            .aboveTabBar
        default:
            .bottom
        }
    }
}

#Preview {
    HealthFolioRootView()
}
