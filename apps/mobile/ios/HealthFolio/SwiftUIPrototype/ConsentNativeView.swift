import SwiftUI

struct ConsentNativeView: View {
    enum Mode {
        case newAccount
        case existingAccount
    }

    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var hasAcknowledgedConsent = false

    let mode: Mode
    let onAccept: () -> Void
    let onSignOut: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                explanationCard
                acknowledgementSection
                actionButtons
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(HealthFolioTheme.background.ignoresSafeArea())
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.shield.fill")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(HealthFolioTheme.blue)
                    .frame(width: 44, height: 44)
                    .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 8))
                    .accessibilityHidden(true)

                Text("HealthFolio")
                    .font(.system(.largeTitle, design: .rounded).bold())
                    .foregroundStyle(HealthFolioTheme.ink)
                    .accessibilityAddTraits(.isHeader)
            }

            Text("Health-data consent is required before you can continue.")
                .font(.title3.weight(.semibold))
                .foregroundStyle(HealthFolioTheme.ink)

            Text(mode == .newAccount ? "Review the privacy terms for your new account." : "Review the current privacy terms to continue using your account.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var explanationCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Why HealthFolio needs this", systemImage: "heart.text.square.fill")
                .font(.headline)
                .foregroundStyle(HealthFolioTheme.ink)

            Text("Asianol Lubricants Private Limited operates HealthFolio and processes your account details and health records to provide the service.")
                .font(.body)
                .foregroundStyle(HealthFolioTheme.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            Text("HealthFolio sends uploaded or forwarded medical files to OpenAI to extract text and readings. When you use Assistant, HealthFolio sends your question and relevant information from the selected health profile to OpenAI to generate a reply.")
                .font(.body)
                .foregroundStyle(HealthFolioTheme.inkSoft)
                .fixedSize(horizontal: false, vertical: true)

            Text("HealthFolio is not a medical provider and it is not for emergencies. Call local emergency services or your clinician for urgent care.")
                .font(.body.weight(.semibold))
                .foregroundStyle(HealthFolioTheme.amber)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 12) {
                Link(destination: HealthFolioConsentPolicy.privacyURL) {
                    consentLinkLabel(title: "Privacy Policy", systemImage: "lock.doc")
                }

                Link(destination: HealthFolioConsentPolicy.standardEULAURL) {
                    consentLinkLabel(title: "Standard EULA", systemImage: "doc.text")
                }
            }
        }
        .padding(20)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }

    private var acknowledgementSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $hasAcknowledgedConsent) {
                Text("I agree to Asianol’s processing of my account and health data, including sending the information described above to OpenAI for document extraction and Assistant replies.")
                    .font(.body)
                    .foregroundStyle(HealthFolioTheme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .toggleStyle(.switch)
            .disabled(model.isRecordingConsent)
            .accessibilityHint("Required before continuing.")

            if let sessionMessage = model.sessionMessage, !sessionMessage.isEmpty {
                Text(sessionMessage)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(sessionMessage)
            }
        }
    }

    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button(action: onAccept) {
                HStack(spacing: 10) {
                    if model.isRecordingConsent {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                    }
                    Text("Agree and continue")
                        .bold()
                    Spacer(minLength: 0)
                }
                .font(.body)
                .foregroundStyle(.white)
                .padding(.horizontal, 18)
                .frame(maxWidth: .infinity, minHeight: 54)
                .background(HealthFolioTheme.blue, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!hasAcknowledgedConsent || model.isRecordingConsent)
            .accessibilityHint("Saves your consent and continues into HealthFolio.")

            if mode == .existingAccount {
                Button(action: onSignOut) {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(HealthFolioTheme.blue)
                .disabled(model.isRecordingConsent)
            }
        }
    }

    private func consentLinkLabel(title: String, systemImage: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .foregroundStyle(HealthFolioTheme.blue)
            Text(title)
                .font(.body.weight(.semibold))
                .foregroundStyle(HealthFolioTheme.blue)
            Spacer(minLength: 0)
            Image(systemName: "arrow.up.right")
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, minHeight: 44)
        .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
