import SwiftUI

struct ProfileSwitcherNativeView: View {
    @EnvironmentObject private var model: HealthFolioAppModel

    var body: some View {
        if model.availableProfiles.count > 1 {
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(model.availableProfiles, id: \.id) { profile in
                        Button {
                            Task { await model.selectProfile(profile) }
                        } label: {
                            HStack(spacing: 8) {
                                if model.isSwitchingProfile && isSelected(profile) {
                                    ProgressView()
                                        .controlSize(.mini)
                                        .frame(width: 12, height: 12)
                                } else {
                                    Circle()
                                        .fill(isSelected(profile) ? HealthFolioTheme.blue : HealthFolioTheme.border)
                                        .frame(width: 8, height: 8)
                                }
                                Text(profile.displayName)
                                    .lineLimit(1)
                            }
                            .font(.subheadline.bold())
                            .foregroundStyle(isSelected(profile) ? HealthFolioTheme.blue : HealthFolioTheme.ink)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 9)
                            .background(isSelected(profile) ? HealthFolioTheme.blue.opacity(0.12) : HealthFolioTheme.card, in: Capsule())
                            .overlay {
                                Capsule()
                                    .stroke(isSelected(profile) ? HealthFolioTheme.blue.opacity(0.45) : HealthFolioTheme.border, lineWidth: 1)
                            }
                        }
                        .buttonStyle(.plain)
                        .disabled(model.isSwitchingProfile || isSelected(profile))
                        .accessibilityAddTraits(isSelected(profile) ? .isSelected : [])
                    }
                }
                .padding(.vertical, 2)
            }
            .scrollIndicators(.hidden)
        }
    }

    private func isSelected(_ profile: HealthFolioProfile) -> Bool {
        model.profile.id == profile.id
    }
}

#Preview {
    ProfileSwitcherNativeView()
        .environmentObject(HealthFolioAppModel())
        .padding()
        .background(HealthFolioTheme.background)
}
