import SwiftUI

struct NextActionCard: View {
    let reviewCount: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: "exclamationmark.circle")
                    .font(.title3)
                    .foregroundStyle(HealthFolioTheme.amber)
                    .frame(width: 44, height: 44)
                    .background(HealthFolioTheme.amber.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 4) {
                    Text("Review \(reviewCount) records")
                        .font(.headline)
                        .foregroundStyle(HealthFolioTheme.ink)
                    Text("Confirm extracted values")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
        }
        .buttonStyle(.plain)
        .accessibilityInputLabels(["Review records"])
    }

}

#Preview {
    NextActionCard(reviewCount: 4, action: {})
        .padding()
        .background(HealthFolioTheme.background)
}
