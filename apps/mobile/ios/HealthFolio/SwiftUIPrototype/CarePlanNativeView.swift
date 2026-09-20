import SwiftUI

struct CarePlanNativeView: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var selectedKind = CarePlanKind.medicine
    @State private var title = ""
    @State private var dosage = ""
    @State private var timing = "After food"
    @State private var details = ""
    @State private var sourceNote = ""
    @State private var selectedRecordId: UUID?
    @State private var date = Date.now
    @State private var time = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date.now) ?? Date.now
    @State private var isSaving = false
    @State private var statusMessage: String?
    @State private var reminderPendingDeletion: CarePlanItem?
    @State private var isShowingDeleteConfirmation = false

    private var linkableRecords: [HealthRecord] {
        model.linkableCareRecords(for: selectedKind)
    }

    private var medicineItems: [CarePlanItem] {
        model.sortedCareItems.filter { $0.kind == .medicine }
    }

    private var careShareText: String {
        model.careSummaryShareText()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HealthFolioTheme.spacing) {
                CareSummaryCard(
                    medicineCount: model.medicineReminderCount,
                    followUpCount: model.followUpReminderCount,
                    dueTodayCount: model.dueTodayReminderCount,
                    shareText: careShareText
                )

                CareReminderFormView(
                    selectedKind: $selectedKind,
                    title: $title,
                    dosage: $dosage,
                    timing: $timing,
                    details: $details,
                    sourceNote: $sourceNote,
                    selectedRecordId: $selectedRecordId,
                    date: $date,
                    time: $time,
                    linkableRecords: linkableRecords,
                    statusMessage: statusMessage,
                    isSaving: isSaving,
                    saveAction: saveReminder
                )

                if !medicineItems.isEmpty {
                    MedicineSummaryTable(items: medicineItems)
                }

                NativeSectionHeader(title: "Upcoming", systemImage: "clock")

                CareReminderListView(
                    items: model.sortedCareItems,
                    records: model.records,
                    toggleAction: toggleDone,
                    deleteAction: confirmDelete
                )
            }
            .padding()
        }
        .background(HealthFolioTheme.background)
        .navigationTitle("Care plan")
        .navigationDestination(for: HealthRecord.self) { record in
            DocumentDetailNativeView(record: record)
        }
        .confirmationDialog(
            "Remove reminder?",
            isPresented: $isShowingDeleteConfirmation,
            titleVisibility: .visible,
            presenting: reminderPendingDeletion
        ) { item in
            Button("Remove \(item.title)", role: .destructive) {
                removeReminder(item)
            }
            Button("Cancel", role: .cancel) {
                reminderPendingDeletion = nil
            }
        } message: { item in
            Text("This cancels the scheduled notification for \(item.title).")
        }
        .onChange(of: selectedKind) { _ in
            resetInvalidLinkedRecord()
        }
    }

    private func saveReminder() {
        guard !isSaving else { return }
        isSaving = true
        statusMessage = nil

        let linkedRecord = model.record(with: selectedRecordId)
        Task {
            let result = await model.addCareReminder(
                kind: selectedKind,
                title: title,
                detail: reminderDetail,
                date: date,
                time: time,
                sourceNote: sourceNote,
                linkedRecord: linkedRecord
            )

            statusMessage = result.message
            isSaving = false

            if result != .missingTitle {
                resetForm()
            }
        }
    }

    private func resetForm() {
        selectedKind = .medicine
        title = ""
        dosage = ""
        timing = "After food"
        details = ""
        sourceNote = ""
        selectedRecordId = nil
        date = Date.now
        time = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: Date.now) ?? Date.now
    }

    private func resetInvalidLinkedRecord() {
        guard let selectedRecordId else { return }
        if !linkableRecords.contains(where: { $0.id == selectedRecordId }) {
            self.selectedRecordId = nil
        }
    }

    private var reminderDetail: String {
        if selectedKind == .medicine {
            return [dosage.trimmingCharacters(in: .whitespacesAndNewlines), timing, details.trimmingCharacters(in: .whitespacesAndNewlines)]
                .filter { !$0.isEmpty }
                .joined(separator: " - ")
        }
        return details
    }

    private func toggleDone(_ item: CarePlanItem) {
        Task {
            if let result = await model.toggleCareReminderCompletion(id: item.id) {
                statusMessage = result.message
            }
        }
    }

    private func confirmDelete(_ item: CarePlanItem) {
        reminderPendingDeletion = item
        isShowingDeleteConfirmation = true
    }

    private func removeReminder(_ item: CarePlanItem) {
        Task {
            await model.removeCareReminder(id: item.id)
            statusMessage = "Reminder removed and notification cancelled."
            reminderPendingDeletion = nil
        }
    }
}

private struct CareReminderFormView: View {
    @Binding var selectedKind: CarePlanKind
    @Binding var title: String
    @Binding var dosage: String
    @Binding var timing: String
    @Binding var details: String
    @Binding var sourceNote: String
    @Binding var selectedRecordId: UUID?
    @Binding var date: Date
    @Binding var time: Date

    let linkableRecords: [HealthRecord]
    let statusMessage: String?
    let isSaving: Bool
    let saveAction: () -> Void

    private let timingOptions = ["Before food", "After food", "With food", "Bedtime", "As needed"]

    var body: some View {
        VStack(spacing: 14) {
            NativeSectionHeader(title: "Add reminder", systemImage: "bell")

            Picker("Reminder type", selection: $selectedKind) {
                ForEach(CarePlanKind.allCases) { kind in
                    Text(kind.label).tag(kind)
                }
            }
            .pickerStyle(.segmented)

            if selectedKind == .medicine {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Medicine name", text: $title)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.words)

                    TextField("Dosage, e.g. 500 mg", text: $dosage)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)

                    Picker("Timing", selection: $timing) {
                        ForEach(timingOptions, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                    .pickerStyle(.menu)

                    TextField("Instructions, e.g. twice daily", text: $details, axis: .vertical)
                        .lineLimit(2...4)
                        .textFieldStyle(.roundedBorder)
                }
                .padding()
                .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 18))
            } else {
                TextField(selectedKind.inputLabel, text: $title)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.words)
                    .accessibilityLabel(selectedKind.inputLabel)

                TextField("Details", text: $details, axis: .vertical)
                    .lineLimit(2...4)
                    .textFieldStyle(.roundedBorder)
            }

            DatePicker("Date", selection: $date, in: Date.now..., displayedComponents: .date)
            DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)

            TextField("Source note", text: $sourceNote, axis: .vertical)
                .lineLimit(2...3)
                .textFieldStyle(.roundedBorder)

            RecordLinkPicker(linkableRecords: linkableRecords, selectedRecordId: $selectedRecordId)

            if let statusMessage {
                Label(statusMessage, systemImage: "bell.badge")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(isSaving ? "Saving" : "Save reminder", systemImage: "checkmark.circle.fill", action: saveAction)
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isSaving)
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius))
    }
}

private struct RecordLinkPicker: View {
    let linkableRecords: [HealthRecord]
    @Binding var selectedRecordId: UUID?

    var body: some View {
        if linkableRecords.isEmpty {
            Label("Upload a prescription, lab, imaging report, or doctor note to link it here.", systemImage: "doc.badge.plus")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Picker("Linked record", selection: $selectedRecordId) {
                Text("No linked record").tag(nil as UUID?)
                ForEach(linkableRecords) { record in
                    Text(record.title).tag(Optional(record.id))
                }
            }
        }
    }
}

private struct CareReminderListView: View {
    let items: [CarePlanItem]
    let records: [HealthRecord]
    let toggleAction: (CarePlanItem) -> Void
    let deleteAction: (CarePlanItem) -> Void

    var body: some View {
        if items.isEmpty {
            EmptyCareReminderState()
        } else {
            LazyVStack(spacing: 12) {
                ForEach(items) { item in
                    CarePlanRow(
                        item: item,
                        linkedRecord: linkedRecord(for: item),
                        onToggleDone: { toggleAction(item) },
                        onDelete: { deleteAction(item) }
                    )
                }
            }
        }
    }

    private func linkedRecord(for item: CarePlanItem) -> HealthRecord? {
        guard let linkedRecordId = item.linkedRecordId else { return nil }
        return records.first { $0.id == linkedRecordId }
    }
}

private struct EmptyCareReminderState: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "bell")
                .font(.title2)
                .foregroundStyle(HealthFolioTheme.blue)
                .accessibilityHidden(true)

            Text("No reminders")
                .font(.headline)
                .foregroundStyle(HealthFolioTheme.ink)

            Text("Add medicines, tests, or doctor visits.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}

private struct CareSummaryCard: View {
    let medicineCount: Int
    let followUpCount: Int
    let dueTodayCount: Int
    let shareText: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                CareSummaryStat(label: "Medicines", value: medicineCount)
                CareSummaryStat(label: "Follow-ups", value: followUpCount)
                CareSummaryStat(label: "Today", value: dueTodayCount)
            }

            Text("Reminders organize your own records. They do not change dosage or medical instructions.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if medicineCount + followUpCount > 0 {
                ShareLink(item: shareText) {
                    Label("Share care summary", systemImage: "square.and.arrow.up")
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius))
    }
}

private struct CareSummaryStat: View {
    let label: String
    let value: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value, format: .number)
                .font(.title3.bold())
                .foregroundStyle(HealthFolioTheme.ink)
            Text(label)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct MedicineSummaryTable: View {
    let items: [CarePlanItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            NativeSectionHeader(title: "Medicine summary", systemImage: "pills")

            VStack(spacing: 0) {
                MedicineSummaryHeader()

                ForEach(items.prefix(6)) { item in
                    Divider()
                    MedicineSummaryRow(item: item)
                }

                if items.count > 6 {
                    Divider()
                    Text("\(items.count - 6) more medicine reminder\(items.count - 6 == 1 ? "" : "s") in Upcoming.")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                }
            }
            .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 20))
            .overlay {
                RoundedRectangle(cornerRadius: 20)
                    .stroke(HealthFolioTheme.border, lineWidth: 1)
            }
        }
    }
}

private struct MedicineSummaryHeader: View {
    var body: some View {
        HStack(spacing: 10) {
            Text("Medicine")
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Dose / timing")
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Next")
                .frame(width: 74, alignment: .trailing)
        }
        .font(.caption.bold())
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
}

private struct MedicineSummaryRow: View {
    let item: CarePlanItem

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text(item.title)
                .font(.subheadline.bold())
                .foregroundStyle(HealthFolioTheme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(doseTiming)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .trailing, spacing: 2) {
                Text(item.dueAt(), format: .dateTime.month(.abbreviated).day())
                    .font(.subheadline.bold())
                Text(item.dueAt(), format: .dateTime.hour().minute())
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(width: 74, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
    }

    private var doseTiming: String {
        let value = item.detail.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? "Not set" : value
    }
}

#Preview {
    NavigationStack {
        CarePlanNativeView()
            .environmentObject(HealthFolioAppModel())
    }
}
