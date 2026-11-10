import Foundation

private func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else {
        fputs("FAIL: \(message)\n", stderr)
        exit(1)
    }
}

private func reading(
    _ id: String,
    _ value: Double?,
    day: Double = 0,
    unit: String? = "mg/dL",
    parameter: String = "glucose",
    low: Double? = nil,
    high: Double? = nil
) -> TrendChartData.Reading {
    TrendChartData.Reading(
        id: id,
        parameterId: parameter,
        value: value,
        unit: unit,
        recordedAt: Date(timeIntervalSince1970: 1_700_000_000 + day * 86_400),
        referenceLow: low,
        referenceHigh: high
    )
}

@main
struct TrendDataTestRunner {
    static func main() {
        let single = reading("single", 7.6, low: 3.5, high: 7.2)
        let singleton = TrendChartData(readings: [single], selected: single)
        expect(singleton.points.map(\.value) == [7.6], "one reading must produce exactly one actual value")
        expect(singleton.points.first?.recordedAt == single.recordedAt, "a single reading keeps its actual date")
        expect(singleton.direction == nil, "one reading cannot establish direction")
        expect(!singleton.canConnectPoints, "one reading must not become a line segment")
        expect(TrendChartData(readings: [], selected: single).points.isEmpty, "a selection must not create missing history")

        let invalid = [reading("nil", nil), reading("nan", .nan), reading("infinity", .infinity)]
        let noValues = TrendChartData(readings: invalid, selected: invalid[0])
        expect(noValues.points.isEmpty, "missing and nonfinite numbers must never become fallback values")
        expect(noValues.omittedValueCount == 3, "unplottable readings must be counted")
        let invalidDate = reading("bad-date", 1, day: .infinity)
        expect(TrendChartData(readings: [invalidDate], selected: invalidDate).points.isEmpty, "invalid dates must not reach a chart")

        let unordered = [reading("c", 3, day: 3), reading("a", 1, day: 1), reading("b", 2, day: 2)]
        let sorted = TrendChartData(readings: unordered, selected: unordered[0])
        expect(sorted.points.map(\.id) == ["a", "b", "c"], "readings must be oldest to newest")
        expect(sorted.direction == .increased, "increasing actual values must preserve direction")
        expect(sorted.canConnectPoints, "distinct chronological readings can be connected")
        let limited = TrendChartData(readings: unordered, selected: unordered[0], limit: 2)
        expect(limited.points.map(\.id) == ["b", "c"], "overview limits must keep the most recent readings")
        expect(limited.earlierReadingCount == 1, "truncated history must be disclosed")
        expect(TrendChartData(readings: unordered, selected: unordered[0], limit: 0).points.isEmpty, "a zero limit must be safe")
        expect(TrendChartData(readings: unordered, selected: unordered[0], limit: -1).points.isEmpty, "a negative limit must be safe")

        let mixed = [reading("old", 90, day: 1), reading("other-unit", 5, day: 2, unit: "mmol/L"),
                     reading("unknown", 99, day: 3, unit: nil), reading("latest", 100, day: 4, unit: " mg / dL "),
                     reading("other-marker", 42, day: 5, parameter: "iron")]
        let compatible = TrendChartData(readings: mixed, selected: mixed[3], limit: 2)
        expect(compatible.points.map(\.id) == ["old", "latest"], "filter units and parameter before limiting history")
        expect(compatible.omittedUnitCount == 2, "different and unknown units must be disclosed without counting other markers")
        let missingUnits = [reading("u1", 1, day: 1, unit: nil), reading("u2", 2, day: 2, unit: " ")]
        let unknown = TrendChartData(readings: missingUnits, selected: missingUnits[1])
        expect(unknown.points.map(\.id) == ["u2"], "unknown units do not establish compatibility between readings")
        expect(unknown.direction == nil, "unknown units must not imply a trend")
        expect(TrendChartData.normalizedUnit("\u{00b5}g / L") == "ug/L", "micro sign and spacing may be normalized")
        expect(TrendChartData.normalizedUnit("\u{03bc}g/L") == "ug/L", "Greek mu may be normalized")
        expect(TrendChartData.normalizedUnit("mIU/L") != TrendChartData.normalizedUnit("MIU/L"), "case-sensitive unit prefixes must not be conflated")

        expect(singleton.referenceBand == 3.5...7.2, "a complete finite reference interval should be retained")
        for bounds: (Double?, Double?) in [(8, 2), (2, 2), (nil, 2), (2, nil), (.nan, 2), (2, .infinity)] {
            let item = reading("range", 3, low: bounds.0, high: bounds.1)
            expect(TrendChartData(readings: [item], selected: item).referenceBand == nil, "invalid or incomplete bounds must not create a band")
        }
        let unknownRange = reading("range", 3, unit: nil, low: 1, high: 5)
        expect(TrendChartData(readings: [unknownRange], selected: unknownRange).referenceBand == nil, "unknown units must not create a reference band")

        let falling = [reading("early", 5, day: 1), reading("late", -2, day: 2)]
        expect(TrendChartData(readings: falling, selected: falling[1]).direction == .decreased, "negative values preserve descending direction")
        let steady = [reading("early", 0, day: 1), reading("late", 0, day: 2)]
        expect(TrendChartData(readings: steady, selected: steady[1]).direction == .unchanged, "equal values must not imply increase")
        let ties = [reading("b", 8), reading("a", 2)]
        let tied = TrendChartData(readings: ties, selected: ties[0])
        expect(tied.points.map(\.id) == ["a", "b"], "equal timestamps require deterministic ordering")
        expect(tied.direction == nil, "same-time readings cannot establish chronological direction")
        expect(!tied.canConnectPoints, "same-time readings must not produce an arbitrarily ordered line")
        let ambiguousLatest = [reading("early", 1, day: 1), reading("a", 2, day: 2), reading("b", 8, day: 2)]
        expect(TrendChartData(readings: ambiguousLatest, selected: ambiguousLatest[1]).direction == nil, "tied latest readings cannot choose a direction by ID")
        expect(TrendChartData(readings: [single, single], selected: single).points.count == 1, "repeated identities must not duplicate marks")

        let extremes = [-Double.greatestFiniteMagnitude, 0, Double.greatestFiniteMagnitude]
        let scale = TrendChartData.ValueScale(values: extremes)
        expect(scale.position(for: extremes[0]) == 0, "negative extremes remain at the lower edge")
        expect(scale.position(for: 0) == 0.5, "zero is the correct baseline for opposite extremes")
        expect(scale.position(for: extremes[2]) == 1, "positive extremes remain at the upper edge")
        for position in [0.0, 0.25, 0.5, 0.75, 1] {
            expect(scale.value(at: position).isFinite, "axis labels must not overflow")
        }
        let positive = TrendChartData.ValueScale(values: [2, 4])
        expect(positive.position(for: 2) == 0.5, "positive bars must encode magnitude from zero")
        let negative = TrendChartData.ValueScale(values: [-4, -2])
        expect(negative.position(for: 0) == 1, "negative bars must descend from zero")
        for values in [[], [0], [Double.leastNonzeroMagnitude], [.nan, .infinity]] {
            let safe = TrendChartData.ValueScale(values: values)
            expect(safe.position(for: 0).isFinite, "empty, zero, tiny and invalid domains must remain finite")
            expect(safe.value(at: 0).isFinite && safe.value(at: 1).isFinite, "domain bounds must remain finite")
        }
        expect(singleton.scale.value(at: 1) >= 7.6, "the scale must contain the actual reading")
        let insideRange = reading("inside", 4, low: 3, high: 8)
        let withRange = TrendChartData(readings: [insideRange], selected: insideRange)
        expect(withRange.scale.value(at: 1) == 8, "the scale must contain the valid reference band")
        print("HealthFolio trend data tests passed (fabrication, chronology, units, ranges, direction, overflow)")
    }
}

#if HEALTHFOLIO_TREND_VIEW_CHECK
import SwiftUI

// Compile-only fixtures isolate the real chart views from networking and profile UI.
@MainActor
final class HealthFolioAppModel: ObservableObject {
    var sessionMessage: String?
    var isSignedIn = false
    var latestMetrics: [HealthMetric] = []
    func metrics(for parameterId: String) -> [HealthMetric] { [] }
    func loadLiveData() async {}
}

struct ProfileSwitcherNativeView: View {
    var body: some View { EmptyView() }
}

enum HealthFolioPreviewData {
    static let metrics = [HealthMetric(name: "Glucose", value: "90 mg/dL", trend: "", status: .normal)]
}
#endif
