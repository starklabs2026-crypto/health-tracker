import SwiftUI

struct MarkerRow: View {
    let metric: HealthMetric

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(metric.status.tint)
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 4) {
                Text(metric.name)
                    .font(.headline)
                Text(metric.trend)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let range = metric.referenceRangeLabel {
                    Text("Range \(range)")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 6) {
                Text(metric.value)
                    .font(.headline.bold())
                    .foregroundStyle(metric.status.tint)
                Text(metric.status.label)
                    .font(.caption.bold())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(metric.status.tint.opacity(0.12), in: Capsule())
                    .foregroundStyle(metric.status.tint)
            }
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 20))
        .overlay {
            RoundedRectangle(cornerRadius: 20)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }
}

#Preview {
    MarkerRow(metric: HealthFolioPreviewData.metrics[0])
        .padding()
        .background(HealthFolioTheme.background)
}
