import Foundation

struct AssistantPrompt: Identifiable {
    let id = UUID()
    let title: String
    let body: String
}

enum AssistantQuestionPolicy {
    private static let greetingStarts: Set<String> = ["hi", "hello", "hey"]
    private static let greetingPhrases: Set<String> = ["good morning", "good afternoon", "good evening"]
    private static let greetingSuffixes: Set<String> = ["there", "healthfolio", "assistant"]

    private static let unrelatedTerms: Set<String> = [
        "actor", "business", "coding", "crypto", "election", "flight", "football", "homework",
        "hotel", "joke", "movie", "music", "politics", "programming", "recipe", "restaurant",
        "sports", "stock", "stocks", "travel", "weather"
    ]

    private static let medicalTerms: Set<String> = [
        "blood", "bilirubin", "cholesterol", "clinician", "diagnosis", "discharge", "doctor",
        "drug", "glucose", "hba1c", "hemoglobin", "hospital", "imaging", "kidney",
        "lab", "liver", "marker", "markers", "medical", "medication", "medicine", "mri", "ocr",
        "pill", "platelet", "prescription", "radiology", "scan", "surgery", "symptom", "tablet",
        "thyroid", "tsh", "ultrasound", "upload", "vaccine", "vaccination", "xray"
    ]

    private static let recordContextTerms: Set<String> = [
        "lab", "level", "levels", "marker", "markers", "mine", "my", "reading", "readings",
        "record", "records", "report", "reports", "result", "results", "test", "tests"
    ]

    private static let medicalPhrases = [
        "blood report", "blood reports", "blood test", "health record", "health records",
        "health score", "lab report", "lab reports", "lab result", "lab results",
        "medical record", "medical records", "medical report", "medical reports",
        "test result", "test results", "x-ray"
    ]

    private static let recordMatchNoiseTerms: Set<String> = [
        "absolute", "annual", "average", "count", "direct", "indirect", "index", "level",
        "levels", "mean", "medical", "panel", "physical", "ratio", "report", "reports",
        "result", "results", "serum", "test", "tests", "total", "value", "values"
    ]

    static func words(in text: String) -> [String] {
        text
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
    }

    static func containsTerm(_ term: String, in text: String) -> Bool {
        containsTerm(words(in: term), in: words(in: text))
    }

    static func containsAnyTerm(_ terms: [String], in text: String) -> Bool {
        terms.contains { containsTerm($0, in: text) }
    }

    static func isGreeting(_ question: String) -> Bool {
        let normalizedWords = words(in: question)
        guard !normalizedWords.isEmpty, normalizedWords.count <= 3 else { return false }
        let normalized = normalizedWords.joined(separator: " ")
        if greetingPhrases.contains(normalized) { return true }
        guard let first = normalizedWords.first, greetingStarts.contains(first) else { return false }
        return normalizedWords.dropFirst().allSatisfy(greetingSuffixes.contains)
    }

    static func isMedicalQuestion(_ question: String, knownRecordTerms: Set<String>) -> Bool {
        let questionWords = words(in: question)
        let questionTerms = Set(questionWords)
        guard questionTerms.isDisjoint(with: unrelatedTerms) else { return false }

        if !questionTerms.isDisjoint(with: medicalTerms) { return true }
        if containsAnyTerm(medicalPhrases, in: question) { return true }

        let normalizedRecordTerms = Set(knownRecordTerms.flatMap(words))
            .subtracting(recordMatchNoiseTerms)
        let hasRecordContext = !questionTerms.isDisjoint(with: recordContextTerms)
        return hasRecordContext && !questionTerms.isDisjoint(with: normalizedRecordTerms)
    }

    static func recordMatchScore(
        questionTerms: [String],
        recordTerms: [String],
        categoryMatches: Bool
    ) -> Int {
        let recordTermSet = Set(recordTerms).subtracting(recordMatchNoiseTerms)
        let meaningfulQuestionTerms = Set(questionTerms).subtracting(recordMatchNoiseTerms)
        let tokenScore = meaningfulQuestionTerms.reduce(into: 0) { score, term in
            guard recordTermSet.contains(term) else { return }
            score += term.count > 4 ? 3 : 2
        }
        return tokenScore + (categoryMatches ? 8 : 0)
    }

    private static func containsTerm(_ termWords: [String], in words: [String]) -> Bool {
        guard !termWords.isEmpty, termWords.count <= words.count else { return false }
        if termWords.count == 1 { return words.contains(termWords[0]) }

        for start in 0...(words.count - termWords.count) {
            if Array(words[start..<(start + termWords.count)]) == termWords { return true }
        }
        return false
    }
}
