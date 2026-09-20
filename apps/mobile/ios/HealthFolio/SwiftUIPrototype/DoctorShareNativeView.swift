import SwiftUI

struct DoctorShareNativeView: View {
    @Environment(\.openURL) private var openURL
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var shares: [DoctorShareRecord] = []
    @State private var isLoading = false
    @State private var isShowingCreate = false
    @State private var noticeTitle = ""
    @State private var noticeMessage = ""
    @State private var isShowingNotice = false
    @State private var pendingOpenShare: DoctorShareRecord?
    @State private var pendingRevokeShare: DoctorShareRecord?

    private var activeShares: [DoctorShareRecord] {
        shares.filter(\.isActive)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HealthFolioTheme.spacing) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Doctor link")
                        .font(.largeTitle.bold())
                        .foregroundStyle(HealthFolioTheme.ink)
                    Text("Read-only, date-limited links for the active profile.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Button("New share link", systemImage: "plus", action: { isShowingCreate = true })
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!model.isSignedIn)

                NativeSectionHeader(title: "Links", systemImage: "link")
                if isLoading && shares.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 160)
                } else if activeShares.isEmpty {
                    EmptyDoctorSharesState()
                } else {
                    LazyVStack(spacing: 12) {
                        ForEach(activeShares) { share in
                            DoctorShareRow(
                                share: share,
                                onCopy: { copy(share) },
                                onOpen: { open(share) },
                                onRevoke: { pendingRevokeShare = share }
                            )
                        }
                    }
                }
            }
            .padding()
        }
        .background(HealthFolioTheme.background)
        .navigationTitle("Share")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("New share link", systemImage: "plus") {
                    isShowingCreate = true
                }
                .disabled(!model.isSignedIn)
            }
        }
        .refreshable {
            await loadShares()
        }
        .task {
            await loadShares()
        }
        .sheet(isPresented: $isShowingCreate) {
            NavigationStack {
                CreateDoctorShareView { request in
                    try await createShare(request)
                }
            }
        }
        .confirmationDialog(
            "Open single-use link?",
            isPresented: Binding(
                get: { pendingOpenShare != nil },
                set: { if !$0 { pendingOpenShare = nil } }
            ),
            presenting: pendingOpenShare
        ) { share in
            Button("Open preview", role: .destructive) {
                openURL(share.shareURL)
                pendingOpenShare = nil
            }
            Button("Cancel", role: .cancel) {
                pendingOpenShare = nil
            }
        } message: { _ in
            Text("Opening this preview may count as the one allowed use.")
        }
        .confirmationDialog(
            "Revoke share?",
            isPresented: Binding(
                get: { pendingRevokeShare != nil },
                set: { if !$0 { pendingRevokeShare = nil } }
            ),
            presenting: pendingRevokeShare
        ) { share in
            Button("Revoke", role: .destructive) {
                Task { await revoke(share) }
            }
            Button("Cancel", role: .cancel) {
                pendingRevokeShare = nil
            }
        } message: { _ in
            Text("The doctor will no longer be able to access this link.")
        }
        .alert(noticeTitle, isPresented: $isShowingNotice) {
        } message: {
            Text(noticeMessage)
        }
    }

    @MainActor
    private func loadShares() async {
        guard model.isSignedIn else {
            shares = []
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            shares = try await model.listDoctorShares()
        } catch {
            showNotice(title: "Could not load links", message: friendlyMessage(error))
        }
    }

    @MainActor
    private func createShare(_ request: CreateDoctorShareRequest) async throws {
        let share = try await model.createDoctorShare(
            dateRangeStart: request.dateRangeStart,
            dateRangeEnd: request.dateRangeEnd,
            expiry: request.expiry,
            singleUse: request.singleUse,
            customNote: request.customNote
        )
        shares.insert(share, at: 0)
        UIPasteboard.general.string = share.shareURL.absoluteString
        showNotice(title: "Share link created", message: "The link was copied. You can also share it again from the row.")
    }

    private func copy(_ share: DoctorShareRecord) {
        UIPasteboard.general.string = share.shareURL.absoluteString
        showNotice(title: "Copied", message: "The doctor-share link is ready to paste.")
    }

    private func open(_ share: DoctorShareRecord) {
        if share.singleUse {
            pendingOpenShare = share
            return
        }
        openURL(share.shareURL)
    }

    @MainActor
    private func revoke(_ share: DoctorShareRecord) async {
        do {
            try await model.revokeDoctorShare(id: share.id)
            shares.removeAll { $0.id == share.id }
            pendingRevokeShare = nil
        } catch {
            showNotice(title: "Revoke failed", message: friendlyMessage(error))
        }
    }

    private func showNotice(title: String, message: String) {
        noticeTitle = title
        noticeMessage = message
        isShowingNotice = true
    }

    private func friendlyMessage(_ error: Error) -> String {
        (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
}

private struct DoctorShareRow: View {
    let share: DoctorShareRecord
    let onCopy: () -> Void
    let onOpen: () -> Void
    let onRevoke: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("\(dateText(share.dateRangeStart)) - \(dateText(share.dateRangeEnd))")
                        .font(.headline)
                        .foregroundStyle(HealthFolioTheme.ink)
                    Text("Expires \(dateTimeText(share.expiresAt))")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if share.singleUse {
                    Label("Single-use", systemImage: "1.circle")
                        .font(.caption.bold())
                        .foregroundStyle(HealthFolioTheme.amber)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(HealthFolioTheme.amber.opacity(0.12), in: Capsule())
                }
            }

            Text(share.shareURL.absoluteString)
                .font(.footnote.monospaced())
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .textSelection(.enabled)

            LazyVGrid(columns: actionColumns, alignment: .leading, spacing: 8) {
                Button("Copy", systemImage: "doc.on.doc", action: onCopy)
                    .buttonStyle(.bordered)
                ShareLink(item: share.shareURL) {
                    Label("Share again", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.bordered)
                Button("Open", systemImage: "safari", action: onOpen)
                    .buttonStyle(.bordered)
                Button("Revoke", systemImage: "xmark.circle", role: .destructive, action: onRevoke)
                    .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius))
        .overlay {
            RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }

    private var actionColumns: [GridItem] {
        [
            GridItem(.flexible(), spacing: 8),
            GridItem(.flexible(), spacing: 8)
        ]
    }
}

private struct CreateDoctorShareRequest {
    let dateRangeStart: Date
    let dateRangeEnd: Date
    let expiry: NativeShareExpiry
    let singleUse: Bool
    let customNote: String
}

private struct CreateDoctorShareView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var dateRangeStart = Date()
    @State private var dateRangeEnd = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
    @State private var expiry = NativeShareExpiry.oneWeek
    @State private var singleUse = true
    @State private var customNote = ""
    @State private var isCreating = false
    @State private var errorMessage: String?

    let onCreate: (CreateDoctorShareRequest) async throws -> Void

    var body: some View {
        Form {
            Section("Date range") {
                DatePicker("From", selection: $dateRangeStart, displayedComponents: .date)
                DatePicker("To", selection: $dateRangeEnd, in: dateRangeStart..., displayedComponents: .date)
            }

            Section("Link") {
                Picker("Expiry", selection: $expiry) {
                    ForEach(NativeShareExpiry.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                Toggle("Single-use", isOn: $singleUse)
                TextField("Note for doctor", text: $customNote)
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Create share link")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel", action: dismiss.callAsFunction)
                    .disabled(isCreating)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button(isCreating ? "Creating" : "Create") {
                    Task { await create() }
                }
                .bold()
                .disabled(isCreating)
            }
        }
    }

    @MainActor
    private func create() async {
        errorMessage = nil
        isCreating = true
        defer { isCreating = false }
        do {
            try await onCreate(
                CreateDoctorShareRequest(
                    dateRangeStart: dateRangeStart,
                    dateRangeEnd: dateRangeEnd,
                    expiry: expiry,
                    singleUse: singleUse,
                    customNote: customNote
                )
            )
            dismiss()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}

private struct EmptyDoctorSharesState: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "link.badge.plus")
                .font(.title.weight(.semibold))
                .foregroundStyle(HealthFolioTheme.blue)
                .frame(width: 60, height: 60)
                .background(HealthFolioTheme.blueSoft, in: Circle())
            Text("No active share links")
                .font(.headline)
                .foregroundStyle(HealthFolioTheme.ink)
            Text("Create a date-limited read-only link when you need to send records to a clinician.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius))
    }
}

private func dateText(_ date: Date) -> String {
    date.formatted(.dateTime.month(.abbreviated).day().year())
}

private func dateTimeText(_ date: Date) -> String {
    date.formatted(.dateTime.month(.abbreviated).day().hour().minute())
}

#Preview {
    NavigationStack {
        DoctorShareNativeView()
            .environmentObject(HealthFolioAppModel())
    }
}
