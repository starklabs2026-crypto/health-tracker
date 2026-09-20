import SwiftUI

struct MetricCapsule: View {
    let label: String
    let value: String
    let tint: Color

    var body: some View {
        HStack {
            Circle()
                .fill(tint)
                .frame(width: 9, height: 9)

            Text(label)
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.70))

            Spacer()

            Text(value)
                .font(.headline.bold())
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .monospacedDigit()
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    MetricCapsule(label: "Markers", value: "23", tint: HealthFolioTheme.green)
        .padding()
        .background(HealthFolioTheme.ink)
}
