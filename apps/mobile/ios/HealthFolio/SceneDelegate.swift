import SwiftUI
import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
  private let appLock = HealthFolioAppLock()
  private var privacyCover: UIView?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = UIHostingController(rootView: HealthFolioRootView(appLock: appLock))
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

  func sceneWillResignActive(_ scene: UIScene) {
    guard appLock.isEnabled, let window, privacyCover == nil else { return }
    let cover = UIView(frame: window.bounds)
    cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    cover.backgroundColor = .systemBackground
    window.addSubview(cover)
    privacyCover = cover
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appLock.lock()
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    privacyCover?.removeFromSuperview()
    privacyCover = nil
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
