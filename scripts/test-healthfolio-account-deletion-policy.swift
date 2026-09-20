import Foundation

@main
struct HealthFolioAccountDeletionPolicyTests {
    static func main() {
        var failures: [String] = []

        expect(
            NativeSupabaseError.missingSession.indicatesCompletedAccountDeletion,
            "a missing session after a pending deletion must allow local cleanup",
            failures: &failures
        )
        expect(
            NativeSupabaseError.http(statusCode: 401, message: "Invalid bearer token")
                .indicatesCompletedAccountDeletion,
            "an invalid deleted-account token must allow local cleanup",
            failures: &failures
        )
        expect(
            !NativeSupabaseError.http(statusCode: 500, message: "Server error")
                .indicatesCompletedAccountDeletion,
            "server failures must stay retryable and keep local data",
            failures: &failures
        )

        if failures.isEmpty {
            print("HealthFolio account deletion policy tests passed.")
        } else {
            failures.forEach { fputs("FAIL: \($0)\n", stderr) }
            exit(1)
        }
    }

    private static func expect(_ condition: Bool, _ message: String, failures: inout [String]) {
        if !condition { failures.append(message) }
    }
}
