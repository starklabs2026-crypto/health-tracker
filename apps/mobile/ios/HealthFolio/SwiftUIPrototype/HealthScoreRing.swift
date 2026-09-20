import SwiftUI

struct HealthScoreRing: View {
    let score: Int

    var body: some View {
        ZStack {
            Circle()
                .stroke(.white.opacity(0.10), lineWidth: 12)

            Circle()
                .trim(from: 0, to: CGFloat(score) / 100)
                .stroke(
                    HealthFolioTheme.green,
                    style: StrokeStyle(lineWidth: 12, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            VStack(spacing: 0) {
                Text(score, format: .number)
                    .font(.system(.largeTitle, design: .rounded).bold())
                    .foregroundStyle(.white)
                Text("/100")
                    .font(.footnote.bold())
                    .foregroundStyle(HealthFolioTheme.green)
            }
        }
        .frame(width: 132, height: 132)
        .accessibilityLabel("Health score")
        .accessibilityValue("\(score) out of 100")
    }
}

#Preview {
    HealthScoreRing(score: 77)
        .padding()
        .background(HealthFolioTheme.ink)
}
