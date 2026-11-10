import SwiftUI

struct AssistantSourceRoute: Hashable {
    let recordID: UUID
}

struct AssistantBubble: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let message: AssistantMessage
    let sourceRecords: [HealthRecord]

    private var isUser: Bool { message.role == .user }
    private var sources: [HealthRecord] {
        var seen = Set<UUID>()
        return sourceRecords.filter { seen.insert($0.id).inserted }
    }
    private var missingSourceCount: Int {
        Set(message.sourceRecordIds).subtracting(Set(sources.map(\.id))).count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            messageHeaderLayout {
                Text(isUser ? "You" : "HealthFolio")
                    .font(.subheadline.bold())
                if !dynamicTypeSize.isAccessibilitySize { Spacer(minLength: 8) }
                Text(message.createdAt, style: .time)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)

            Text(message.text)
                .font(.body)
                .lineSpacing(4)
                .foregroundStyle(HealthFolioTheme.ink)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(isUser ? HealthFolioTheme.blueSoft : HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 8))
                .contextMenu {
                    Button {
                        UIPasteboard.general.string = message.text
                    } label: {
                        Label("Copy message", systemImage: "doc.on.doc")
                    }
                }

            if !sources.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Sources (\(sources.count))")
                        .font(.subheadline.bold())
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 4)

                    ForEach(sources) { record in
                        NavigationLink(value: AssistantSourceRoute(recordID: record.id)) {
                            HStack(alignment: .center, spacing: 12) {
                                Image(systemName: record.category.symbol)
                                    .foregroundStyle(HealthFolioTheme.blue)
                                    .frame(width: 24)
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(record.title)
                                        .font(.subheadline.bold())
                                        .foregroundStyle(HealthFolioTheme.ink)
                                    Text(record.subtitle)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                                .fixedSize(horizontal: false, vertical: true)
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .accessibilityHidden(true)
                            }
                            .padding(.vertical, 12)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Opens the source health record")
                        Divider()
                    }
                }
            }

            if missingSourceCount > 0 {
                Label(
                    missingSourceCount == 1 ? "1 source is not loaded for this profile." : "\(missingSourceCount) sources are not loaded for this profile.",
                    systemImage: "doc.badge.clock"
                )
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var messageHeaderLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 8))
    }
}

#Preview {
    AssistantBubble(
        message: AssistantMessage(
            role: .assistant,
            text: "Most notable markers: Uric acid 7.6 mg/dL.",
            sources: HealthFolioPreviewData.records.prefix(1).map { $0 }
        ),
        sourceRecords: HealthFolioPreviewData.records.prefix(1).map { $0 }
    )
    .padding()
    .background(HealthFolioTheme.background)
}
