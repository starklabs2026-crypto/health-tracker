import SwiftUI
import Charts

struct TrendsNativeView: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var selectedMetric: HealthMetric?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: HealthFolioTheme.spacing) {
                ProfileSwitcherNativeView()

                if let sessionMessage = model.sessionMessage, !model.isSignedIn {
                    AuthRequiredCard(title: "Sign in to restore trends", message: sessionMessage)
                }

                NativeSectionHeader(title: "Signals", systemImage: "waveform.path.ecg")

                if model.latestMetrics.isEmpty {
                    EmptyRecordsState(searchText: "")
                } else {
                    ForEach(model.latestMetrics) { metric in
                        Button {
                            selectedMetric = metric
                        } label: {
                            TrendMetricCard(metric: metric, history: model.metrics(for: metric.parameterId))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(metric.name), \(metric.value), \(metric.status.label)")
                        .accessibilityHint("Opens reading history")
                    }
                }
            }
            .padding()
        }
        .background(HealthFolioTheme.background)
        .navigationTitle("Trends")
        .refreshable {
            await model.loadLiveData()
        }
        .sheet(item: $selectedMetric) { metric in
            NavigationStack {
                TrendDetailNativeView(metric: metric)
            }
            .presentationDetents([.large])
        }
    }
}

struct TrendMetricCard: View {
    let metric: HealthMetric
    let history: [HealthMetric]

    var body: some View {
        let data = TrendChartData(readings: history.map(\.chartReading), selected: metric.chartReading, limit: 12)

        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(metric.name)
                        .font(.headline)
                        .foregroundStyle(HealthFolioTheme.ink)
                    Text(metric.recordedAt, format: .dateTime.day().month(.abbreviated).year())
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
            }
            TrendReadingValue(metric: metric)
            TrendSparkChart(data: data)
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
        .contentShape(Rectangle())
    }
}

struct TrendReadingValue: View {
    let metric: HealthMetric

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(metric.value)
                    .font(.title3.bold())
                    .fixedSize()
                Spacer(minLength: 0)
                Text(metric.status.label.capitalized)
                    .font(.subheadline.bold())
                    .fixedSize()
                    .foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(metric.value)
                    .font(.title3.bold())
                    .fixedSize(horizontal: false, vertical: true)
                Text(metric.status.label.capitalized)
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(HealthFolioTheme.ink)
    }
}

struct TrendSparkChart: View {
    @ScaledMetric(relativeTo: .body) private var plotHeight = 148.0
    let data: TrendChartData
    var detailed = false

    private var labelPoints: [TrendChartData.Point] {
        guard let first = data.points.first, let last = data.points.last else { return [] }
        return first.id == last.id ? [first] : [first, last]
    }

    var body: some View {
        let connectPoints = detailed && data.canConnectPoints

        VStack(alignment: .leading, spacing: 8) {
            Text(data.readingSummary)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if data.points.isEmpty {
                Label("No numeric readings to chart", systemImage: "chart.bar.xaxis")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
            } else {
                Chart {
                    if let band = data.referenceBand {
                        RectangleMark(
                            yStart: .value("Reference lower bound", data.scale.position(for: band.lowerBound)),
                            yEnd: .value("Reference upper bound", data.scale.position(for: band.upperBound))
                        )
                        .foregroundStyle(Color.teal.opacity(0.12))
                        .accessibilityHidden(true)
                        RuleMark(y: .value("Reference lower bound", data.scale.position(for: band.lowerBound)))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                            .foregroundStyle(Color.teal.opacity(0.6))
                            .accessibilityHidden(true)
                        RuleMark(y: .value("Reference upper bound", data.scale.position(for: band.upperBound)))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                            .foregroundStyle(Color.teal.opacity(0.6))
                            .accessibilityHidden(true)
                    }

                    RuleMark(y: .value("Zero", data.scale.position(for: 0)))
                        .foregroundStyle(.secondary.opacity(0.4))
                        .accessibilityHidden(true)

                    ForEach(data.points) { point in
                        if detailed {
                            if connectPoints {
                                LineMark(
                                    x: .value("Date", point.recordedAt),
                                    y: .value("Value", data.scale.position(for: point.value))
                                )
                                .interpolationMethod(.linear)
                                .lineStyle(StrokeStyle(lineWidth: 2))
                                .foregroundStyle(HealthFolioTheme.blue)
                            }
                            PointMark(
                                x: .value("Date", point.recordedAt),
                                y: .value("Value", data.scale.position(for: point.value))
                            )
                            .symbolSize(40)
                            .foregroundStyle(HealthFolioTheme.blue)
                        } else {
                            BarMark(
                                x: .value("Reading", point.id),
                                yStart: .value("Zero", data.scale.position(for: 0)),
                                yEnd: .value("Value", data.scale.position(for: point.value)),
                                width: data.points.count == 1 ? .fixed(14) : .ratio(0.65)
                            )
                            .cornerRadius(2)
                            .foregroundStyle(HealthFolioTheme.blue.opacity(point.id == data.points.last?.id ? 1 : 0.65))
                            if point.value == 0 {
                                PointMark(x: .value("Reading", point.id), y: .value("Value", data.scale.position(for: 0)))
                                    .symbolSize(24)
                                    .foregroundStyle(HealthFolioTheme.blue)
                            }
                        }
                    }
                }
                .chartYScale(domain: 0...1, range: .plotDimension(padding: 8))
                .chartXScale(range: .plotDimension(padding: 12))
                .chartYAxis {
                    AxisMarks(position: .leading, values: [0.0, 0.5, 1.0]) { value in
                        AxisGridLine()
                        AxisValueLabel {
                            if let position = value.as(Double.self) {
                                Text(TrendChartData.formattedNumber(data.scale.value(at: position)))
                                    .font(.caption)
                            }
                        }
                    }
                }
                .chartXAxis {
                    if detailed {
                        AxisMarks(values: Array(Set(labelPoints.map(\.recordedAt))).sorted()) { value in
                            AxisValueLabel {
                                if let date = value.as(Date.self) {
                                    TrendAxisDate(date: date)
                                }
                            }
                        }
                    } else {
                        AxisMarks(values: labelPoints.map(\.id)) { value in
                            AxisValueLabel {
                                if let id = value.as(String.self), let point = labelPoints.first(where: { $0.id == id }) {
                                    TrendAxisDate(date: point.recordedAt)
                                }
                            }
                        }
                    }
                }
                .frame(height: detailed ? plotHeight * 1.5 : plotHeight)
                .accessibilityRepresentation {
                    VStack(alignment: .leading) {
                        ForEach(data.points) { point in
                            Text("\(point.recordedAt.formatted(.dateTime.day().month().year())), \(point.value.formatted()) \(data.unit ?? "unit not recorded")")
                        }
                    }
                }
            }

            if let reference = data.referenceLabel {
                Label("Latest reference: \(reference)", systemImage: "rectangle.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let direction = data.directionLabel {
                Text(direction)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if data.omittedUnitCount > 0 {
                Text("\(data.omittedUnitCount) readings with different or unknown units not charted.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if data.omittedValueCount > 0 {
                Text("\(data.omittedValueCount) readings without a valid number or date not charted.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

private struct TrendAxisDate: View {
    let date: Date

    var body: some View {
        VStack(spacing: 2) {
            Text(date, format: .dateTime.day().month(.abbreviated))
            Text(date, format: .dateTime.year())
        }
        .font(.caption)
    }
}

extension HealthMetric {
    var chartReading: TrendChartData.Reading {
        TrendChartData.Reading(
            id: id.uuidString,
            parameterId: parameterId,
            value: numericValue,
            unit: unit,
            recordedAt: recordedAt,
            referenceLow: referenceLow,
            referenceHigh: referenceHigh
        )
    }
}

extension TrendChartData {
    var readingSummary: String {
        let count = "\(points.count) numeric reading\(points.count == 1 ? "" : "s")"
        let prefix = earlierReadingCount > 0 ? "Latest \(count)" : count
        return "\(prefix) (\(unit ?? "unit not recorded"))"
    }

    var referenceLabel: String? {
        guard let referenceBand, let unit else { return nil }
        return "\(referenceBand.lowerBound) to \(referenceBand.upperBound) \(unit)"
    }

    var directionLabel: String? {
        switch direction {
        case .increased: return "Latest numeric value is higher than first shown"
        case .decreased: return "Latest numeric value is lower than first shown"
        case .unchanged: return "Latest numeric value is unchanged from first shown"
        case nil: return points.count == 1 ? "One reading; no trend yet" : nil
        }
    }

    static func formattedNumber(_ value: Double) -> String {
        if abs(value) >= 1_000_000 || (value != 0 && abs(value) < 0.001) {
            return value.formatted(.number.notation(.scientific).precision(.significantDigits(1...4)))
        }
        return value.formatted(.number.precision(.significantDigits(1...4)))
    }
}

#Preview {
    NavigationStack {
        TrendsNativeView()
            .environmentObject(HealthFolioAppModel())
    }
}
