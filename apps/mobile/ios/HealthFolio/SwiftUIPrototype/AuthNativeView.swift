import SwiftUI

private enum NativeAuthMode {
    case signUp
    case signIn

    var title: String {
        switch self {
        case .signUp: "Create your HealthFolio"
        case .signIn: "Welcome back"
        }
    }

    var subtitle: String {
        switch self {
        case .signUp: "Start with email, Apple, or Google."
        case .signIn: "Sign in with email, Apple, or Google."
        }
    }

    var primaryActionTitle: String {
        switch self {
        case .signUp: "Create account"
        case .signIn: "Sign in"
        }
    }

    var firstLaunchIntent: FirstLaunchAuthIntent {
        switch self {
        case .signUp: .newAccount
        case .signIn: .returning
        }
    }
}

struct AuthNativeView: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var mode: NativeAuthMode?
    @State private var email = ""
    @State private var password = ""
    @State private var isPasswordVisible = false
    @State private var hasAcceptedNewAccountConsent = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    brandHeader

                    if let mode {
                        authForm(mode)
                    } else {
                        welcomeActions
                    }
                    AuthTrustNote()
                }
                .padding(.horizontal, 28)
                .padding(.top, 56)
                .padding(.bottom, 32)
                .frame(maxWidth: 540)
                .frame(maxWidth: .infinity)
            }
            .background(HealthFolioTheme.background.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
        }
        .onChange(of: mode) { _ in
            hasAcceptedNewAccountConsent = false
        }
    }

    private var brandHeader: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(HealthFolioTheme.blueSoft)
                    .frame(width: 72, height: 72)
                Image(systemName: "heart.text.square.fill")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(HealthFolioTheme.blue)
            }

            VStack(spacing: 8) {
                Text("HealthFolio")
                    .font(.system(.largeTitle, design: .rounded).bold())
                    .foregroundStyle(HealthFolioTheme.ink)
                Text("Your reports, readings, and doctor-ready summary.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var welcomeActions: some View {
        VStack(spacing: 12) {
            AuthPrimaryButton(title: "I'm new", systemImage: "person.badge.plus") {
                resetDraft()
                model.prepareForNewAccountOnboarding()
                mode = .signUp
            }

            AuthSecondaryButton(title: "I have an account", systemImage: "person.crop.circle.badge.checkmark") {
                resetDraft()
                model.prepareForReturningAuth()
                mode = .signIn
            }
        }
    }

    private func authForm(_ mode: NativeAuthMode) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text(mode.title)
                    .font(.title2.bold())
                    .foregroundStyle(HealthFolioTheme.ink)
                Text(mode.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                TextField("HealthFolio email", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.emailAddress)
                    .padding(14)
                    .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))

                passwordField(for: mode)
            }

            if mode == .signUp {
                newAccountConsentDisclosure
            }

            AuthPrimaryButton(title: mode.primaryActionTitle, systemImage: "arrow.right.circle.fill", isLoading: model.isLoadingData) {
                Task { await submitEmail(mode) }
            }
            .disabled(isAuthActionDisabled(mode) || cleanEmail.isEmpty || password.count < 8)

            if mode == .signIn {
                Button {
                    Task { await model.requestPasswordReset(email: cleanEmail) }
                } label: {
                    Label("Forgot password?", systemImage: "key")
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(HealthFolioTheme.blue)
                .disabled(model.isLoadingData || cleanEmail.isEmpty)
            }

            VStack(spacing: 10) {
                AuthSecondaryButton(title: "Continue with Apple", systemImage: "apple.logo", isLoading: model.isLoadingData) {
                    Task {
                        await model.signInWithApple(
                            authIntent: mode.firstLaunchIntent,
                            consentSource: mode == .signUp ? .apple : nil
                        )
                    }
                }
                .disabled(isAuthActionDisabled(mode))

                AuthSecondaryButton(title: "Continue with Google", systemImage: "globe", isLoading: model.isLoadingData) {
                    Task {
                        await model.signInWithOAuth(
                            provider: "google",
                            authIntent: mode.firstLaunchIntent,
                            consentSource: mode == .signUp ? .google : nil
                        )
                    }
                }
                .disabled(isAuthActionDisabled(mode))

                if mode == .signIn {
                    AuthSecondaryButton(title: "Email me a sign-in link", systemImage: "envelope.badge", isLoading: model.isLoadingData) {
                        Task { await model.sendSignInLink(email: cleanEmail) }
                    }
                    .disabled(model.isLoadingData || cleanEmail.isEmpty)
                }
            }

            if let sessionMessage = model.sessionMessage, !sessionMessage.isEmpty {
                Text(sessionMessage)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(sessionMessage)
            }

            Button {
                model.clearSessionMessage()
                self.mode = nil
            } label: {
                Label("Back", systemImage: "chevron.left")
                    .font(.body.bold())
            }
            .buttonStyle(.plain)
            .foregroundStyle(HealthFolioTheme.blue)
            .frame(minHeight: 44, alignment: .leading)
        }
    }

    private var cleanEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var newAccountConsentDisclosure: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $hasAcceptedNewAccountConsent) {
                Text("I agree to HealthFolio processing my account and health data as described in the Privacy Policy and Standard EULA.")
                    .font(.body)
                    .foregroundStyle(HealthFolioTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .toggleStyle(.switch)

            VStack(spacing: 10) {
                Link(destination: HealthFolioConsentPolicy.privacyURL) {
                    Label("Privacy Policy", systemImage: "lock.doc")
                        .font(.footnote.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                }

                Link(destination: HealthFolioConsentPolicy.standardEULAURL) {
                    Label("Standard EULA", systemImage: "doc.text")
                        .font(.footnote.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
            }
            .foregroundStyle(HealthFolioTheme.blue)
        }
        .padding(16)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }

    private func isAuthActionDisabled(_ mode: NativeAuthMode) -> Bool {
        model.isLoadingData || (mode == .signUp && !hasAcceptedNewAccountConsent)
    }

    private func resetDraft() {
        model.clearSessionMessage()
        email = ""
        password = ""
        isPasswordVisible = false
        hasAcceptedNewAccountConsent = false
    }

    private func submitEmail(_ mode: NativeAuthMode) async {
        switch mode {
        case .signUp:
            await model.signUp(email: cleanEmail, password: password, consentSource: .email)
        case .signIn:
            await model.signIn(email: cleanEmail, password: password)
        }
    }

    private func passwordField(for mode: NativeAuthMode) -> some View {
        HStack(spacing: 10) {
            Group {
                if isPasswordVisible {
                    TextField("Password", text: $password)
                } else {
                    SecureField("Password", text: $password)
                }
            }
            .textContentType(mode == .signUp ? .newPassword : .password)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .privacySensitive()

            Button(isPasswordVisible ? "Hide password" : "Show password", systemImage: isPasswordVisible ? "eye.slash" : "eye") {
                isPasswordVisible.toggle()
            }
            .labelStyle(.iconOnly)
            .foregroundStyle(.secondary)
            .frame(width: 44, height: 44)
        }
        .padding(14)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))
    }
}

private struct AuthPrimaryButton: View {
    let title: String
    let systemImage: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .bold()
                Spacer(minLength: 0)
            }
            .font(.body)
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(HealthFolioTheme.blue, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))
        }
        .buttonStyle(.plain)
    }
}

private struct AuthSecondaryButton: View {
    let title: String
    let systemImage: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isLoading {
                    ProgressView()
                } else {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .bold()
                Spacer(minLength: 0)
            }
            .font(.body)
            .foregroundStyle(HealthFolioTheme.ink)
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))
            .overlay {
                RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius)
                    .stroke(HealthFolioTheme.border, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct AuthTrustNote: View {
    var body: some View {
        Label("Private by default. HealthFolio does not share your medical records with others unless you choose to create a secure share link.", systemImage: "lock.shield")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))
    }
}

#Preview {
    AuthNativeView()
        .environmentObject(HealthFolioAppModel())
}
