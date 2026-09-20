import SwiftUI

enum HealthRecordKind: String, CaseIterable, Identifiable, Hashable {
    case all
    case labReport
    case prescription
    case imagingReport
    case dischargeSummary
    case vaccinationRecord
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "All"
        case .labReport: "Blood"
        case .prescription: "Prescriptions"
        case .imagingReport: "Imaging"
        case .dischargeSummary: "Surgery"
        case .vaccinationRecord: "Vaccines"
        case .other: "Other reports"
        }
    }

    var fullLabel: String {
        switch self {
        case .all: "All records"
        case .labReport: "Blood reports"
        case .prescription: "Prescriptions"
        case .imagingReport: "X-ray / CT / MRI"
        case .dischargeSummary: "Surgery"
        case .vaccinationRecord: "Vaccination"
        case .other: "Other reports"
        }
    }

    var symbol: String {
        switch self {
        case .all: "tray.full"
        case .labReport: "drop"
        case .prescription: "pills"
        case .imagingReport: "waveform.path.ecg.rectangle"
        case .dischargeSummary: "cross.case"
        case .vaccinationRecord: "syringe"
        case .other: "doc.text"
        }
    }
}
