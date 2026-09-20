import SwiftUI

struct AccountDeletionNativeView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var hasAcknowledgedDeletion = false
    @State private var errorMessage = ""
    @State private var isShowingError = false

    private let supportEmailURL = URL(string: "mailto:starklabs2026@gmail.com")!
    private let supportPageURL = URL(string: "https://starklabs2026-crypto.github.io/health-tracker/support/")!

    var body: some View {
        Form {
            Section {
                Text("Permanently delete account")
                    .font(.headline)
                Text("Delete your HealthFolio account, synced health records, unclaimed managed profiles, care reminders on this device, and assistant chat history. Independently claimed family accounts are preserved.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("This cannot be undone.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Section("What will be removed") {
                Label("Your HealthFolio sign-in and app account", systemImage: "person.crop.circle.badge.xmark")
                Label("Uploaded records, extracted readings, and share links", systemImage: "doc.text.magnifyingglass")
                Label("Unclaimed managed family profiles tied to this account", systemImage: "person.2.slash")
                Label("Saved care reminders and local notifications", systemImage: "bell.slash")
                Label("Assistant chat history stored on this device", systemImage: "message.badge")
            }

            Section("Need help first?") {
                Button("Email starklabs2026@gmail.com") {
                    openURL(supportEmailURL)
                }

                Button("Open support page") {
                    openURL(supportPageURL)
                }
            }

            Section {
                Toggle(
                    "I understand this permanently deletes my account and HealthFolio data.",
                    isOn: $hasAcknowledgedDeletion
                )
                .toggleStyle(.switch)

                if model.isDeletingAccount {
                    ProgressView("Deleting your account...")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } footer: {
                Text("Keep this screen open until deletion finishes. If it fails, HealthFolio will keep you here so you can retry.")
            }

            Section {
                Button("Permanently delete account", role: .destructive, action: submitDeletion)
                    .disabled(model.isDeletingAccount || !hasAcknowledgedDeletion)
                Button("Cancel", role: .cancel, action: cancelDeletion)
                    .disabled(model.isDeletingAccount)
            }
        }
        .navigationTitle("Delete account")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close", action: cancelDeletion)
                    .disabled(model.isDeletingAccount)
            }
        }
        .alert("Account deletion failed", isPresented: $isShowingError) {} message: {
            Text(errorMessage)
        }
    }

    private func submitDeletion() {
        guard !model.isDeletingAccount else { return }
        Task {
            let deleted = await model.deleteAccount()
            if deleted {
                dismiss()
            } else {
                errorMessage = model.sessionMessage ?? "HealthFolio could not delete your account. Try again."
                isShowingError = true
            }
        }
    }

    private func cancelDeletion() {
        model.cancelAccountDeletionRetry()
        dismiss()
    }
}
