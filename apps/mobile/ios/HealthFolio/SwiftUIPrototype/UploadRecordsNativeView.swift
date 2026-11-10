import SwiftUI
import UniformTypeIdentifiers
import PhotosUI
import UIKit

struct UploadRecordsNativeView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var model: HealthFolioAppModel
    @State private var isShowingFileImporter = false
    @State private var photoSelections: [PhotosPickerItem] = []
    @State private var importerSource = "Files"
    @State private var isShowingPrescriptionWarning = false
    @State private var isShowingCameraNote = false

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HealthFolioTheme.spacing) {
                ProfileSwitcherNativeView()

                if !model.isSignedIn {
                    AuthRequiredCard(
                        title: "Sign in before upload",
                        message: "Open Profile, sign in once, then HealthFolio can route uploads to the selected profile."
                    )
                }

                UploadTargetCard()
                UploadGuidanceCard()

                NativeSectionHeader(title: "Source", systemImage: "square.and.arrow.up")

                LazyVGrid(columns: columns, spacing: 12) {
                    SourceChoiceCard(
                        title: "Files",
                        subtitle: "PDF, image",
                        systemImage: "doc.badge.plus",
                        isPrimary: true
                    ) {
                        showImporter(source: "Files")
                    }

                    PhotosPicker(selection: $photoSelections, maxSelectionCount: 12, matching: .images) {
                        SourceChoiceCardContent(
                            title: "Photos",
                            subtitle: "Multi-select",
                            systemImage: "photo.on.rectangle",
                            isPrimary: false
                        )
                    }
                    .buttonStyle(.plain)

                    SourceChoiceCard(
                        title: "Camera",
                        subtitle: "Scan soon",
                        systemImage: "camera",
                        isPrimary: false
                    ) {
                        isShowingCameraNote = true
                    }
                    SourceChoiceCard(
                        title: "Prescription",
                        subtitle: "Rx source",
                        systemImage: "pills",
                        isPrimary: false
                    ) {
                        isShowingPrescriptionWarning = true
                    }
                }

                Text("Uploads route to \(model.profile.displayName). HealthFolio reads medical PDFs and images, flags unclear OCR, and keeps originals private unless you share them.")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)

                if let error = model.lastUploadError {
                    UploadStatusBanner(message: error)
                }

                NativeSectionHeader(title: "Queue", systemImage: "activity")
                if model.uploads.isEmpty {
                    EmptyRecordsState(searchText: "")
                } else {
                    ForEach(model.uploads) { item in
                        UploadQueueRow(
                            item: item,
                            record: model.record(with: item.documentId),
                            profiles: model.availableProfiles,
                            onReassign: { profile in
                                Task { await model.reassignUpload(item, to: profile) }
                            },
                            onRetry: {
                                model.retryUpload(item)
                            },
                            onRemove: {
                                model.removeUpload(item)
                            }
                        )
                    }
                }
            }
            .padding()
        }
        .background(HealthFolioTheme.background)
        .overlay {
            if model.isShowingFirstLaunchGuide, model.firstLaunchGuideStep == .upload {
                UploadSourceCoachmarkOverlay(
                    onPrimary: {
                        model.finishFirstLaunchGuide()
                        showImporter(source: "Files")
                    },
                    onSkip: {
                        model.finishFirstLaunchGuide()
                    }
                )
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
            }
        }
        .animation(.easeInOut(duration: 0.18), value: model.isShowingFirstLaunchGuide)
        .navigationTitle("Add record")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close", action: dismiss.callAsFunction)
            }
        }
        .fileImporter(
            isPresented: $isShowingFileImporter,
            allowedContentTypes: [.pdf, .jpeg, .png],
            allowsMultipleSelection: true,
            onCompletion: handleImportedFiles
        )
        .onChange(of: photoSelections) { selections in
            importPhotoSelections(selections)
        }
        .navigationDestination(for: HealthRecord.self) { record in
            DocumentDetailNativeView(record: record)
        }
        .alert("Verify prescription OCR", isPresented: $isShowingPrescriptionWarning) {
            Button("Choose file") {
                showImporter(source: "Prescription")
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Prescription images can be misread. Review extracted text before relying on it.")
        }
        .alert("Camera scan", isPresented: $isShowingCameraNote) {
            Button("Choose from Files") {
                showImporter(source: "Camera")
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("For this build, choose an existing scan or image. Live camera capture can be layered onto the same OCR route next.")
        }
    }

    private func showImporter(source: String) {
        importerSource = source
        isShowingFileImporter = true
    }

    private func handleImportedFiles(_ result: Result<[URL], Error>) {
        guard case let .success(urls) = result else { return }
        model.importFileURLs(urls, source: importerSource)
    }

    private func importPhotoSelections(_ selections: [PhotosPickerItem]) {
        guard !selections.isEmpty else { return }

        Task {
            var images: [(name: String, data: Data)] = []
            var failedCount = 0

            for (index, selection) in selections.enumerated() {
                do {
                    guard let data = try await selection.loadTransferable(type: Data.self) else {
                        failedCount += 1
                        continue
                    }
                    guard let image = UIImage(data: data),
                          let jpegData = image.jpegData(compressionQuality: 0.92)
                    else {
                        failedCount += 1
                        continue
                    }
                    images.append((name: "Photo Report \(index + 1).jpg", data: jpegData))
                } catch {
                    failedCount += 1
                }
            }

            await MainActor.run {
                if images.isEmpty {
                    model.lastUploadError = "Selected photos could not be read. Try choosing the original image from Files."
                } else {
                    model.importPhotoImages(images)
                    if failedCount > 0 {
                        model.lastUploadError = "\(failedCount) photo\(failedCount == 1 ? "" : "s") could not be read."
                    }
                }
                photoSelections = []
            }
        }
    }

}

private struct UploadTargetCard: View {
    @EnvironmentObject private var model: HealthFolioAppModel

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: model.profile.isPrimary ? "person.crop.circle" : "person.2")
                .font(.headline.weight(.semibold))
                .foregroundStyle(HealthFolioTheme.blue)
                .frame(width: 42, height: 42)
                .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 14))

            VStack(alignment: .leading, spacing: 3) {
                Text("Upload target")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(model.profile.displayName)
                    .font(.headline)
                Text(model.isSignedIn ? model.profile.relationshipLabel : "Sign in required")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }
}

private struct UploadGuidanceCard: View {
    private let acceptedTypes = [
        ("Blood reports", "drop"),
        ("Prescriptions", "pills"),
        ("Medicine lists", "list.clipboard"),
        ("Imaging or scans", "waveform.path.ecg.rectangle"),
        ("Doctor notes", "stethoscope")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "checklist.checked")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(HealthFolioTheme.blue)
                    .frame(width: 42, height: 42)
                    .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 4) {
                    Text("Upload medical records")
                        .font(.headline)
                    Text("Use clear originals when possible. Blurry photos can misread names, medicines, and marker values.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 8) {
                ForEach(acceptedTypes, id: \.0) { item in
                    Label(item.0, systemImage: item.1)
                        .font(.caption.bold())
                        .foregroundStyle(HealthFolioTheme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.82)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(HealthFolioTheme.background, in: RoundedRectangle(cornerRadius: 12))
                }
            }

            Label("HealthFolio checks each upload and will show an error if the file does not look medical.", systemImage: "checkmark.shield")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }
}

private struct UploadSourceCoachmarkOverlay: View {
    let onPrimary: () -> Void
    let onSkip: () -> Void

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                Color.black.opacity(0.34)
                    .ignoresSafeArea()

                VStack {
                    Spacer(minLength: 0)
                    UploadSourceCoachmarkCard(onPrimary: onPrimary, onSkip: onSkip)
                }
                .padding(.horizontal, 18)
                .padding(.bottom, max(18, proxy.safeAreaInsets.bottom + 10))
            }
        }
        .accessibilityElement(children: .contain)
    }
}

private struct UploadSourceCoachmarkCard: View {
    let onPrimary: () -> Void
    let onSkip: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "square.and.arrow.up")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(HealthFolioTheme.blue)
                    .frame(width: 50, height: 50)
                    .background(HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 16))

                VStack(alignment: .leading, spacing: 4) {
                    Text("First steps")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    Text("Upload medical documents")
                        .font(.title3.bold())
                        .foregroundStyle(HealthFolioTheme.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }

            Text("Choose Files or Photos for clear medical PDFs and images. HealthFolio will flag files that do not look like medical records.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 6) {
                ForEach(FirstLaunchGuideStep.allCases) { item in
                    Capsule()
                        .fill(item == .upload ? HealthFolioTheme.blue : HealthFolioTheme.border)
                        .frame(width: item == .upload ? 28 : 8, height: 8)
                }
            }
            .accessibilityHidden(true)

            HStack(spacing: 12) {
                Button("Skip", action: onSkip)
                    .font(.body.bold())
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(HealthFolioTheme.background, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))

                Button("Start upload", action: onPrimary)
                    .font(.body.bold())
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(HealthFolioTheme.blue, in: RoundedRectangle(cornerRadius: HealthFolioTheme.controlRadius))
            }
        }
        .padding(20)
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 26))
        .overlay {
            RoundedRectangle(cornerRadius: 26)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.16), radius: 24, x: 0, y: 12)
    }
}

private struct SourceChoiceCard: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let isPrimary: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            SourceChoiceCardContent(title: title, subtitle: subtitle, systemImage: systemImage, isPrimary: isPrimary)
        }
        .buttonStyle(.plain)
    }
}

private struct SourceChoiceCardContent: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let isPrimary: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: systemImage)
                .font(.title2.weight(.semibold))
                .foregroundStyle(isPrimary ? .white : HealthFolioTheme.blue)
                .frame(width: 42, height: 42)
                .background(isPrimary ? .white.opacity(0.18) : HealthFolioTheme.blueSoft, in: RoundedRectangle(cornerRadius: 14))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline.weight(.semibold))
                Text(subtitle)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(isPrimary ? .white.opacity(0.78) : .secondary)
            }
        }
        .foregroundStyle(isPrimary ? .white : HealthFolioTheme.ink)
        .frame(maxWidth: .infinity, minHeight: 126, alignment: .leading)
        .padding(16)
        .background(isPrimary ? HealthFolioTheme.blue : HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 24))
        .overlay {
            RoundedRectangle(cornerRadius: 24)
                .stroke(isPrimary ? .clear : HealthFolioTheme.border, lineWidth: 1)
        }
    }
}

private struct UploadStatusBanner: View {
    let message: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(HealthFolioTheme.amber)
            Text(message)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(HealthFolioTheme.ink)
            Spacer(minLength: 0)
        }
        .padding()
        .background(Color(red: 1.0, green: 0.96, blue: 0.88), in: RoundedRectangle(cornerRadius: 20))
    }
}

private struct UploadQueueRow: View {
    let item: NativeUploadItem
    let record: HealthRecord?
    let profiles: [HealthFolioProfile]
    let onReassign: (HealthFolioProfile) -> Void
    let onRetry: () -> Void
    let onRemove: () -> Void

    private var tint: Color {
        switch item.status {
        case .analyzed: HealthFolioTheme.green
        case .failed: .red
        case .queued, .uploading, .processing: HealthFolioTheme.blue
        }
    }

    private var icon: String {
        switch item.source {
        case "Camera": "camera"
        case "Photos": "photo"
        case "Prescription": "pills"
        default: "doc.text"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 44, height: 44)
                    .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 15))

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name)
                        .font(.headline)
                        .lineLimit(1)
                    Text(item.message)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Spacer()

                Text(item.status.label)
                    .font(.caption.bold())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(tint.opacity(0.12), in: Capsule())
                    .foregroundStyle(tint)
            }

            ProgressView(value: item.progress)
                .tint(tint)

            HStack(spacing: 10) {
                if let ownerProfileName = item.ownerProfileName {
                    Label(ownerProfileName, systemImage: "person.crop.circle")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)

                if item.status == .failed {
                    Button("Retry", systemImage: "arrow.clockwise", action: onRetry)
                        .font(.caption.bold())
                        .buttonStyle(.bordered)
                }

                if item.status == .analyzed, let record {
                    NavigationLink(value: record) {
                        Label("Open", systemImage: "doc.text.magnifyingglass")
                    }
                    .font(.caption.bold())
                    .buttonStyle(.bordered)
                }

                if item.status == .failed || item.status == .analyzed {
                    Button(role: .destructive, action: onRemove) {
                        Label("Remove from queue", systemImage: "trash")
                    }
                    .labelStyle(.iconOnly)
                    .frame(minWidth: 34, minHeight: 34)
                }
            }

            if item.status == .analyzed, profiles.count > 1 {
                Divider()
                Menu {
                    ForEach(profiles, id: \.id) { profile in
                        Button {
                            onReassign(profile)
                        } label: {
                            Label(profile.displayName, systemImage: profile.id == item.ownerProfileId ? "checkmark" : "person")
                        }
                    }
                } label: {
                    Label("Move to profile", systemImage: "person.crop.circle.badge.arrow.forward")
                        .font(.caption.bold())
                }
            }
        }
        .padding()
        .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(HealthFolioTheme.border, lineWidth: 1)
        }
    }
}

#Preview {
    NavigationStack {
        UploadRecordsNativeView()
            .environmentObject(HealthFolioAppModel())
    }
}
