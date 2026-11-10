import SwiftUI
import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = UIHostingController(rootView: HealthFolioRootView())
    self.window = window
    window.makeKeyAndVisible()

    for urlContext in connectionOptions.urlContexts {
      if NativeSocialAuth.handleGoogleURL(urlContext.url) {
        continue
      }

      routeHealthFolioAuthCallback(urlContext.url)
    }

    if let url = connectionOptions.userActivities.compactMap(\.webpageURL).first {
      routeHealthFolioAuthCallback(url)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for urlContext in URLContexts {
      if NativeSocialAuth.handleGoogleURL(urlContext.url) {
        continue
      }

      routeHealthFolioAuthCallback(urlContext.url)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    if let url = userActivity.webpageURL {
      routeHealthFolioAuthCallback(url)
    }
  }

  @discardableResult
  private func routeHealthFolioAuthCallback(_ url: URL) -> Bool {
    HealthFolioAuthCallbackRouter.route(url)
  }
}
