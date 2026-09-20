import Foundation

var failures: [String] = []

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceURL = root.appendingPathComponent(
    "apps/mobile/ios/HealthFolio/SwiftUIPrototype/NativeSupabaseAPI.swift"
)

do {
    let source = try String(contentsOf: sourceURL, encoding: .utf8)
    if !source.contains("URLQueryItem(name: \"on_conflict\", value: \"userId,consentVersion\")") {
        failures.append("recordCurrentConsent must send on_conflict=userId,consentVersion on the POST request")
    }
} catch {
    failures.append("failed to read NativeSupabaseAPI.swift: \(error)")
}

if failures.isEmpty {
    print("HealthFolio consent REST insert contract tests passed.")
} else {
    for failure in failures {
        fputs("FAIL: \(failure)\n", stderr)
    }
    exit(1)
}
