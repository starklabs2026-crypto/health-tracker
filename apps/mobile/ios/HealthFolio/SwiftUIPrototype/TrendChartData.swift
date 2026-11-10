import Foundation

struct TrendChartData {
    struct Reading {
        let id: String
        let parameterId: String
        let value: Double?
        let unit: String?
        let recordedAt: Date
        let referenceLow: Double?
        let referenceHigh: Double?
    }

    struct Point: Identifiable {
        let id: String
        let value: Double
        let recordedAt: Date
    }

    enum Direction {
        case increased
        case decreased
        case unchanged
    }

    // Normalize before subtracting: two finite Double endpoints can have an infinite span.
    // The UI labels the original values, while plotting these bounded coordinates.
    struct ValueScale {
        private let magnitude: Double
        private let lower: Double
        private let upper: Double

        init(values: [Double]) {
            let finite = values.filter(\.isFinite)
            let largest = finite.map { abs($0) }.max() ?? 0
            magnitude = largest > 0 ? largest : 1
            lower = min(0, (finite.min() ?? 0) / magnitude)
            upper = largest > 0 ? max(0, (finite.max() ?? 0) / magnitude) : 1
        }

        func position(for value: Double) -> Double {
            guard value.isFinite else { return 0 }
            return min(1, max(0, (value / magnitude - lower) / (upper - lower)))
        }

        func value(at position: Double) -> Double {
            let fraction = position.isFinite ? min(1, max(0, position)) : 0
            return (lower * (1 - fraction) + upper * fraction) * magnitude
        }
    }

    let points: [Point]
    let unit: String?
    let referenceBand: ClosedRange<Double>?
    let omittedValueCount: Int
    let omittedUnitCount: Int
    let earlierReadingCount: Int
    let scale: ValueScale

    init(readings: [Reading], selected: Reading, limit: Int? = nil) {
        unit = Self.normalizedUnit(selected.unit)
        var invalidCount = 0
        var unitCount = 0
        var eligible: [Point] = []
        var seen: Set<String> = []

        for reading in readings where reading.parameterId == selected.parameterId {
            guard seen.insert(reading.id).inserted else { continue }
            guard let value = reading.value, value.isFinite,
                  reading.recordedAt.timeIntervalSince1970.isFinite else {
                invalidCount += 1
                continue
            }
            // An absent unit does not prove two readings are comparable.
            let compatible = unit.map { Self.normalizedUnit(reading.unit) == $0 }
                ?? (reading.id == selected.id)
            guard compatible else {
                unitCount += 1
                continue
            }
            eligible.append(Point(id: reading.id, value: value, recordedAt: reading.recordedAt))
        }

        eligible.sort {
            $0.recordedAt == $1.recordedAt ? $0.id < $1.id : $0.recordedAt < $1.recordedAt
        }
        points = limit.map { Array(eligible.suffix(max(0, $0))) } ?? eligible
        omittedValueCount = invalidCount
        omittedUnitCount = unitCount
        earlierReadingCount = eligible.count - points.count

        if !points.isEmpty, unit != nil,
           let low = selected.referenceLow, let high = selected.referenceHigh,
           low.isFinite, high.isFinite, low < high {
            referenceBand = low...high
        } else {
            referenceBand = nil
        }
        let bounds = referenceBand.map { [$0.lowerBound, $0.upperBound] } ?? []
        scale = ValueScale(values: points.map(\.value) + bounds)
    }

    var canConnectPoints: Bool {
        points.count > 1 && Set(points.map(\.recordedAt)).count == points.count
    }

    var direction: Direction? {
        guard let first = points.first, let last = points.last,
              first.recordedAt < last.recordedAt,
              points.filter({ $0.recordedAt == first.recordedAt }).count == 1,
              points.filter({ $0.recordedAt == last.recordedAt }).count == 1 else { return nil }
        if last.value > first.value { return .increased }
        if last.value < first.value { return .decreased }
        return .unchanged
    }

    static func normalizedUnit(_ unit: String?) -> String? {
        guard let unit else { return nil }
        let normalized = unit.components(separatedBy: .whitespacesAndNewlines).joined()
            .replacingOccurrences(of: "\u{00b5}", with: "u")
            .replacingOccurrences(of: "\u{03bc}", with: "u")
        return normalized.isEmpty ? nil : normalized
    }
}
