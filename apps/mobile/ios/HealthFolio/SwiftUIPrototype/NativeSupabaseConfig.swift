import Foundation

enum NativeSupabaseConfig {
    static let projectRef = "qojdeuacwkmlxmodeabt"
    static let url = URL(string: "https://qojdeuacwkmlxmodeabt.supabase.co")!
    static let functionsURL = URL(string: "https://qojdeuacwkmlxmodeabt.functions.supabase.co")!
    static let publishableKey = "sb_publishable_d-pZ2zQvS-0QA5KR5EdloA_KOw1MUoI"
    static let documentBucket = "medical-documents"
    static let doctorShareBaseURL = URL(string: "https://healthfolio.app")!
    static let authStorageKey = "sb-qojdeuacwkmlxmodeabt-auth-token"
    static let callbackScheme = "healthfolio"
    static let authCallbackURL = URL(string: "healthfolio://auth/callback")!
    static let passwordRecoveryCallbackURL = URL(string: "healthfolio://auth/callback?flow=recovery")!
    static let googleIOSClientId = "249865909043-c2pn0u8jbt4b8sqtso91ggd1fkcbif3q.apps.googleusercontent.com"
    static let googleWebClientId = "249865909043-9jq52l7h9rd01nhfkvv582rfopjprrdm.apps.googleusercontent.com"
}
