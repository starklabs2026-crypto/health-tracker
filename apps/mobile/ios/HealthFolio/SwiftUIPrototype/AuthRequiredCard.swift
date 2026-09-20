import SwiftUI

struct AuthRequiredCard: View {
    let title: String
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "lock.shield")
                .font(.title3.weight(.semibold))
                .foregroundStyle(HealthFolioTheme.blue)
                .frame(width: 46, height: 46)
                .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 16))

            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.headline)
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 0)
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }
}

#Preview {
    AuthRequiredCard(title: "Sign in required", message: "Open Profile and sign in to sync records.")
        .padding()
        .background(HealthFolioTheme.background)
}
