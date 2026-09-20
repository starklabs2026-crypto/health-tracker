import SwiftUI

struct DocumentScoreCard: View {
    let record: HealthRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text("Score")
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.70))
                Spacer()
                Text(record.source)
                    .font(.caption.bold())
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(.white.opacity(0.12), in: Capsule())
                    .foregroundStyle(.white)
            }

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(record.score)")
                    .font(.system(size: 70, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("/100")
                    .font(.title2.bold())
                    .foregroundStyle(HealthFolioTheme.green)
            }

            HStack(spacing: 10) {
                MetricCapsule(label: "Values", value: "\(record.valueCount)", tint: HealthFolioTheme.blue)
                MetricCapsule(label: "Trust", value: "\(record.trust)%", tint: HealthFolioTheme.green)
                MetricCapsule(label: "Review", value: "\(record.flaggedCount)", tint: HealthFolioTheme.amber)
            }

            Text("This record score combines OCR status, extracted values, average trust, and values that need review. It is not a diagnosis.")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.72))
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 8) {
                ScoreFactorRow(label: "OCR", value: ocrFactor)
                ScoreFactorRow(label: "Values", value: "\(record.valueCount) extracted")
                ScoreFactorRow(label: "Trust", value: record.trust > 0 ? "\(record.trust)% average" : "Pending")
            }
        }
        .padding(20)
        .background(HealthFolioTheme.ink, in: RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius))
    }

    private var ocrFactor: String {
        if record.status == .failed { return "Needs attention" }
        if record.status == .inProgress { return "\(record.ocrProgress)% \(record.ocrStage ?? "processing")" }
        return "Ready"
    }
}

private struct ScoreFactorRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.66))
            Spacer()
            Text(value)
                .font(.caption.bold())
                .foregroundStyle(.white)
                .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    DocumentScoreCard(record: HealthFolioPreviewData.records[0])
        .padding()
        .background(HealthFolioTheme.background)
}
