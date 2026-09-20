import SwiftUI

struct AssistantNativeView: View {
    @EnvironmentObject private var model: HealthFolioAppModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var question = ""
    @State private var isShowingClearConfirmation = false
    @FocusState private var isComposerFocused: Bool

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 24) {
                    assistantHeader

                    ForEach(model.assistantMessages) { message in
                        AssistantBubble(message: message, sourceRecords: model.sourceRecords(for: message))
                            .id(message.id)
                    }

                    if model.isAssistantThinking {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text("Reading records")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .frame(minHeight: 44)
                        .accessibilityElement(children: .combine)
                    }

                    if model.assistantMessages.count <= 1 && !model.isAssistantThinking {
                        quickPrompts
                    }

                    Color.clear.frame(height: 1).id("assistant-bottom")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 20)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(HealthFolioTheme.background)
            .navigationTitle("Assistant")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom, spacing: 0) { composer }
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done", action: dismissKeyboard)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { isShowingClearConfirmation = true } label: {
                        Label("Clear conversation", systemImage: "trash")
                            .labelStyle(.iconOnly)
                    }
                    .disabled(model.assistantMessages.count <= 1 || model.isAssistantThinking)
                }
            }
            .confirmationDialog("Clear this conversation?", isPresented: $isShowingClearConfirmation, titleVisibility: .visible) {
                Button("Clear conversation", role: .destructive, action: model.clearAssistantHistory)
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Messages for this profile will be removed from this device. Your health records will not be deleted.")
            }
            .navigationDestination(for: AssistantSourceRoute.self) { route in
                if let record = model.records.first(where: { $0.id == route.recordID }) {
                    DocumentDetailNativeView(record: record)
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "doc.badge.clock")
                            .font(.largeTitle)
                            .accessibilityHidden(true)
                        Text("Source unavailable").font(.headline)
                        Text("This record is no longer loaded for the current profile.")
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .navigationTitle("Source")
                }
            }
            .onAppear {
                if let last = model.assistantMessages.last, model.assistantMessages.count > 1 {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
            .onChange(of: model.assistantMessages.last?.id) { _ in
                scrollToBottom(proxy)
            }
            .onChange(of: model.isAssistantThinking) { thinking in
                if thinking { scrollToBottom(proxy) }
            }
        }
    }

    private var assistantHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label {
                Text(model.profile.isPrimary ? model.profile.name : model.profile.displayName)
                    .font(.headline)
                    .fixedSize(horizontal: false, vertical: true)
            } icon: {
                Image(systemName: "person.crop.circle")
                    .foregroundStyle(HealthFolioTheme.blue)
            }

            statsLayout {
                AssistantStat(label: "Records", value: "\(model.records.count)")
                AssistantStat(label: "Markers", value: "\(model.latestMetrics.count)")
                AssistantStat(label: "Flags", value: "\(model.flaggedMetrics.count)")
            }

            Text("Based on uploaded records and extracted readings. No diagnosis or medication dosing.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Divider()
        }
    }

    private var quickPrompts: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Suggested questions")
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)
                .padding(.bottom, 8)
            ForEach(HealthFolioPreviewData.prompts) { prompt in
                Button { ask(prompt.body, clearsComposer: false) } label: {
                    HStack(alignment: .center, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(prompt.title).font(.subheadline.bold())
                            Text(prompt.body)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.up.left")
                            .foregroundStyle(.secondary)
                            .accessibilityHidden(true)
                    }
                    .padding(.vertical, 12)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(isComposerDisabled)
                Divider()
            }
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .bottom, spacing: 10) {
                TextField("Ask about your records", text: $question, axis: .vertical)
                    .lineLimit(1...(dynamicTypeSize.isAccessibilitySize ? 3 : 5))
                    .focused($isComposerFocused)
                    .textFieldStyle(.plain)
                    .textInputAutocapitalization(.sentences)
                    .accessibilityLabel("Message to HealthFolio Assistant")
                    .disabled(isComposerDisabled)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 12)
                    .background(HealthFolioTheme.card, in: RoundedRectangle(cornerRadius: 8))
                    .overlay {
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(HealthFolioTheme.border, lineWidth: 1)
                    }

                Button(action: sendQuestion) {
                    Label("Send message", systemImage: "arrow.up")
                        .labelStyle(.iconOnly)
                        .font(.headline)
                        .frame(width: 48, height: 48)
                        .background(canSend ? HealthFolioTheme.blue : HealthFolioTheme.border, in: Circle())
                        .foregroundStyle(canSend ? Color.white : HealthFolioTheme.inkSoft)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
            }

            if cleanQuestion.count > maximumQuestionCharacters {
                Text("Message is too long: \(cleanQuestion.count) of \(maximumQuestionCharacters) characters.")
                    .font(.caption)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text("AI can make mistakes. It does not replace clinician advice.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .frame(maxWidth: 760)
        .frame(maxWidth: .infinity)
        .background(.regularMaterial)
        .overlay(alignment: .top) { Divider() }
    }

    private var cleanQuestion: String { question.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var isComposerDisabled: Bool { model.isAssistantThinking || model.isSwitchingProfile }
    private var maximumQuestionCharacters: Int { model.assistantRemoteConfig?.maxQuestionCharacters ?? 2_000 }
    private var statsLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
            : AnyLayout(HStackLayout(alignment: .top, spacing: 16))
    }
    private var canSend: Bool {
        !cleanQuestion.isEmpty && cleanQuestion.count <= maximumQuestionCharacters && !isComposerDisabled
    }

    private func sendQuestion() {
        guard canSend else { return }
        ask(cleanQuestion, clearsComposer: true)
    }

    private func ask(_ text: String, clearsComposer: Bool) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !isComposerDisabled, !trimmed.isEmpty, trimmed.count <= maximumQuestionCharacters else { return }
        model.askHealthFolio(trimmed)
        if clearsComposer { question = "" }
        dismissKeyboard()
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) {
            proxy.scrollTo("assistant-bottom", anchor: .bottom)
        }
    }

    private func dismissKeyboard() {
        isComposerFocused = false
    }
}

private struct AssistantStat: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value).font(.headline)
            Text(label).font(.footnote).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) \(label)")
    }
}

#Preview {
    NavigationStack {
        AssistantNativeView()
            .environmentObject(HealthFolioAppModel())
    }
}
