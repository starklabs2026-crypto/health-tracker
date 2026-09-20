import SwiftUI

struct CarePlanRow: View {
    let item: CarePlanItem
    let linkedRecord: HealthRecord?
    let onToggleDone: () -> Void
    let onDelete: () -> Void

    private var dueState: CarePlanDueState {
        item.dueState()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                Image(systemName: item.kind.symbol)
                    .foregroundStyle(dueState.tint)
                    .frame(width: 44, height: 44)
                    .background(dueState.tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.headline)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Label(dueState.label, systemImage: dueState.symbol)
                        .font(.caption.bold())
                        .foregroundStyle(dueState.tint)
                    Text(item.dueAt(), format: .dateTime.month(.abbreviated).day().hour().minute())
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if let sourceLabel {
                Label(sourceLabel, systemImage: linkedRecord?.category.symbol ?? "doc.text")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack(spacing: 10) {
                Button(item.isCompleted ? "Mark due" : "Mark done", systemImage: item.isCompleted ? "arrow.uturn.backward.circle" : "checkmark.circle", action: onToggleDone)
                    .buttonStyle(.bordered)

                if let linkedRecord {
                    NavigationLink(value: linkedRecord) {
                        Label("Open source", systemImage: "doc.text.magnifyingglass")
                    }
                    .buttonStyle(.bordered)
                }

                Spacer()

                Button("Delete", systemImage: "trash", role: .destructive, action: onDelete)
                    .buttonStyle(.bordered)
                    .labelStyle(.iconOnly)
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityHint("Removes this care reminder")
            }
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
    }

    private var subtitle: String {
        [item.kind.rowTitle, item.detail]
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .joined(separator: " - ")
    }

    private var sourceLabel: String? {
        if let linkedRecord {
            return "Linked to \(linkedRecord.title)"
        }

        let sourceNote = item.sourceNote.trimmingCharacters(in: .whitespacesAndNewlines)
        return sourceNote.isEmpty ? nil : sourceNote
    }
}

#Preview {
    CarePlanRow(
        item: HealthFolioPreviewData.careItems[0],
        linkedRecord: HealthFolioPreviewData.records[2],
        onToggleDone: {},
        onDelete: {}
    )
        .padding()
        .background(HealthFolioTheme.background)
}
