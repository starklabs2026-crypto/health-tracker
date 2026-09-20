import SwiftUI

struct NativeSectionHeader: View {
    let title: String
    let systemImage: String

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.title3.bold())
            .foregroundStyle(HealthFolioTheme.ink)
            .labelStyle(.titleAndIcon)
            .padding(.top, 8)
    }
}

#Preview {
    NativeSectionHeader(title: "Next", systemImage: "target")
        .padding()
}
