import SwiftUI

struct EmptyRecordsState: View {
    let searchText: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.title)
                .foregroundStyle(HealthFolioTheme.blue)
                .frame(width: 56, height: 56)
                .background(HealthFolioTheme.blue.opacity(0.12), in: Circle())
                .accessibilityHidden(true)

            Text("No matching records")
                .font(.headline)
                .foregroundStyle(HealthFolioTheme.ink)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 56)
        .padding(.horizontal)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius))
    }

    private var message: String {
        if searchText.isEmpty {
            return "Uploaded records and reports will appear here."
        }
        return "Try another report name, lab, or status."
    }
}

#Preview {
    EmptyRecordsState(searchText: "glucose")
        .padding()
        .background(HealthFolioTheme.background)
}
