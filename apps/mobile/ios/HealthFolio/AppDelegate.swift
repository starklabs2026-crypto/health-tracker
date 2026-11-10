internal import Expo
import SwiftUI

@main
class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if NativeSocialAuth.handleGoogleURL(url) {
      return true
    }
    let handledBySwiftUI = routeHealthFolioAuthCallback(url)
    let handledByExpo = super.application(app, open: url, options: options)
    return handledBySwiftUI || handledByExpo
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let handledBySwiftUI = userActivity.webpageURL.map(routeHealthFolioAuthCallback) ?? false
    let handledByExpo = super.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return handledBySwiftUI || handledByExpo
  }

  private func routeHealthFolioAuthCallback(_ url: URL) -> Bool {
    HealthFolioAuthCallbackRouter.route(url)
  }
}
