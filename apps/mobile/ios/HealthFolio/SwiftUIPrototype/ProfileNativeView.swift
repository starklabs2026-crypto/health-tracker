import SwiftUI

struct ProfileNativeView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var name = ""
    @State private var dateOfBirth = Date.now
    @State private var hasDateOfBirth = false
    @State private var sex = "Not set"
    @State private var bloodGroup = ""
    @State private var units = ""
    @State private var alias = ""
    @State private var signInEmail = ""
    @State private var password = ""
    @State private var isPasswordVisible = false
    @State private var noticeTitle = ""
    @State private var noticeMessage = ""
    @State private var isShowingNotice = false
    @State private var isSavingProfile = false
    @State private var pendingMergeProfile: HealthFolioProfile?
    @State private var isShowingMergeConfirmation = false
    @State private var isShowingDeleteAccount = false
    @State private var isShowingChangePassword = false
    @State private var savedDraft: ProfileEditorDraft?
    @State private var saveError: String?
    @State private var activeOperation: String?
    @State private var pendingAction: (() -> Void)?
    @State private var isShowingDiscardConfirmation = false
    @FocusState private var focusedField: ProfileEditorField?

    private let supportURL = URL(string: "https://starklabs2026-crypto.github.io/health-tracker/support/")!

    var body: some View {
        Form {
            accountSection
            profileSection
            profilesSection
            emailIngestionSection
            signInSection
            actionsSection
            privacyConsentSection
            supportSection
            signOutSection
            deleteAccountSection
        }
        .formStyle(.grouped)
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Profile & settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Close") { confirmDiscardIfNeeded { dismiss() } }
                    .disabled(isBusy)
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: save) {
                    if isSavingProfile {
                        ProgressView().accessibilityLabel("Saving profile")
                    } else {
                        Text("Save").bold()
                    }
                }
                .disabled(isBusy || !hasUnsavedChanges || validationMessage != nil)
                .accessibilityLabel(isSavingProfile ? "Saving profile" : "Save profile")
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focusedField = nil }
            }
        }
        .interactiveDismissDisabled(hasUnsavedChanges || isBusy)
        .onAppear {
            if savedDraft == nil { populateDraft() }
        }
        .onChange(of: model.profile) { _ in
            // Background refreshes and role changes must not replace an unfinished edit.
            if !hasUnsavedChanges && !isSavingProfile { populateDraft() }
        }
        .alert(noticeTitle, isPresented: $isShowingNotice) {
        } message: {
            Text(noticeMessage)
        }
        .confirmationDialog("Discard unsaved changes?", isPresented: $isShowingDiscardConfirmation, titleVisibility: .visible) {
            Button("Discard changes", role: .destructive) {
                let action = pendingAction
                pendingAction = nil
                populateDraft()
                action?()
            }
            Button("Keep editing", role: .cancel) { pendingAction = nil }
        } message: {
            Text("Your personal information and forwarding alias have not been saved.")
        }
        .confirmationDialog(
            "Merge this profile into Me?",
            isPresented: $isShowingMergeConfirmation,
            titleVisibility: .visible
        ) {
            if let source = pendingMergeProfile {
                Button("Merge \(source.displayName) into Me", role: .destructive) {
                    runOperation("Merge profile") { await mergeIntoPrimary(source) }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            if let source = pendingMergeProfile {
                Text("Documents, extracted readings, share/export references, and email-ingested duplicates for \(source.displayName) will move to your main profile. The duplicate profile will be hidden.")
            }
        }
        .sheet(isPresented: $isShowingDeleteAccount) {
            NavigationStack {
                AccountDeletionNativeView()
            }
            .environmentObject(model)
            .interactiveDismissDisabled(model.isDeletingAccount)
        }
        .sheet(isPresented: $isShowingChangePassword) {
            PasswordResetNativeView(
                title: "Change password",
                message: "Choose a new password with at least 8 characters. Your current session stays signed in.",
                navigationTitle: "Change password"
            )
            .environmentObject(model)
        }
    }

    private var cleanEmail: String {
        signInEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var accountSection: some View {
        Section {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "person.crop.circle.fill")
                    .font(.largeTitle)
                    .foregroundStyle(HealthFolioTheme.blue)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 5) {
                    Text(model.signedInProfile?.name ?? model.profile.name)
                        .font(.headline)
                    if model.isSignedIn {
                        Text(signedInEmailLabel)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                            .privacySensitive()
                    }
                    Label(model.isSignedIn ? "Signed in" : "On this device", systemImage: model.isSignedIn ? "checkmark.shield" : "iphone")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 6)
        } header: {
            Text("Account")
        } footer: {
            if let message = model.sessionMessage, model.isSignedIn, activeOperation == nil, !isSavingProfile {
                Text(message)
            }
        }
    }

    @ViewBuilder
    private var signInSection: some View {
        Section {
            if model.isSignedIn {
                Button {
                    isShowingChangePassword = true
                } label: {
                    Label("Change password", systemImage: "key")
                }
                .disabled(isBusy)
            } else {
                TextField("HealthFolio email", text: $signInEmail)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.username)
                    .focused($focusedField, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .password }
                    .disabled(isBusy)
                passwordField

                Button {
                    confirmDiscardIfNeeded {
                        runOperation("Sign in with password") {
                            await model.signIn(email: cleanEmail, password: password)
                            if model.isSignedIn { password = "" }
                        }
                    }
                } label: {
                    operationLabel("Sign in with password", systemImage: "person.crop.circle.badge.checkmark")
                }
                .disabled(isBusy || cleanEmail.isEmpty || password.isEmpty)

                Button {
                    runOperation("Email me a sign-in link") { await model.sendSignInLink(email: cleanEmail) }
                } label: {
                    operationLabel("Email me a sign-in link", systemImage: "envelope.badge")
                }
                .disabled(isBusy || cleanEmail.isEmpty)

                Button {
                    runOperation("Reset password") { await model.requestPasswordReset(email: cleanEmail) }
                } label: {
                    operationLabel("Reset password", systemImage: "key")
                }
                .disabled(isBusy || cleanEmail.isEmpty)

                Button {
                    confirmDiscardIfNeeded {
                        runOperation("Continue with Google") { await model.signInWithOAuth(provider: "google") }
                    }
                } label: {
                    operationLabel("Continue with Google", systemImage: "globe")
                }
                .disabled(isBusy)

                Button {
                    confirmDiscardIfNeeded {
                        runOperation("Continue with Apple") { await model.signInWithApple() }
                    }
                } label: {
                    operationLabel("Continue with Apple", systemImage: "apple.logo")
                }
                .disabled(isBusy)
            }
        } header: {
            Text("Security")
        } footer: {
            if !model.isSignedIn, let message = model.sessionMessage, activeOperation == nil {
                Text(message)
            }
        }
    }

    private var profilesSection: some View {
        Section("Family") {
            ForEach(model.availableProfiles) { profile in
                ProfileManagementRow(
                    profile: profile,
                    isSelected: model.profile.id == profile.id,
                    isBusy: isBusy || model.isLoadingData,
                    onSelect: {
                        confirmDiscardIfNeeded {
                            runOperation("Switch profile") {
                                await model.selectProfile(profile)
                                if model.profile.id != profile.id {
                                    showNotice(title: "Profile not switched", message: model.sessionMessage ?? "Please try again.")
                                }
                            }
                        }
                    },
                    onRoleChange: { role in
                        runOperation("Update family role") {
                            await model.updateFamilyRole(profile, role: role)
                            showNotice(title: "Family profile", message: model.sessionMessage ?? "Refresh to confirm the current role.")
                        }
                    },
                    onMergeIntoPrimary: {
                        confirmDiscardIfNeeded {
                            pendingMergeProfile = profile
                            isShowingMergeConfirmation = true
                        }
                    }
                )
            }
            if !model.availableProfiles.contains(where: { !$0.isPrimary }) {
                Label("No family profiles linked", systemImage: "person.2")
                    .foregroundStyle(.secondary)
            }
            if activeOperation == "Update family role" || activeOperation == "Merge profile" {
                operationLabel(activeOperation ?? "Family profile", systemImage: "person.2")
            }
        }
    }

    private var profileSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text("Name").font(.subheadline).foregroundStyle(.secondary)
                TextField("Name", text: $name, axis: .vertical)
                    .textContentType(.name)
                    .textInputAutocapitalization(.words)
                    .focused($focusedField, equals: .name)
                    .submitLabel(.done)
                    .onSubmit { focusedField = nil }
            }
            Toggle("Date of birth", isOn: $hasDateOfBirth)
            if hasDateOfBirth {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Date of birth")
                        DatePicker("Date of birth", selection: $dateOfBirth, in: ...Date.now, displayedComponents: .date)
                            .labelsHidden()
                            .accessibilityLabel("Date of birth")
                    }
                } else {
                    DatePicker("Date of birth", selection: $dateOfBirth, in: ...Date.now, displayedComponents: .date)
                }
            }
            Picker("Sex", selection: $sex) {
                Text("Not set").tag("Not set")
                Text("Female").tag("Female")
                Text("Male").tag("Male")
                Text("Other").tag("Other")
                if !["Not set", "Female", "Male", "Other"].contains(sex) {
                    Text(sex).tag(sex)
                }
            }
            Picker("Blood group", selection: $bloodGroup) {
                ForEach(bloodGroupOptions, id: \.self) { Text($0).tag($0) }
            }
            Picker("Units", selection: $units) {
                Text("Metric").tag("Metric")
                Text("US").tag("US")
            }
            if let message = validationMessage ?? saveError {
                Label(message, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if hasProfileConflict {
                Button {
                    confirmDiscardIfNeeded { populateDraft() }
                } label: {
                    Label("Reload saved profile", systemImage: "arrow.clockwise")
                }
            }
        } header: {
            Text("Personal information")
        } footer: {
            Text(hasUnsavedChanges ? "Unsaved changes for \(savedDraft?.name ?? model.profile.name)." : "Profile: \(model.profile.name)")
        }
        .disabled(isBusy)
    }

    private var emailIngestionSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text("Forwarding alias").font(.subheadline).foregroundStyle(.secondary)
                TextField("Forwarding alias", text: $alias)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.asciiCapable)
                    .focused($focusedField, equals: .alias)
                    .submitLabel(.done)
                    .onSubmit { focusedField = nil }
                    .disabled(isBusy)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Current forwarding address").font(.subheadline).foregroundStyle(.secondary)
                Text(model.profile.forwardingAddress)
                    .font(.body.monospaced())
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button(action: copyAddress) {
                Label("Copy forwarding address", systemImage: "doc.on.doc")
            }
        } header: {
            Text("Email ingestion")
        } footer: {
            if alias != savedDraft?.alias {
                Text("Alias changes are pending until this profile is saved.")
            }
        }
    }

    @ViewBuilder
    private var deleteAccountSection: some View {
        if model.isSignedIn {
            Section {
                Button(role: .destructive) {
                    confirmDiscardIfNeeded { isShowingDeleteAccount = true }
                } label: {
                    Label("Delete account and data", systemImage: "trash")
                }
                .disabled(isBusy || model.isDeletingAccount)
            } footer: {
                Text("Deleting your account permanently removes synced HealthFolio data, local care reminders, assistant chats, and the saved session on this device.")
            }
        }
    }

    private var privacyConsentSection: some View {
        Section {
            LabeledContent("Status", value: model.hasCurrentConsent ? "Current" : "Consent required")
            LabeledContent("Version", value: model.consentStatus.consentVersion ?? "Not yet recorded")
            LabeledContent("Accepted", value: consentAcceptedLabel)

            Link(destination: HealthFolioConsentPolicy.privacyURL) {
                Label("Privacy policy", systemImage: "shield")
            }

            Link(destination: HealthFolioConsentPolicy.privacyChoicesURL) {
                Label("Privacy choices", systemImage: "slider.horizontal.3")
            }

            Link(destination: HealthFolioConsentPolicy.standardEULAURL) {
                Label("Standard EULA", systemImage: "doc.text")
            }

        } header: {
            Text("Privacy & consent")
        } footer: {
            Text("Withdrawing consent requires account deletion because HealthFolio cannot operate without processing account and health data.")
        }
    }

    private var actionsSection: some View {
        Section("Records & sharing") {
            Button {
                runOperation("Refresh data") { await model.loadLiveData() }
            } label: {
                operationLabel("Refresh data", systemImage: "arrow.clockwise")
            }
            .disabled(isBusy)

            Button {
                runOperation("Export health summary") { await exportSummary() }
            } label: {
                operationLabel("Export health summary", systemImage: "square.and.arrow.up")
            }
            .disabled(!model.isSignedIn || isBusy)

            NavigationLink {
                DoctorShareNativeView()
            } label: {
                Label("Doctor share links", systemImage: "link")
            }
            .disabled(!model.isSignedIn || isBusy)
        }
    }

    private var supportSection: some View {
        Section("Support") {
            Link(destination: supportURL) {
                Label("Help & support", systemImage: "questionmark.circle")
            }
        }
    }

    private var signOutSection: some View {
        Section {
            Button(role: .destructive) {
                confirmDiscardIfNeeded {
                    runOperation(model.isSignedIn ? "Sign out" : "Reset local session") { await model.signOut() }
                }
            } label: {
                operationLabel(model.isSignedIn ? "Sign out" : "Reset local session", systemImage: "rectangle.portrait.and.arrow.right")
            }
            .disabled(isBusy)
        }
    }

    private var signedInEmailLabel: String {
        if let email = model.signedInProfile?.email, !email.isEmpty {
            return email
        }
        return model.profile.email
    }

    private var consentAcceptedLabel: String {
        guard let acceptedAt = model.consentStatus.acceptedAt else {
            return "Not yet recorded"
        }
        return acceptedAt.formatted(date: .abbreviated, time: .shortened)
    }

    private var passwordField: some View {
        HStack(spacing: 10) {
            Group {
                if isPasswordVisible {
                    TextField("Password", text: $password)
                } else {
                    SecureField("Password", text: $password)
                }
            }
            .textContentType(.password)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .privacySensitive()
            .focused($focusedField, equals: .password)
            .submitLabel(.done)
            .onSubmit { focusedField = nil }

            Button {
                isPasswordVisible.toggle()
            } label: {
                Label(isPasswordVisible ? "Hide password" : "Show password", systemImage: isPasswordVisible ? "eye.slash" : "eye")
                    .labelStyle(.iconOnly)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.borderless)
            .foregroundStyle(.secondary)
        }
        .disabled(isBusy)
    }

    private var currentDraft: ProfileEditorDraft {
        ProfileEditorDraft(profileID: savedDraft?.profileID ?? model.profile.id, name: name, dateOfBirth: hasDateOfBirth ? dateOfBirth : nil, sex: sex, bloodGroup: bloodGroup, units: units, alias: alias)
    }

    private var hasUnsavedChanges: Bool { savedDraft.map { currentDraft != $0 } ?? false }

    private var hasProfileConflict: Bool {
        guard let savedDraft, hasUnsavedChanges else { return false }
        let current = model.profile
        let latest = ProfileEditorDraft(
            profileID: current.id, name: current.name, dateOfBirth: current.dateOfBirth,
            sex: current.sex.isEmpty ? "Not set" : current.sex,
            bloodGroup: current.bloodGroup.isEmpty ? "Not set" : current.bloodGroup,
            units: current.units, alias: current.forwardingAlias
        )
        return savedDraft != latest
    }

    private var isBusy: Bool {
        isSavingProfile || activeOperation != nil || model.isSwitchingProfile || model.isMergingProfile
    }

    private var bloodGroupOptions: [String] {
        let options = ["Not set", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
        return options.contains(bloodGroup) ? options : options + [bloodGroup]
    }

    private var validationMessage: String? {
        guard let savedDraft else { return nil }
        if savedDraft.profileID != model.profile.id {
            return "The active profile changed. Your edits are retained; close and discard them before editing another profile."
        }
        if hasProfileConflict {
            return "This profile changed while you were editing. Reload its saved values before saving."
        }
        return hasUnsavedChanges ? currentDraft.validationMessage : nil
    }

    private func operationLabel(_ title: String, systemImage: String) -> some View {
        HStack {
            Label(title, systemImage: systemImage)
            Spacer(minLength: 8)
            if activeOperation == title {
                ProgressView().accessibilityLabel("\(title) in progress")
            }
        }
    }

    private func confirmDiscardIfNeeded(_ action: @escaping () -> Void) {
        guard !isBusy else { return }
        focusedField = nil
        if hasUnsavedChanges {
            pendingAction = action
            isShowingDiscardConfirmation = true
        } else {
            action()
        }
    }

    private func runOperation(_ title: String, action: @escaping @MainActor () async -> Void) {
        guard !isBusy else { return }
        focusedField = nil
        activeOperation = title
        Task { @MainActor in
            defer { activeOperation = nil }
            await action()
        }
    }

    private func populateDraft() {
        name = model.profile.name
        hasDateOfBirth = model.profile.dateOfBirth != nil
        dateOfBirth = model.profile.dateOfBirth ?? Date.now
        sex = model.profile.sex.isEmpty ? "Not set" : model.profile.sex
        bloodGroup = model.profile.bloodGroup.isEmpty ? "Not set" : model.profile.bloodGroup
        units = model.profile.units
        alias = model.profile.forwardingAlias
        savedDraft = ProfileEditorDraft(profileID: model.profile.id, name: name, dateOfBirth: model.profile.dateOfBirth, sex: sex, bloodGroup: bloodGroup, units: units, alias: alias)
        saveError = nil
        if signInEmail.isEmpty, model.isSignedIn, model.profile.email.contains("@") {
            signInEmail = model.profile.email
        }
    }

    private func save() {
        guard !isBusy, hasUnsavedChanges else { return }
        guard validationMessage == nil else {
            saveError = validationMessage
            return
        }
        focusedField = nil
        saveError = nil
        let submitted = currentDraft
        isSavingProfile = true
        Task { @MainActor in
            let saved = await model.updateProfile(
                name: submitted.name.trimmingCharacters(in: .whitespacesAndNewlines),
                dateOfBirth: submitted.dateOfBirth,
                sex: submitted.sex,
                bloodGroup: submitted.bloodGroup,
                units: submitted.units,
                alias: submitted.alias.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            )
            isSavingProfile = false
            if saved {
                savedDraft = submitted
                dismiss()
            } else {
                saveError = model.sessionMessage ?? "Your changes could not be saved. Please try again."
                showNotice(title: "Profile not saved", message: saveError ?? "Please try again.")
            }
        }
    }

    private func copyAddress() {
        UIPasteboard.general.string = model.profile.forwardingAddress
        showNotice(title: "Copied", message: "The current forwarding address was copied.")
    }

    private func exportSummary() async {
        do {
            let url = try await model.exportHealthSummaryURL()
            openURL(url)
        } catch {
            showNotice(title: "Export failed", message: (error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
        }
    }

    @MainActor
    private func mergeIntoPrimary(_ source: HealthFolioProfile) async {
        let target = model.availableProfiles.first(where: \.isPrimary) ?? model.signedInProfile ?? model.profile
        let merged = await model.mergeProfile(source, into: target)
        showNotice(
            title: merged ? "Profile merged" : "Profile not merged",
            message: model.sessionMessage ?? "Refresh and try again."
        )
    }

    private func showNotice(title: String, message: String) {
        noticeTitle = title
        noticeMessage = message
        isShowingNotice = true
    }
}

private enum ProfileEditorField: Hashable {
    case name, alias, email, password
}

private struct ProfileEditorDraft: Equatable {
    let profileID: String
    let name: String
    let dateOfBirth: Date?
    let sex: String
    let bloodGroup: String
    let units: String
    let alias: String

    var validationMessage: String? {
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "Enter a name." }
        if let dateOfBirth, dateOfBirth > Date.now { return "Date of birth cannot be in the future." }
        if !["Metric", "US"].contains(units) { return "Choose Metric or US units." }
        let cleanAlias = alias.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if cleanAlias.isEmpty { return "Enter a forwarding alias." }
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789-")
        if cleanAlias.unicodeScalars.contains(where: { !allowed.contains($0) }) || cleanAlias.hasPrefix("-") || cleanAlias.hasSuffix("-") || cleanAlias.contains("--") {
            return "Use letters, numbers, and single hyphens between words for the forwarding alias."
        }
        return nil
    }
}

private struct ProfileManagementRow: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    let profile: HealthFolioProfile
    let isSelected: Bool
    let isBusy: Bool
    let onSelect: () -> Void
    let onRoleChange: (FamilyProfileRole) -> Void
    let onMergeIntoPrimary: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                Button(action: onSelect) {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: profile.isPrimary ? "person.crop.circle" : "person.2")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(isSelected ? HealthFolioTheme.blue : .secondary)
                            .frame(width: 32)
                            .accessibilityHidden(true)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(profile.displayName)
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(subtitle)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .fixedSize(horizontal: false, vertical: true)

                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityValue(isSelected ? "Selected profile" : "")

                if model.isSwitchingProfile && isSelected {
                    ProgressView()
                        .controlSize(.small)
                        .accessibilityLabel("Switching profile")
                } else if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(HealthFolioTheme.blue)
                        .accessibilityHidden(true)
                }
            }
            .disabled(isBusy || isSelected)

            if !profile.isPrimary {
                Menu {
                    Section("Review") {
                        Button(role: .destructive) {
                            onMergeIntoPrimary()
                        } label: {
                            Label("Merge into Me", systemImage: "person.crop.circle.badge.arrow.forward")
                        }
                        .disabled(isBusy)
                    }

                    Section("Role") {
                        ForEach(FamilyProfileRole.editableCases) { role in
                            Button {
                                onRoleChange(role)
                            } label: {
                                Label(role.label, systemImage: role == profile.role ? "checkmark" : "person.badge.key")
                            }
                            .disabled(role == profile.role)
                        }
                    }
                } label: {
                    Label("Manage profile", systemImage: "ellipsis.circle")
                        .font(.subheadline)
                        .frame(minHeight: 44)
                }
                .disabled(isBusy)
                .accessibilityLabel("Manage \(profile.displayName)")
            }
        }
        .padding(.vertical, 4)
    }

    private var subtitle: String {
        if profile.isPrimary {
            return "Personal profile"
        }
        let status = profile.status.capitalized
        return "\(profile.role.detail) - \(status)"
    }
}

#Preview {
    NavigationStack {
        ProfileNativeView()
            .environmentObject(HealthFolioAppModel())
    }
}
