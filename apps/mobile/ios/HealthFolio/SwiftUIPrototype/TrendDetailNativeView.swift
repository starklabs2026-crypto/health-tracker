import SwiftUI

struct TrendDetailNativeView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @EnvironmentObject private var model: HealthFolioAppModel
    let metric: HealthMetric

    private var history: [HealthMetric] {
        model.metrics(for: metric.parameterId).sorted {
            $0.recordedAt == $1.recordedAt ? $0.id.uuidString < $1.id.uuidString : $0.recordedAt > $1.recordedAt
        }
    }

    var body: some View {
        let readings = history
        let current = readings.first(where: { $0.id == metric.id && $0.recordedAt == readings.first?.recordedAt })
            ?? readings.first ?? metric
        let data = TrendChartData(readings: readings.map(\.chartReading), selected: current.chartReading)

        ScrollView {
            LazyVStack(alignment: .leading, spacing: HealthFolioTheme.spacing) {
                if !readings.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(current.name)
                            .font(.title2.bold())
                            .foregroundStyle(HealthFolioTheme.ink)
                        TrendReadingValue(metric: current)
                        Text(current.recordedAt, format: .dateTime.day().month(.abbreviated).year())
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        TrendSparkChart(data: data, detailed: true)

                        Divider()
                        LazyVGrid(
                            columns: Array(repeating: GridItem(.flexible(), alignment: .topLeading), count: dynamicTypeSize.isAccessibilitySize ? 1 : 2),
                            alignment: .leading,
                            spacing: 16
                        ) {
                            MarkerDetailCell(label: "Latest reference interval", value: data.referenceLabel ?? "Not available")
                            MarkerDetailCell(label: "Status", value: current.status.label.capitalized)
                            MarkerDetailCell(label: "Panel", value: current.panel ?? "Not recorded")
                            MarkerDetailCell(label: "Source", value: current.sourceTitle ?? "HealthFolio record")
                        }
                    }
                }

                Divider()
                NativeSectionHeader(title: "History", systemImage: "clock.arrow.circlepath")
                if readings.isEmpty {
                    EmptyRecordsState(searchText: "")
                } else {
                    ForEach(readings) { item in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(item.recordedAt, format: .dateTime.day().month(.abbreviated).year())
                                .font(.headline)
                            TrendReadingValue(metric: item)
                            Text(item.sourceTitle ?? "HealthFolio record")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            if TrendChartData.normalizedUnit(item.unit) != data.unit || (data.unit == nil && item.id != current.id) {
                                Label("Different or unknown unit", systemImage: "info.circle")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 20))
                        .overlay {
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(HealthFolioTheme.border, lineWidth: 1)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            .padding()
        }
        .background(HealthFolioTheme.background)
        .navigationTitle("Marker")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Done", action: dismiss.callAsFunction)
                    .frame(minWidth: 44, minHeight: 44)
            }
        }
    }
}

private struct MarkerDetailCell: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(HealthFolioTheme.ink)
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    NavigationStack {
        TrendDetailNativeView(metric: HealthFolioPreviewData.metrics[0])
            .environmentObject(HealthFolioAppModel())
    }
}
