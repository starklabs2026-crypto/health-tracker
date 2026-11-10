import Foundation

struct CarePlanItem: Identifiable, Codable, Equatable {
    var id: UUID
    var kind: CarePlanKind
    var title: String
    var detail: String
    var date: Date
    var time: Date
    var sourceNote: String
    var linkedRecordId: UUID?
    var linkedRecordTitle: String?
    var completedAt: Date?
    var createdAt: Date

    init(
        id: UUID = UUID(),
        kind: CarePlanKind = .medicine,
        title: String,
        detail: String,
        date: Date,
        time: Date,
        sourceNote: String = "",
        linkedRecordId: UUID? = nil,
        linkedRecordTitle: String? = nil,
        completedAt: Date? = nil,
        createdAt: Date = Date.now
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.detail = detail
        self.date = date
        self.time = time
        self.sourceNote = sourceNote
        self.linkedRecordId = linkedRecordId
        self.linkedRecordTitle = linkedRecordTitle
        self.completedAt = completedAt
        self.createdAt = createdAt
    }

    var isCompleted: Bool {
        completedAt != nil
    }

    var notificationIdentifier: String {
        Self.notificationIdentifier(for: id)
    }

    static func notificationIdentifier(for id: UUID) -> String {
        "healthfolio.care.\(id.uuidString)"
    }

    func dueAt(calendar: Calendar = .current) -> Date {
        let day = calendar.dateComponents([.year, .month, .day], from: date)
        let clock = calendar.dateComponents([.hour, .minute], from: time)
        var components = DateComponents()
        components.year = day.year
        components.month = day.month
        components.day = day.day
        components.hour = clock.hour
        components.minute = clock.minute

        return calendar.date(from: components) ?? date
    }

    func dueState(now: Date = Date.now, calendar: Calendar = .current) -> CarePlanDueState {
        if isCompleted {
            return .completed
        }

        let due = dueAt(calendar: calendar)
        if calendar.isDate(due, inSameDayAs: now) {
            return .today
        }

        if due < now {
            return .overdue
        }

        return .upcoming
    }

    func isDueToday(now: Date = Date.now, calendar: Calendar = .current) -> Bool {
        calendar.isDate(dueAt(calendar: calendar), inSameDayAs: now)
    }
}
