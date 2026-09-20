import SwiftUI

struct RecordsNativeView: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var searchText = ""
    @State private var selectedCategory = HealthRecordKind.all
    @State private var selectedStatus = NativeRecordStatus.all
    @State private var isShowingUpload = false

    private var records: [HealthRecord] {
        model.filteredRecords(searchText: searchText, category: selectedCategory, status: selectedStatus)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HealthFolioTheme.spacing) {
                ProfileSwitcherNativeView()

                if let sessionMessage = model.sessionMessage, !model.isSignedIn {
                    AuthRequiredCard(
                        title: "Sign in to restore records",
                        message: sessionMessage
                    )
                }

                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(HealthRecordKind.allCases) { category in
                            RecordsFilterChip(
                                title: category.label,
                                systemImage: category.symbol,
                                isSelected: selectedCategory == category,
                                tint: HealthFolioTheme.blue,
                                action: { selectedCategory = category }
                            )
                        }
                    }
                    .padding(.vertical, 2)
                }
                .scrollIndicators(.hidden)

                HStack(spacing: 8) {
                    StatusDot(label: "\(model.readyCount) ready", tint: HealthFolioTheme.green)
                    StatusDot(label: "\(model.inProgressCount) reading", tint: HealthFolioTheme.blue)
                    StatusDot(label: "\(model.failedCount) failed", tint: .red)
                }

                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(NativeRecordStatus.allCases) { status in
                            RecordsFilterChip(
                                title: status.label,
                                systemImage: nil,
                                isSelected: selectedStatus == status,
                                tint: status.tint,
                                action: { selectedStatus = status }
                            )
                        }
                    }
                    .padding(.vertical, 2)
                }
                .scrollIndicators(.hidden)

                if records.isEmpty {
                    EmptyRecordsState(searchText: searchText)
                } else {
                    LazyVStack(spacing: 12) {
                        ForEach(records) { record in
                            NavigationLink(value: record) {
                            RecordCard(record: record)
                        }
                        .buttonStyle(.plain)
                        }
                    }
                }

                Text(records.count == model.records.count ? "\(model.records.count) documents" : "\(records.count) of \(model.records.count) shown")
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
            }
            .padding()
        }
        .background(HealthFolioTheme.background)
        .navigationTitle("Records")
        .refreshable {
            await model.loadLiveData()
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add record", systemImage: "plus", action: showUpload)
            }
        }
        .searchable(text: $searchText, prompt: "Search reports")
        .navigationDestination(for: HealthRecord.self) { record in
            DocumentDetailNativeView(record: record)
        }
        .onAppear(perform: openFirstLaunchUploadIfNeeded)
        .onChange(of: model.shouldOpenFirstLaunchUpload) { _ in
            openFirstLaunchUploadIfNeeded()
        }
        .sheet(isPresented: $isShowingUpload) {
            NavigationStack {
                UploadRecordsNativeView()
            }
            .presentationDetents([.large])
        }
    }

    private func showUpload() {
        isShowingUpload = true
    }

    private func openFirstLaunchUploadIfNeeded() {
        guard model.shouldOpenFirstLaunchUpload else { return }
        model.consumeFirstLaunchUploadRequest()
        isShowingUpload = true
    }
}

private struct RecordsFilterChip: View {
    let title: String
    let systemImage: String?
    let isSelected: Bool
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label {
                Text(title)
            } icon: {
                if let systemImage {
                    Image(systemName: systemImage)
                }
            }
            .font(.subheadline.bold())
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .foregroundStyle(isSelected ? tint : HealthFolioTheme.ink)
            .background(isSelected ? tint.opacity(0.12) : HealthFolioTheme.card, in: Capsule())
            .overlay {
                Capsule().stroke(isSelected ? tint.opacity(0.45) : HealthFolioTheme.border, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct StatusDot: View {
    let label: String
    let tint: Color

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(tint)
                .frame(width: 8, height: 8)
            Text(label)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    NavigationStack {
        RecordsNativeView()
            .environmentObject(HealthFolioAppModel())
    }
}
