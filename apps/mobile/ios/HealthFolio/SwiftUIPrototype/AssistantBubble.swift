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

            messageBody
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
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(sources) { record in
                            NavigationLink(value: AssistantSourceRoute(recordID: record.id)) {
                                Text(sourceChipLabel(record))
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(HealthFolioTheme.ink)
                                    .lineLimit(1)
                                    .padding(.horizontal, 12)
                                    .frame(minHeight: 36)
                                    .background(HealthFolioTheme.blueSoft, in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(sourceChipLabel(record))
                            .accessibilityHint("Opens the source health record")
                        }
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

    private var messageBody: Text {
        guard !isUser, let attributed = try? AttributedString(
            markdown: message.text,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .full)
        ) else {
            return Text(message.text)
        }
        return Text(attributed)
    }

    private func sourceChipLabel(_ record: HealthRecord) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateFormat = "d MMM yyyy"
        let name = record.title.trimmingCharacters(in: .whitespacesAndNewlines)
        return "Source: \(name.isEmpty ? "Record" : name) · \(formatter.string(from: record.sourceDate))"
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
