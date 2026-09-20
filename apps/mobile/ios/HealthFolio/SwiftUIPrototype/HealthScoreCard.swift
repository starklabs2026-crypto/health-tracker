import SwiftUI

struct HealthScoreCard: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var isShowingInfo = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Health score")
                        .font(.headline)
                        .foregroundStyle(.white.opacity(0.82))
                    Text("Age-adjusted record signal")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.58))
                }

                Spacer()

                Button("Health score info", systemImage: "info.circle", action: showInfo)
                    .labelStyle(.iconOnly)
                    .foregroundStyle(HealthFolioTheme.green)
                    .frame(minWidth: 44, minHeight: 44)
            }

            HStack(spacing: 20) {
                HealthScoreRing(score: model.healthScore)

                VStack(spacing: 10) {
                    MetricCapsule(label: "Records", value: "\(model.records.count)", tint: HealthFolioTheme.blue)
                    MetricCapsule(label: "Markers", value: "\(model.latestMetrics.count)", tint: HealthFolioTheme.green)
                    MetricCapsule(label: "Flagged", value: "\(model.flaggedMetrics.count)", tint: HealthFolioTheme.amber)
                }
            }

            ProgressView(value: Double(model.healthScore), total: 100)
                .tint(HealthFolioTheme.green)
                .accessibilityLabel("Health score progress")
                .accessibilityValue("\(model.healthScore) out of 100")

            AgeComparisonRow(currentAge: model.chronologicalAge, reportAge: model.reportBasedAge)

            VStack(alignment: .leading, spacing: 10) {
                Text("Why this score")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white.opacity(0.82))
                ForEach(model.healthScoreReasons.prefix(3), id: \.self) { reason in
                    Label(reason, systemImage: "exclamationmark.circle")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.7))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            if !model.healthScoreGaps.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Gaps and feedback")
                        .font(.subheadline.bold())
                        .foregroundStyle(.white.opacity(0.82))
                    ForEach(model.healthScoreGaps.prefix(3), id: \.self) { gap in
                        Label(gap, systemImage: "plus.circle")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.68))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(20)
        .background {
            RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius)
                .fill(
                    LinearGradient(
                        colors: [HealthFolioTheme.inkSoft, HealthFolioTheme.ink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        }
        .accessibilityElement(children: .contain)
        .alert("Health score", isPresented: $isShowingInfo) {
        } message: {
            Text("This is an age-adjusted record signal based on available documents, extracted markers, OCR trust, and flagged values. It is not a diagnosis.")
        }
    }

    private func showInfo() {
        isShowingInfo = true
    }
}

private struct AgeComparisonRow: View {
    let currentAge: Int?
    let reportAge: Int?

    var body: some View {
        HStack(spacing: 10) {
            AgePill(title: "Current age", value: currentAge.map(String.init) ?? "Set DOB")
            AgePill(title: "Report-based age", value: reportAge.map(String.init) ?? "Need records")
        }
    }
}

private struct AgePill: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.56))
            Text(value)
                .font(.headline.bold())
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    HealthScoreCard()
        .padding()
        .background(HealthFolioTheme.background)
}
