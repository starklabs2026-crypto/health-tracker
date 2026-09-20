import PDFKit
import QuickLook
import SwiftUI
import UIKit

struct DocumentDetailNativeView: View {
    let record: HealthRecord
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var signedFileURL: URL?
    @State private var previewFileURL: URL?
    @State private var quickLookFile: PreviewFile?
    @State private var fileMetadata: RemoteFileMetadata?
    @State private var openMessage: String?
    @State private var previewMessage: String?
    @State private var assignmentMessage: String?
    @State private var selectedProfileId = ""
    @State private var isPreparingOriginal = false
    @State private var isOpening = false
    @State private var isReassigning = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HealthFolioTheme.spacing) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(record.title)
                            .font(.largeTitle.bold())
                        Text(record.subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(record.status.label)
                        .font(.caption.bold())
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(record.status.tint.opacity(0.12), in: Capsule())
                        .foregroundStyle(record.status.tint)
                }

                DocumentScoreCard(record: record)

                if model.availableProfiles.count > 1 {
                    profileAssignmentSection
                }

                NativeSectionHeader(title: "Original file", systemImage: "doc")
                VStack(alignment: .leading, spacing: 18) {
                    OriginalPreviewSurface(
                        record: record,
                        signedFileURL: signedFileURL,
                        previewFileURL: previewFileURL,
                        metadata: fileMetadata,
                        isLoading: isPreparingOriginal,
                        message: previewMessage
                    )

                    FilePreviewSummary(record: record, metadata: fileMetadata)

                    MetadataGrid(record: record, metadata: fileMetadata, hasSignedURL: signedFileURL != nil)

                    if let openMessage {
                        InlineNotice(message: openMessage)
                    }

                    HStack(spacing: 12) {
                        Button {
                            Task { await openOriginal() }
                        } label: {
                            Label(isOpening ? "Opening" : "Open", systemImage: "doc.text.magnifyingglass")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isOpening || record.fileKey == nil)

                        if let signedFileURL {
                            ShareLink(item: signedFileURL) {
                                Label("Share", systemImage: "square.and.arrow.up")
                            }
                            .buttonStyle(.bordered)
                        } else {
                            ShareLink(item: shareText) {
                                Label("Share details", systemImage: "square.and.arrow.up")
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
                .padding()
                .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius))

                NativeSectionHeader(title: "Findings", systemImage: "list.bullet.rectangle")
                if record.metrics.isEmpty {
                    EmptyRecordsState(searchText: "")
                } else {
                    ForEach(record.metrics) { metric in
                        MarkerRow(metric: metric)
                    }
                }
            }
            .padding()
        }
        .background(HealthFolioTheme.background)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: record.id) {
            await prepareOriginalFile()
        }
        .onAppear(perform: resetAssignmentDraft)
        .onChange(of: record.id) { _ in
            resetAssignmentDraft()
        }
        .sheet(item: $quickLookFile) { file in
            QuickLookPreview(url: file.url)
                .ignoresSafeArea()
        }
    }

    private var profileAssignmentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            NativeSectionHeader(title: "Profile assignment", systemImage: "person.2")
            VStack(alignment: .leading, spacing: 12) {
                LabeledContent("Current", value: model.profileName(for: record.ownerProfileId))

                Picker("Move to", selection: $selectedProfileId) {
                    ForEach(model.availableProfiles, id: \.id) { profile in
                        Text(profile.displayName).tag(profile.id)
                    }
                }
                .pickerStyle(.menu)

                Button {
                    Task { await reassignRecord() }
                } label: {
                    Label(isReassigning ? "Moving" : "Move record", systemImage: "person.crop.circle.badge.arrow.forward")
                }
                .buttonStyle(.bordered)
                .disabled(isReassigning || selectedProfileId.isEmpty || selectedProfileId == currentProfileId)

                Text("Moving updates the document owner and extracted readings so Records, Trends, Assistant, exports, and shares use the selected profile.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let assignmentMessage {
                    InlineNotice(message: assignmentMessage)
                }
            }
            .padding()
            .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: HealthFolioTheme.cardRadius))
        }
    }

    private var currentProfileId: String {
        record.ownerProfileId ?? model.profile.id
    }

    private var selectedAssignmentProfile: HealthFolioProfile? {
        model.availableProfiles.first { $0.id == selectedProfileId }
    }

    private var shareText: String {
        "\(record.title)\n\(record.subtitle)\n\(record.notes)"
    }

    private func resetAssignmentDraft() {
        let current = currentProfileId
        if model.availableProfiles.contains(where: { $0.id == current }) {
            selectedProfileId = current
        } else {
            selectedProfileId = model.profile.id
        }
    }

    @MainActor
    private func reassignRecord() async {
        guard let target = selectedAssignmentProfile else {
            assignmentMessage = "Choose a profile first."
            return
        }
        guard target.id != currentProfileId else {
            assignmentMessage = "This record is already assigned to \(target.displayName)."
            return
        }

        isReassigning = true
        let moved = await model.reassignRecord(record, to: target)
        isReassigning = false
        if moved {
            assignmentMessage = "Moved to \(target.displayName)."
            selectedProfileId = target.id
        } else {
            assignmentMessage = model.sessionMessage ?? "The record could not be moved."
        }
    }

    @MainActor
    private func prepareOriginalFile() async {
        signedFileURL = nil
        previewFileURL = nil
        fileMetadata = nil
        previewMessage = nil

        guard let fileKey = record.fileKey else {
            previewMessage = "No stored source file is attached to this record yet."
            return
        }

        isPreparingOriginal = true
        defer { isPreparingOriginal = false }

        do {
            let url = try await NativeSupabaseAPI.shared.signedDownloadURL(
                fileKey: fileKey,
                documentId: record.id,
                fileName: record.fileName,
                fileType: record.fileType
            )
            signedFileURL = url
            fileMetadata = try? await fetchRemoteFileMetadata(url: url)

            if isPDF(url: url, metadata: fileMetadata) {
                previewFileURL = try await downloadPreviewFile(from: url, preferredExtension: "pdf")
                if previewFileURL == nil {
                    previewMessage = "Open the original PDF for page review."
                }
            } else if isImage(metadata: fileMetadata) {
                previewFileURL = try await downloadPreviewFile(from: url, preferredExtension: preferredFileExtension)
            }
        } catch {
            previewMessage = (error as? LocalizedError)?.errorDescription ?? "The original file could not be prepared."
        }
    }

    @MainActor
    private func openOriginal() async {
        if let previewFileURL {
            quickLookFile = PreviewFile(url: previewFileURL)
            openMessage = nil
            return
        }

        guard let fileKey = record.fileKey else {
            openMessage = "The source file is listed, but no stored file path is attached yet."
            return
        }

        isOpening = true
        defer { isOpening = false }
        do {
            let url = try await NativeSupabaseAPI.shared.signedDownloadURL(
                fileKey: fileKey,
                documentId: record.id,
                fileName: record.fileName,
                fileType: record.fileType
            )
            signedFileURL = url
            let localFile = try await downloadPreviewFile(from: url, preferredExtension: preferredFileExtension)
            if isPDF(url: url, metadata: fileMetadata) || isImage(metadata: fileMetadata) {
                previewFileURL = localFile
            }
            quickLookFile = PreviewFile(url: localFile)
            openMessage = nil
        } catch {
            openMessage = (error as? LocalizedError)?.errorDescription ?? "The original file could not be opened right now."
        }
    }

    private func fetchRemoteFileMetadata(url: URL) async throws -> RemoteFileMetadata {
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<400 ~= http.statusCode else {
            throw NativeSupabaseError.fileUnavailable
        }
        return RemoteFileMetadata(response: http)
    }

    private func downloadPreviewFile(from url: URL, preferredExtension: String) async throws -> URL {
        let (downloadedURL, response) = try await URLSession.shared.download(from: url)
        guard let http = response as? HTTPURLResponse else {
            throw NativeSupabaseError.fileUnavailable
        }
        guard 200..<300 ~= http.statusCode else {
            throw NativeSupabaseError.backend("The original file could not be downloaded from secure storage. Status \(http.statusCode).")
        }

        let downloadedData = try Data(contentsOf: downloadedURL)
        guard !downloadedData.isEmpty else {
            throw NativeSupabaseError.emptyFile
        }

        let safeExtension = preferredExtension.trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let ext = safeExtension.isEmpty ? "file" : safeExtension
        let contentType = http.value(forHTTPHeaderField: "Content-Type")?.lowercased() ?? ""
        if ext.lowercased() == "pdf" || contentType.contains("pdf") {
            guard downloadedData.starts(with: Data("%PDF".utf8)) else {
                throw NativeSupabaseError.backend("The stored file did not download as a valid PDF. Re-upload the original PDF or retry after storage sync finishes.")
            }
        }

        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent("healthfolio-\(record.id.uuidString)")
            .appendingPathExtension(ext)
        try? FileManager.default.removeItem(at: destination)
        try downloadedData.write(to: destination, options: .atomic)
        return destination
    }

    private var preferredFileExtension: String {
        let ext = (record.fileName as NSString).pathExtension
        if !ext.isEmpty { return ext }
        if let fileType = record.fileType?.lowercased() {
            if fileType.contains("pdf") { return "pdf" }
            if fileType.contains("png") { return "png" }
            if fileType.contains("heic") { return "heic" }
            if fileType.contains("webp") { return "webp" }
            if fileType.contains("jpeg") || fileType.contains("jpg") { return "jpg" }
        }
        return "pdf"
    }

    private func isImage(metadata: RemoteFileMetadata?) -> Bool {
        if let contentType = metadata?.contentType?.lowercased(), contentType.hasPrefix("image/") {
            return true
        }
        return record.fileType?.lowercased().hasPrefix("image/") == true
    }

    private func isPDF(url: URL, metadata: RemoteFileMetadata?) -> Bool {
        if let contentType = metadata?.contentType?.lowercased(), contentType.contains("pdf") {
            return true
        }
        if record.fileType?.lowercased().contains("pdf") == true {
            return true
        }
        return url.pathExtension.lowercased() == "pdf" || record.fileName.lowercased().hasSuffix(".pdf")
    }
}

private struct OriginalPreviewSurface: View {
    let record: HealthRecord
    let signedFileURL: URL?
    let previewFileURL: URL?
    let metadata: RemoteFileMetadata?
    let isLoading: Bool
    let message: String?

    var body: some View {
        Group {
            if let previewFileURL, isImage {
                LocalImagePreview(url: previewFileURL)
                    .frame(maxWidth: .infinity, minHeight: 220)
                    .accessibilityLabel("Preview of \(record.fileName)")
            } else if let signedFileURL, isImage {
                AsyncImage(url: signedFileURL) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 220)
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: .infinity, minHeight: 220)
                            .accessibilityLabel("Preview of \(record.fileName)")
                    case .failure:
                        PreviewFallback(icon: "photo", title: "Image preview unavailable", message: "Open the original file to review it.")
                    @unknown default:
                        PreviewFallback(icon: "photo", title: "Image preview unavailable", message: "Open the original file to review it.")
                    }
                }
            } else if let previewFileURL {
                PDFPreview(url: previewFileURL)
                    .frame(height: 360)
                    .accessibilityLabel("PDF preview of \(record.fileName)")
            } else {
                PreviewFallback(
                    icon: fallbackIcon,
                    title: fallbackTitle,
                    message: message ?? fallbackMessage
                )
            }
        }
        .frame(maxWidth: .infinity)
        .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 24))
        .overlay {
            RoundedRectangle(cornerRadius: 24)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
        .overlay(alignment: .topTrailing) {
            if isLoading {
                ProgressView()
                    .padding(10)
                    .background(HealthFolioTheme.card, in: Capsule())
                    .padding(12)
            }
        }
    }

    private var isImage: Bool {
        if let contentType = metadata?.contentType?.lowercased(), contentType.hasPrefix("image/") {
            return true
        }
        return record.fileType?.lowercased().hasPrefix("image/") == true
    }

    private var fallbackIcon: String {
        record.category == .prescription ? "pills" : "doc.text.magnifyingglass"
    }

    private var fallbackTitle: String {
        if record.fileType?.lowercased().contains("pdf") == true || record.fileName.lowercased().hasSuffix(".pdf") {
            return "PDF ready to open"
        }
        return "Original file ready"
    }

    private var fallbackMessage: String {
        if record.fileKey == nil {
            return "No stored file path is attached yet."
        }
        return "Open or share the original file to review it."
    }
}

private struct LocalImagePreview: View {
    let url: URL

    var body: some View {
        if let image = UIImage(contentsOfFile: url.path) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity, minHeight: 220)
        } else {
            PreviewFallback(icon: "photo", title: "Image preview unavailable", message: "Open the original file to review it.")
        }
    }
}

private struct PDFPreview: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.backgroundColor = UIColor.clear
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {
        if view.document?.documentURL != url {
            view.document = PDFDocument(url: url)
        }
    }
}

private struct PreviewFile: Identifiable {
    let id = UUID()
    let url: URL
}

private struct QuickLookPreview: UIViewControllerRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator(url: url)
    }

    func makeUIViewController(context: Context) -> QLPreviewController {
        let controller = QLPreviewController()
        controller.dataSource = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: QLPreviewController, context: Context) {
        context.coordinator.url = url
        controller.reloadData()
    }

    final class Coordinator: NSObject, QLPreviewControllerDataSource {
        var url: URL

        init(url: URL) {
            self.url = url
        }

        func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
            1
        }

        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            url as NSURL
        }
    }
}

private struct PreviewFallback: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title.weight(.semibold))
                .foregroundStyle(HealthFolioTheme.blue)
                .frame(width: 62, height: 62)
                .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 20))
            Text(title)
                .font(.headline)
                .foregroundStyle(HealthFolioTheme.ink)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .padding(28)
        .frame(maxWidth: .infinity, minHeight: 220)
    }
}

private struct FilePreviewSummary: View {
    let record: HealthRecord
    let metadata: RemoteFileMetadata?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(record.fileName)
                    .font(.title3.bold())
                    .lineLimit(2)
                Spacer(minLength: 8)
                Text(extensionLabel)
                    .font(.caption.bold())
                    .foregroundStyle(HealthFolioTheme.blue)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(HealthFolioTheme.blue.opacity(0.12), in: Capsule())
            }

            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var extensionLabel: String {
        let ext = (record.fileName as NSString).pathExtension.uppercased()
        if !ext.isEmpty { return ext }
        if let type = metadata?.contentType ?? record.fileType {
            return typeLabel(type).uppercased()
        }
        return record.source.uppercased()
    }

    private var message: String {
        if record.status == .failed {
            return "Upload needs attention. Try the original PDF or a clearer image."
        }
        if record.valueCount > 0 {
            return "Stored securely in HealthFolio. \(record.valueCount) extracted value\(record.valueCount == 1 ? "" : "s") are linked to this file."
        }
        return "Stored securely in HealthFolio. OCR values will appear here after processing."
    }
}

private struct MetadataGrid: View {
    let record: HealthRecord
    let metadata: RemoteFileMetadata?
    let hasSignedURL: Bool

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10)
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
            MetadataCell(label: "Type", value: typeLabel(metadata?.contentType ?? record.fileType))
            MetadataCell(label: "Size", value: fileSize)
            MetadataCell(label: "Source", value: source)
            MetadataCell(label: "Record date", value: formatted(record.sourceDate))
            MetadataCell(label: "Added", value: formatted(record.createdAt))
            MetadataCell(label: "OCR", value: ocrStatus)
        }
    }

    private var fileSize: String {
        guard let fileSize = metadata?.fileSize else { return "Not reported" }
        return ByteCountFormatter.string(fromByteCount: fileSize, countStyle: .file)
    }

    private var source: String {
        if record.emailIngestKey?.isEmpty == false { return "Email" }
        if hasSignedURL || record.fileKey != nil { return "Secure storage" }
        return "No file"
    }

    private var ocrStatus: String {
        if let completed = record.ocrCompletedAt {
            return "Read \(formatted(completed))"
        }
        if record.status == .inProgress {
            return "\(record.ocrProgress)% \(record.ocrStage ?? "reading")"
        }
        return record.ocrStatusRaw?.replacingOccurrences(of: "_", with: " ").capitalized ?? record.status.label
    }
}

private struct MetadataCell: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(HealthFolioTheme.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.82)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(HealthFolioTheme.background, in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct InlineNotice: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(HealthFolioTheme.blue)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 2)
    }
}

private struct RemoteFileMetadata {
    let contentType: String?
    let fileSize: Int64?
    let lastModified: String?

    init(response: HTTPURLResponse) {
        contentType = response.value(forHTTPHeaderField: "Content-Type")
        if let length = response.value(forHTTPHeaderField: "Content-Length"), let value = Int64(length) {
            fileSize = value
        } else {
            fileSize = nil
        }
        lastModified = response.value(forHTTPHeaderField: "Last-Modified")
    }
}

private func typeLabel(_ raw: String?) -> String {
    guard let raw, !raw.isEmpty else { return "File" }
    let lower = raw.lowercased()
    if lower.contains("pdf") { return "PDF" }
    if lower.hasPrefix("image/") { return "Image" }
    return raw
}

private func formatted(_ date: Date?) -> String {
    guard let date else { return "Unknown" }
    return date.formatted(.dateTime.month(.abbreviated).day().year())
}

#Preview {
    NavigationStack {
        DocumentDetailNativeView(record: HealthFolioPreviewData.records[1])
    }
}
