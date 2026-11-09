import SwiftUI

enum HealthFolioTheme {
    static let ink = Color(red: 0.06, green: 0.09, blue: 0.12)
    static let inkSoft = Color(red: 0.12, green: 0.17, blue: 0.21)
    static let blue = Color(red: 0.09, green: 0.55, blue: 1.00)
    static let blueSoft = Color(red: 0.91, green: 0.96, blue: 1.00)
    static let green = Color(red: 0.13, green: 0.85, blue: 0.51)
    static let greenSoft = Color(red: 0.91, green: 0.98, blue: 0.95)
    static let amber = Color(red: 0.73, green: 0.47, blue: 0.02)
    static let background = Color(red: 0.96, green: 0.97, blue: 0.98)
    static let card = Color.white
    static let border = Color(red: 0.84, green: 0.89, blue: 0.92)
    static let secondaryText = Color.secondary

    static let cardRadius: CGFloat = 28
    static let controlRadius: CGFloat = 18
    static let spacing: CGFloat = 16
}

private struct KeyboardAvoidingInset: ViewModifier {
    @State private var overlap: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .safeAreaInset(edge: .bottom, spacing: 0) {
                Color.clear.frame(height: overlap)
            }
            .scrollDismissesKeyboard(.interactively)
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)) { notification in
                guard let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
                let covered = max(0, UIScreen.main.bounds.height - frame.minY)
                overlap = covered > 80 ? covered : 0
            }
    }
}

extension View {
    /// Keeps the focused field above the keyboard inside forms, sheets, and scroll views.
    func keyboardAvoiding() -> some View {
        modifier(KeyboardAvoidingInset())
    }
}
