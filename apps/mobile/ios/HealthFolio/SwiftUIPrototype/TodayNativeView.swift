import SwiftUI

struct TodayNativeView: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    @Binding var selectedTab: HealthFolioTab
    @State private var isShowingProfile = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HealthFolioTheme.spacing) {
                HStack {
                    Text("Today")
                        .font(.largeTitle.bold())
                    Spacer()
                    Button("Profile", systemImage: "person.crop.circle", action: openProfile)
                        .labelStyle(.iconOnly)
                        .font(.title2)
                        .frame(minWidth: 44, minHeight: 44)
                }

                ProfileSwitcherNativeView()

                if model.isSignedIn {
                    HealthScoreCard()
                }

                TodayProfileContextCard(openProfile: openProfile)

                if let sessionMessage = model.sessionMessage, !model.isSignedIn {
                    AuthRequiredCard(
                        title: "Sign in to sync records",
                        message: sessionMessage
                    )
                }

                if model.latestMetrics.isEmpty, model.isSignedIn {
                    AuthRequiredCard(
                        title: "No markers yet",
                        message: "Upload a report or switch profiles to view extracted markers."
                    )
                } else {
                    VStack(spacing: 10) {
                        ForEach(model.latestMetrics.prefix(4)) { metric in
                            MarkerRow(metric: metric)
                        }
                    }
                }

                NativeSectionHeader(title: "Next", systemImage: "target")
                NextActionCard(reviewCount: max(model.flaggedMetrics.count, model.inProgressCount), action: openRecords)
            }
            .padding()
            .padding(.bottom, 96)
        }
        .background(HealthFolioTheme.background)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            await model.loadLiveData()
        }
        .sheet(isPresented: $isShowingProfile) {
            NavigationStack {
                ProfileNativeView()
            }
            .presentationDetents([.large])
        }
    }

    private func openProfile() {
        isShowingProfile = true
    }

    private func openRecords() {
        selectedTab = .records
    }

}

private struct TodayProfileContextCard: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    let openProfile: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: model.profile.isPrimary ? "person.crop.circle" : "person.2")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(HealthFolioTheme.blue)
                    .frame(width: 42, height: 42)
                    .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 4) {
                    Text(displayName)
                        .font(.headline)
                    Text(profileSubtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                Button("Manage", systemImage: "slider.horizontal.3", action: openProfile)
                    .labelStyle(.iconOnly)
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityLabel("Manage profiles")
            }

            HStack(spacing: 8) {
                TodayProfileMetric(label: "Records", value: "\(model.records.count)")
                TodayProfileMetric(label: "Markers", value: "\(model.latestMetrics.count)")
                TodayProfileMetric(label: "Role", value: model.isSignedIn ? model.profile.relationshipLabel : "Locked")
            }
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }

    private var profileSubtitle: String {
        guard model.isSignedIn else {
            return "Sign in to load profile context"
        }
        if model.availableProfiles.count > 1 {
            return "Selected profile for Today, Records, Trends, Assistant, and uploads"
        }
        return "Personal record context"
    }

    private var displayName: String {
        model.isSignedIn ? model.profile.displayName : "Profile context"
    }
}

private struct TodayProfileMetric: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption.bold())
                .foregroundStyle(HealthFolioTheme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.78)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct EmailIngestionStatusCard: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    let didCopyForwardingAddress: Bool
    let copyForwardingAddress: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "tray.and.arrow.down")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(HealthFolioTheme.green)
                    .frame(width: 42, height: 42)
                    .background(HealthFolioTheme.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 4) {
                    Text("Email ingestion")
                        .font(.headline)
                    Text("Forward reports for \(model.profile.displayName)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                Button("Copy", systemImage: didCopyForwardingAddress ? "checkmark" : "doc.on.doc", action: copyForwardingAddress)
                    .labelStyle(.iconOnly)
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityLabel(didCopyForwardingAddress ? "Forwarding address copied" : "Copy forwarding address")
            }

            Text(model.profile.forwardingAddress)
                .font(.footnote.monospaced())
                .foregroundStyle(HealthFolioTheme.ink)
                .textSelection(.enabled)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(HealthFolioTheme.background, in: RoundedRectangle(cornerRadius: 12))

            if let latest = model.latestEmailIngestionRecord {
                EmailIngestionRecordRow(record: latest)
            } else {
                Text("No forwarded documents have been received for this profile yet. Forwarded attachments appear here after HealthFolio creates document rows.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if !model.emailIngestionRecords.isEmpty {
                Text("\(model.emailIngestionRecords.count) forwarded document\(model.emailIngestionRecords.count == 1 ? "" : "s") in this profile")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }
}

private struct EmailIngestionRecordRow: View {
    let record: HealthRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: record.status.symbol)
                    .foregroundStyle(record.status.tint)
                    .frame(width: 28, height: 28)

                VStack(alignment: .leading, spacing: 3) {
                    Text(record.title)
                        .font(.subheadline.bold())
                    Text(statusLine)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)
            }

            if record.status == .inProgress {
                ProgressView(value: Double(record.ocrProgress), total: 100)
                    .tint(HealthFolioTheme.blue)
            }
        }
        .padding(10)
        .background(HealthFolioTheme.background, in: RoundedRectangle(cornerRadius: 14))
    }

    private var statusLine: String {
        var pieces = [
            record.status.label,
            record.sourceDate.formatted(date: .abbreviated, time: .omitted)
        ]
        if let stage = record.ocrStage, !stage.isEmpty {
            pieces.append(stage.replacingOccurrences(of: "_", with: " "))
        }
        if record.emailIngestKey?.isEmpty == false {
            pieces.append("email linked")
        }
        return pieces.joined(separator: " - ")
    }
}

#Preview {
    NavigationStack {
        TodayNativeView(selectedTab: .constant(.today))
            .environmentObject(HealthFolioAppModel())
    }
}
