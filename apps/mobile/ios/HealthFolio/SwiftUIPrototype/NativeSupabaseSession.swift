import CryptoKit
import Foundation
import Security

struct NativeSupabaseSession: Codable, Hashable, Sendable {
    let accessToken: String
    let refreshToken: String?
    let expiresAt: TimeInterval?

    var isUsable: Bool {
        guard !accessToken.isEmpty else { return false }
        guard let expiresAt else { return true }
        return expiresAt > Date().timeIntervalSince1970 + 60
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self),
              let raw = String(data: data, encoding: .utf8)
        else { return }
        if Self.saveToKeychain(raw) {
            Self.clearLegacyUserDefaults()
        }
    }

    static func clearSavedSession() {
        deleteKeychainSession()
        clearLegacyUserDefaults()
        clearLegacyAsyncStorage()
    }

    static func current() throws -> NativeSupabaseSession {
        if let session = saved(), session.isUsable {
            return session
        }
        throw NativeSupabaseError.missingSession
    }

    static func saved() -> NativeSupabaseSession? {
        if let session = readFromKeychain() {
            return session
        }
        if let session = readFromUserDefaults() ?? readFromAsyncStorage() {
            session.save()
            return session
        }
        return nil
    }

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
    }

    private static func readFromUserDefaults() -> NativeSupabaseSession? {
        let defaults = UserDefaults.standard
        let candidates = [
            NativeSupabaseConfig.authStorageKey,
            "supabase.auth.token",
            "healthfolio.supabase.session"
        ]
        for key in candidates {
            if let raw = defaults.string(forKey: key),
               let session = decode(raw) {
                return session
            }
        }
        return nil
    }

    private static func clearLegacyUserDefaults() {
        UserDefaults.standard.removeObject(forKey: NativeSupabaseConfig.authStorageKey)
        UserDefaults.standard.removeObject(forKey: "healthfolio.supabase.session")
        UserDefaults.standard.removeObject(forKey: "supabase.auth.token")
    }

    private static func clearLegacyAsyncStorage() {
        let fileManager = FileManager.default
        let digest = Insecure.MD5.hash(data: Data(NativeSupabaseConfig.authStorageKey.utf8))
        let hashedFileName = digest.map { String(format: "%02x", $0) }.joined()

        for directory in asyncStorageDirectories() {
            try? fileManager.removeItem(at: directory.appendingPathComponent(hashedFileName))

            let manifestURL = directory.appendingPathComponent("manifest.json")
            guard let data = try? Data(contentsOf: manifestURL),
                  var manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  manifest.removeValue(forKey: NativeSupabaseConfig.authStorageKey) != nil,
                  let updatedData = try? JSONSerialization.data(withJSONObject: manifest)
            else { continue }
            try? updatedData.write(to: manifestURL, options: [.atomic, .completeFileProtection])
        }
    }

    private static func readFromKeychain() -> NativeSupabaseSession? {
        var query = keychainQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let raw = String(data: data, encoding: .utf8)
        else {
            return nil
        }
        return decode(raw)
    }

    @discardableResult
    private static func saveToKeychain(_ raw: String) -> Bool {
        deleteKeychainSession()
        guard let data = raw.data(using: .utf8) else { return false }

        var query = keychainQuery()
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    private static func deleteKeychainSession() {
        SecItemDelete(keychainQuery() as CFDictionary)
    }

    private static func keychainQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: Bundle.main.bundleIdentifier ?? "com.starklabs.healthfolio",
            kSecAttrAccount as String: NativeSupabaseConfig.authStorageKey
        ]
    }

    private static func readFromAsyncStorage() -> NativeSupabaseSession? {
        for directory in asyncStorageDirectories() {
            if let session = readManifestValue(in: directory) {
                return session
            }
            if let session = readHashedValue(in: directory) {
                return session
            }
        }
        return nil
    }

    private static func asyncStorageDirectories() -> [URL] {
        let fileManager = FileManager.default
        let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let documents = fileManager.urls(for: .documentDirectory, in: .userDomainMask)
        let bundleID = Bundle.main.bundleIdentifier ?? "com.starklabs.healthfolio"
        return (support + documents).flatMap { base in
            [
                base.appendingPathComponent(bundleID).appendingPathComponent("RCTAsyncLocalStorage_V1"),
                base.appendingPathComponent("RCTAsyncLocalStorage_V1"),
                base.appendingPathComponent("AsyncStorage")
            ]
        }
    }

    private static func readManifestValue(in directory: URL) -> NativeSupabaseSession? {
        let manifest = directory.appendingPathComponent("manifest.json")
        guard let data = try? Data(contentsOf: manifest),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }

        if let raw = object[NativeSupabaseConfig.authStorageKey] as? String,
           let session = decode(raw) {
            return session
        }
        return nil
    }

    private static func readHashedValue(in directory: URL) -> NativeSupabaseSession? {
        let digest = Insecure.MD5.hash(data: Data(NativeSupabaseConfig.authStorageKey.utf8))
        let fileName = digest.map { String(format: "%02x", $0) }.joined()
        let url = directory.appendingPathComponent(fileName)
        guard let raw = try? String(contentsOf: url, encoding: .utf8) else { return nil }
        return decode(raw)
    }

    private static func decode(_ raw: String) -> NativeSupabaseSession? {
        guard let data = raw.data(using: .utf8) else { return nil }

        if let wrapped = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let current = wrapped["currentSession"],
               let nestedData = try? JSONSerialization.data(withJSONObject: current),
               let session = try? JSONDecoder().decode(NativeSupabaseSession.self, from: nestedData) {
                return session
            }
        }

        return try? JSONDecoder().decode(NativeSupabaseSession.self, from: data)
    }
}
