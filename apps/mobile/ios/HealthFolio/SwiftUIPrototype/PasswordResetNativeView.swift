import SwiftUI

struct PasswordResetNativeView: View {
    let title: String
    let message: String
    let navigationTitle: String
    @EnvironmentObject private var model: HealthFolioAppModel
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var confirmation = ""
    @State private var isPasswordVisible = false
    @State private var isConfirmationVisible = false

    init(
        title: String = "Set a new password",
        message: String = "Use at least 8 characters. This updates the password for your HealthFolio account.",
        navigationTitle: String = "Password reset"
    ) {
        self.title = title
        self.message = message
        self.navigationTitle = navigationTitle
    }

    private var canSubmit: Bool {
        password.count >= 8 && password == confirmation && !model.isLoadingData
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(title)
                        .font(.title2.bold())
                        .foregroundStyle(HealthFolioTheme.ink)
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                VStack(spacing: 12) {
                    passwordEntryField(
                        title: "New password",
                        text: $password,
                        isVisible: $isPasswordVisible
                    )

                    passwordEntryField(
                        title: "Confirm password",
                        text: $confirmation,
                        isVisible: $isConfirmationVisible
                    )
                }

                if !confirmation.isEmpty, password != confirmation {
                    Text("Passwords do not match.")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                if let sessionMessage = model.sessionMessage, !sessionMessage.isEmpty {
                    Text(sessionMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Button {
                    Task {
                        if await model.completePasswordReset(password: password) {
                            dismiss()
                        }
                    }
                } label: {
                    HStack(spacing: 10) {
                        if model.isLoadingData {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "key.fill")
                        }
                        Text("Update password")
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
                .disabled(!canSubmit)

                Spacer(minLength: 0)
            }
            .padding(24)
            .frame(maxWidth: 540, alignment: .topLeading)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(HealthFolioTheme.background.ignoresSafeArea())
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func passwordEntryField(title: String, text: Binding<String>, isVisible: Binding<Bool>) -> some View {
        HStack(spacing: 10) {
            Group {
                if isVisible.wrappedValue {
                    TextField(title, text: text)
                } else {
                    SecureField(title, text: text)
                }
            }
            .textContentType(.newPassword)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .privacySensitive()

            Button(isVisible.wrappedValue ? "Hide \(title.lowercased())" : "Show \(title.lowercased())", systemImage: isVisible.wrappedValue ? "eye.slash" : "eye") {
                isVisible.wrappedValue.toggle()
            }
            .labelStyle(.iconOnly)
            .foregroundStyle(.secondary)
            .frame(width: 34, height: 34)
        }
        .padding(14)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))
    }
}

#Preview {
    PasswordResetNativeView()
        .environmentObject(HealthFolioAppModel())
}
