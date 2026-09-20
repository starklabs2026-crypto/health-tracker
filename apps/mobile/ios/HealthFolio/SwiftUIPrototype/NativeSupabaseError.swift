import Foundation

enum NativeSupabaseError: LocalizedError {
    case missingSession
    case emptyFile
    case fileUnavailable
    case fileTooLarge
    case unsupportedFileType
    case uploadProcessing(documentId: UUID, message: String)
    case ocrProcessing(documentId: UUID, message: String)
    case backend(String)
    case http(statusCode: Int, message: String)

    var indicatesCompletedAccountDeletion: Bool {
        switch self {
        case .missingSession:
            true
        case let .http(statusCode, _):
            statusCode == 401 || statusCode == 404
        default:
            false
        }
    }

    var errorDescription: String? {
        switch self {
        case .missingSession:
            "Sign in once from HealthFolio, then try the upload again."
        case .emptyFile:
            "The selected file was empty. Choose the original PDF or image again."
        case .fileUnavailable:
            "The original file is not available from this device."
        case .fileTooLarge:
            "This file is larger than 25 MB. Choose a smaller PDF, JPG, or PNG."
        case .unsupportedFileType:
            "This file type is not supported. Choose a PDF, JPG, or PNG."
        case let .uploadProcessing(_, message):
            message
        case let .ocrProcessing(_, message):
            message
        case let .backend(message):
            message.isEmpty ? "Supabase could not process this upload." : message
        case let .http(_, message):
            message.isEmpty ? "Supabase could not complete this request." : message
        }
    }
}
