import Foundation

enum HealthFolioPreviewData {
    private static let marchReportDate = Calendar.current.date(from: DateComponents(year: 2026, month: 3, day: 22)) ?? Date.now
    private static let juneReportDate = Calendar.current.date(from: DateComponents(year: 2026, month: 6, day: 25)) ?? Date.now

    static let metrics = [
        HealthMetric(name: "Uric acid", value: "7.6 mg/dL", numericValue: 7.6, unit: "mg/dL", trend: "slightly above range", status: .attention, referenceRangeLabel: "3.5-7.2 mg/dL", referenceLow: 3.5, referenceHigh: 7.2, panel: "Metabolic panel", recordedAt: marchReportDate),
        HealthMetric(name: "HDL cholesterol", value: "38 mg/dL", numericValue: 38, unit: "mg/dL", trend: "slightly below range", status: .attention, referenceRangeLabel: "40-60 mg/dL", referenceLow: 40, referenceHigh: 60, panel: "Lipid panel", recordedAt: marchReportDate),
        HealthMetric(name: "HbA1c", value: "5.4%", numericValue: 5.4, unit: "%", trend: "stable in range", status: .normal, referenceRangeLabel: "4.0-5.6%", referenceLow: 4, referenceHigh: 5.6, panel: "Diabetes screening", recordedAt: juneReportDate),
        HealthMetric(name: "Serum iron", value: "144 ug/dL", numericValue: 144, unit: "ug/dL", trend: "in range", status: .normal, referenceRangeLabel: "60-170 ug/dL", referenceLow: 60, referenceHigh: 170, panel: "Iron studies", recordedAt: juneReportDate),
        HealthMetric(name: "Serum chloride", value: "108.6 mmol/L", numericValue: 108.6, unit: "mmol/L", trend: "slightly above range", status: .attention, referenceRangeLabel: "98-107 mmol/L", referenceLow: 98, referenceHigh: 107, panel: "Metabolic panel", recordedAt: marchReportDate),
        HealthMetric(name: "Ferritin", value: "147.8 ng/mL", numericValue: 147.8, unit: "ng/mL", trend: "stable in range", status: .normal, referenceRangeLabel: "30-400 ng/mL", referenceLow: 30, referenceHigh: 400, panel: "Iron studies", recordedAt: juneReportDate)
    ]

    static let records = [
        HealthRecord(
            title: "Blood work",
            subtitle: "Example Health Lab - 23 markers",
            score: 77,
            trust: 99,
            source: "PDF",
            category: .labReport,
            status: .ready,
            sourceDate: juneReportDate,
            valueCount: 23,
            flaggedCount: 4,
            fileName: "example-health-lab-results.pdf",
            notes: "Uric acid, serum chloride, and HDL cholesterol are marked for review.",
            metrics: metrics
        ),
        HealthRecord(
            title: "Chest X-ray",
            subtitle: "Sample imaging report - 1 finding",
            score: 84,
            trust: 96,
            source: "PDF",
            category: .imagingReport,
            status: .ready,
            sourceDate: marchReportDate,
            valueCount: 1,
            flaggedCount: 1,
            fileName: "chest-xray-report.pdf",
            notes: "No acute cardiopulmonary abnormality in the sample report. One radiology note is marked for manual review.",
            metrics: [
                HealthMetric(name: "Imaging finding", value: "1", trend: "review radiology note", status: .review, recordedAt: marchReportDate)
            ]
        ),
        HealthRecord(
            title: "Prescription",
            subtitle: "Vitamin D3 reminder source",
            score: 68,
            trust: 92,
            source: "Photo",
            category: .prescription,
            status: .ready,
            sourceDate: juneReportDate,
            valueCount: 1,
            flaggedCount: 0,
            fileName: "vitamin-d3-prescription.jpg",
            notes: "Vitamin D3 Uprise: 1 per week. Verify all prescription text before relying on it.",
            metrics: []
        ),
        HealthRecord(
            title: "Forwarded LIS report",
            subtitle: "Email ingestion - queued",
            score: 42,
            trust: 0,
            source: "Email",
            category: .labReport,
            status: .inProgress,
            sourceDate: Date.now,
            valueCount: 0,
            flaggedCount: 0,
            fileName: "forwarded-lab-report.pdf",
            notes: "Subject: Latest blood report\nForwarded email attachment: report.pdf",
            metrics: []
        )
    ]

    static let careItems = [
        CarePlanItem(
            kind: .medicine,
            title: "Vitamin D3 Uprise",
            detail: "1 per week",
            date: Date(),
            time: Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date(),
            sourceNote: "Vitamin D3 prescription"
        ),
        CarePlanItem(
            kind: .test,
            title: "Repeat uric acid",
            detail: "Follow-up lab",
            date: Date().addingTimeInterval(60 * 60 * 24 * 14),
            time: Calendar.current.date(bySettingHour: 8, minute: 30, second: 0, of: Date()) ?? Date(),
            linkedRecordTitle: "Blood work"
        )
    ]

    static let prompts = [
        AssistantPrompt(
            title: "Most concerning markers",
            body: "Show the flagged markers with source reports and dates."
        ),
        AssistantPrompt(
            title: "Latest imaging summary",
            body: "Summarize the latest X-ray or CT report from my records."
        )
    ]

    static let assistantMessages = [
        AssistantMessage(
            role: .assistant,
            text: "Ask about records, flagged markers, prescriptions, imaging, or recent changes. Answers stay grounded in your uploaded documents."
        ),
        AssistantMessage(
            role: .user,
            text: "Which results need my attention?"
        ),
        AssistantMessage(
            role: .assistant,
            text: "The latest example lab report has three readings marked for review: uric acid, HDL cholesterol, and serum chloride. Verify each value in the source PDF and discuss it with a qualified clinician if you have concerns.",
            sources: [records[0]]
        )
    ]

    static let profile = HealthFolioProfile(
        id: "demo-user",
        name: "Demo User",
        email: "demo.user@example.com",
        dateOfBirth: Calendar.current.date(from: DateComponents(year: 1998, month: 5, day: 14)) ?? Date.now,
        bloodGroup: "Not set",
        units: "Metric",
        forwardingAlias: "demo-user"
    )
}
