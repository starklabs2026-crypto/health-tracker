import SwiftUI

struct RecordCard: View {
    let record: HealthRecord

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "doc.text")
                .font(.title3)
                .foregroundStyle(HealthFolioTheme.blue)
                .frame(width: 44, height: 44)
                .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 16))

            VStack(alignment: .leading, spacing: 4) {
                Text(record.title)
                    .font(.headline)
                    .foregroundStyle(HealthFolioTheme.ink)
                Text(record.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(record.status.label)
                    .font(.caption.bold())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(record.status.tint.opacity(0.12), in: Capsule())
                    .foregroundStyle(record.status.tint)
                Text(record.source)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(minHeight: 86)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }
}

#Preview {
    RecordCard(record: HealthFolioPreviewData.records[0])
        .padding()
        .background(HealthFolioTheme.background)
}
