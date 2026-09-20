import Foundation
import SwiftUI

struct HealthMetric: Identifiable, Hashable {
    enum Status: Hashable {
        case normal
        case attention
        case review

        var tint: Color {
            switch self {
            case .normal: HealthFolioTheme.green
            case .attention: HealthFolioTheme.amber
            case .review: HealthFolioTheme.blue
            }
        }

        var label: String {
            switch self {
            case .normal: "normal"
            case .attention: "review"
            case .review: "verify"
            }
        }
    }

    let id = UUID()
    let parameterId: String
    let recordId: UUID?
    let sourceTitle: String?
    let name: String
    let value: String
    let numericValue: Double?
    let unit: String?
    let trend: String
    let status: Status
    let referenceRangeLabel: String?
    let referenceLow: Double?
    let referenceHigh: Double?
    let panel: String?
    let recordedAt: Date

    init(
        parameterId: String? = nil,
        recordId: UUID? = nil,
        sourceTitle: String? = nil,
        name: String,
        value: String,
        numericValue: Double? = nil,
        unit: String? = nil,
        trend: String,
        status: Status,
        referenceRangeLabel: String? = nil,
        referenceLow: Double? = nil,
        referenceHigh: Double? = nil,
        panel: String? = nil,
        recordedAt: Date = Date.now
    ) {
        self.parameterId = parameterId ?? name.lowercased().replacingOccurrences(of: " ", with: "-")
        self.recordId = recordId
        self.sourceTitle = sourceTitle
        self.name = name
        self.value = value
        self.numericValue = numericValue
        self.unit = unit
        self.trend = trend
        self.status = status
        self.referenceRangeLabel = referenceRangeLabel
        self.referenceLow = referenceLow
        self.referenceHigh = referenceHigh
        self.panel = panel
        self.recordedAt = recordedAt
    }
}
