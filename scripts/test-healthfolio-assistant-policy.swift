import Foundation

private func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else {
        fputs("FAIL: \(message)\n", stderr)
        exit(1)
    }
}

@main
struct AssistantPolicyTestRunner {
    static func main() {
        expect(AssistantQuestionPolicy.isGreeting("Hi!"), "punctuated greeting should be accepted")
        expect(AssistantQuestionPolicy.isGreeting("Hello there"), "short greeting phrase should be accepted")
        expect(AssistantQuestionPolicy.isGreeting("Hey HealthFolio"), "product greeting should be accepted")

        expect(
            !AssistantQuestionPolicy.isMedicalQuestion("How do I start a business?", knownRecordTerms: []),
            "non-medical use of start must be refused"
        )
        expect(
            !AssistantQuestionPolicy.isMedicalQuestion("Who is that actor?", knownRecordTerms: []),
            "actor must not match the CT imaging abbreviation"
        )
        expect(
            !AssistantQuestionPolicy.isMedicalQuestion("Explain the weather forecast", knownRecordTerms: []),
            "generic explain prompt must be refused"
        )
        expect(
            AssistantQuestionPolicy.isMedicalQuestion("What does my CT scan say?", knownRecordTerms: []),
            "explicit imaging question should be accepted"
        )
        expect(
            AssistantQuestionPolicy.isMedicalQuestion("Show my bilirubin result", knownRecordTerms: ["bilirubin"]),
            "record-backed marker question should be accepted"
        )
        expect(
            !AssistantQuestionPolicy.isMedicalQuestion(
                "What is the total revenue?",
                knownRecordTerms: ["total", "bilirubin"]
            ),
            "generic words inside metric names must not widen medical scope"
        )
        expect(
            !AssistantQuestionPolicy.isMedicalQuestion(
                "Summarize the quarterly earnings report",
                knownRecordTerms: []
            ),
            "a generic report request must not be treated as medical"
        )
        expect(
            !AssistantQuestionPolicy.isMedicalQuestion(
                "What is the iron price?",
                knownRecordTerms: ["serum", "iron"]
            ),
            "an ambiguous marker word without record context must be refused"
        )
        expect(
            AssistantQuestionPolicy.isMedicalQuestion(
                "What is my iron level?",
                knownRecordTerms: ["serum", "iron"]
            ),
            "an ambiguous marker word with personal record context should be accepted"
        )

        expect(
            AssistantQuestionPolicy.recordMatchScore(
                questionTerms: ["bilirubin"],
                recordTerms: ["prescription", "metformin"],
                categoryMatches: false
            ) == 0,
            "ready/value state must not make an unrelated record relevant"
        )
        expect(
            AssistantQuestionPolicy.recordMatchScore(
                questionTerms: ["bilirubin"],
                recordTerms: ["total", "bilirubin", "report"],
                categoryMatches: false
            ) > 0,
            "a token-matched record should be relevant"
        )
        expect(
            AssistantQuestionPolicy.recordMatchScore(
                questionTerms: ["total", "revenue"],
                recordTerms: ["total", "bilirubin", "report"],
                categoryMatches: false
            ) == 0,
            "generic measurement words must not make a record relevant"
        )
        expect(
            AssistantQuestionPolicy.recordMatchScore(
                questionTerms: ["serum", "iron"],
                recordTerms: ["serum", "chloride"],
                categoryMatches: false
            ) == 0,
            "shared generic serum wording must not match the wrong marker"
        )
        expect(
            AssistantQuestionPolicy.recordMatchScore(
                questionTerms: ["serum", "iron"],
                recordTerms: ["serum", "iron"],
                categoryMatches: false
            ) > 0,
            "the subject-specific marker token should match its own metric"
        )
        expect(
            AssistantQuestionPolicy.recordMatchScore(
                questionTerms: ["prescription"],
                recordTerms: ["medicine", "list"],
                categoryMatches: true
            ) > 0,
            "an explicitly requested record category should be relevant"
        )

        print("HealthFolio assistant policy tests passed")
    }
}
