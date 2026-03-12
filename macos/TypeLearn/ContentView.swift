import AppKit
import SwiftUI

// MARK: - Root view

struct ContentView: View {
    @Bindable var appModel: AppModel
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            Divider()
            tabBar
            Divider()
            tabContent
        }
        .frame(width: 380)
        .task {
            await appModel.bootstrap()
        }
    }

    // MARK: Header

    private var headerBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "text.badge.checkmark")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.blue)

            Text("TypeLearn")
                .font(.headline)

            Spacer()

            statusBadge

            Button {
                NSApplication.shared.terminate(nil)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 18, height: 18)
                    .background(Color(.quaternarySystemFill))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var statusBadge: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(serviceColor)
                .frame(width: 7, height: 7)
            Text(serviceLabel)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var serviceColor: Color {
        switch appModel.serviceClient.state {
        case .connected: .green
        case .connecting: .orange
        case .failed: .red
        case .idle: .secondary
        }
    }

    private var serviceLabel: String {
        switch appModel.serviceClient.state {
        case .connected: "Online"
        case .connecting: "Connecting…"
        case .failed: "Offline"
        case .idle: "Idle"
        }
    }

    // MARK: Tab bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabItem("Dashboard", icon: "chart.bar.fill", index: 0)
            tabItem("Learn", icon: "book.pages.fill", index: 1)
            tabItem("Settings", icon: "gearshape.fill", index: 2)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 5)
    }

    private func tabItem(_ label: String, icon: String, index: Int) -> some View {
        let active = selectedTab == index
        return Button {
            withAnimation(.easeInOut(duration: 0.12)) { selectedTab = index }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                Text(label)
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundStyle(active ? .primary : .secondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 7)
                    .fill(active ? Color(.selectedContentBackgroundColor).opacity(0.25) : .clear)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: Tab content

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case 0:
            DashboardTab(appModel: appModel, switchToSettings: { selectedTab = 2 })
        case 1:
            LearnTab(appModel: appModel)
        default:
            SettingsTab(appModel: appModel)
        }
    }
}

// MARK: - Dashboard Tab

private struct DashboardTab: View {
    var appModel: AppModel
    let switchToSettings: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                serviceCard
                captureCard
                learningCard
            }
            .padding(16)
        }
        .frame(height: 460)
    }

    // MARK: Service status card

    @ViewBuilder
    private var serviceCard: some View {
        switch appModel.serviceClient.state {
        case .failed(let message):
            GroupBox {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Local service offline")
                            .font(.callout.weight(.medium))
                        Text(message)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("Run: npm run dev:service")
                            .font(.caption.monospaced())
                            .foregroundStyle(.orange)
                    }
                    Spacer()
                    Button {
                        Task { await appModel.serviceClient.refreshHealth() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
            } label: {
                Label("Service", systemImage: "server.rack")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        case .connecting:
            GroupBox {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Connecting to local service…")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } label: {
                Label("Service", systemImage: "server.rack")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        default:
            EmptyView()
        }
    }

    // MARK: Capture card

    private var captureCard: some View {
        let granted = appModel.onboardingModel.isInputMonitoringGranted
        let active = appModel.isCaptureActive

        return GroupBox {
            if granted {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Label(
                            active ? "Listening for typing…" : "Ready to capture",
                            systemImage: active ? "waveform" : "keyboard"
                        )
                        .font(.callout.weight(.medium))

                        if let latest = appModel.captureMonitor.latestCapturedText {
                            Text("\"\(latest)\"")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        } else if active {
                            Text("Type in any app to begin")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }

                        
                    }

                    Spacer()

                    Button(active ? "Stop" : "Start") {
                        if active { appModel.stopCapture() }
                        else { appModel.startCapture() }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(active ? .red : .blue)
                    .controlSize(.small)
                }
            } else {
                HStack(spacing: 12) {
                    Image(systemName: "keyboard.badge.exclamationmark")
                        .font(.title3)
                        .foregroundStyle(.orange)

                    VStack(alignment: .leading, spacing: 3) {
                        Text("Permission needed")
                            .font(.callout.weight(.medium))
                        Text("Input Monitoring is required to capture typing.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Button("Setup →") { switchToSettings() }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
            }
        } label: {
            Label("Capture", systemImage: "mic")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    // MARK: Learning card

    private var learningCard: some View {
        GroupBox {
            if let artifact = appModel.serviceClient.latestArtifact {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Original")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(artifact.createdAt.shortTime)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    if let restored = artifact.restoredText, !restored.isEmpty {
                        Text(restored)
                            .font(.callout)
                            .foregroundStyle(.blue)
                    } else if artifact.status == "pending" || artifact.status == "processing" {
                        Text("处理中…")
                            .font(.callout)
                            .foregroundStyle(.blue)
                    } else if artifact.status == "failed" {
                        Text("处理失败，将重试")
                            .font(.callout)
                            .foregroundStyle(.red)
                    } else {
                        Text(artifact.sourceText)
                            .font(.callout)
                    }

                    Divider()

                    Text(isLikelyEnglish(artifact.sourceText) ? "Polished" : "Suggestion")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                    Text(artifact.suggestion)
                        .font(.callout)
                        .foregroundStyle(.blue)

                    Text(artifact.explanation)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundStyle(.tertiary)
                    Text("Learning items will appear here after you start typing.")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            }
        } label: {
            Label("Latest Learning Item", systemImage: "lightbulb")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Learn Tab

private struct LearnTab: View {
    @Bindable var appModel: AppModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                manualInputCard
                storyCard
                recordsCard
            }
            .padding(16)
        }
        .frame(height: 460)
    }

    // MARK: Manual input

    private var manualInputCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 8) {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: $appModel.draftText)
                        .font(.callout)
                        .frame(height: 72)
                        .scrollContentBackground(.hidden)

                    if appModel.draftText.isEmpty {
                        Text("Type or paste text to analyze…")
                            .font(.callout)
                            .foregroundStyle(.tertiary)
                            .padding(.top, 2)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
                .padding(6)
                .background(Color(.textBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 7))

                HStack {
                    if let error = appModel.serviceClient.artifactError {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.circle")
                                .foregroundStyle(.red)
                                .font(.caption)
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }
                    Spacer()
                    Button(appModel.serviceClient.isSubmittingArtifact ? "Analyzing…" : "Analyze") {
                        Task {
                            await appModel.serviceClient.submitArtifact(
                                sourceText: appModel.draftText,
                                sourceApp: appModel.captureMonitor.latestSourceApp
                            )
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(
                        appModel.serviceClient.isSubmittingArtifact ||
                        appModel.draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    )
                }
            }
        } label: {
            Label("Try It", systemImage: "text.cursor")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    // MARK: Story

    private var storyCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 8) {
                if let story = appModel.serviceClient.stories.first {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(story.title)
                            .font(.callout.weight(.medium))
                        Text(story.story)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Text("Generate a story after capturing some text today.")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button(appModel.serviceClient.isGeneratingStory ? "Generating…" : "Generate today's story") {
                    Task { await appModel.serviceClient.generateStory() }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(appModel.serviceClient.isGeneratingStory)
            }
        } label: {
            Label("Today's Story", systemImage: "book.closed")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    // MARK: Records

    private var recordsCard: some View {
        GroupBox {
            if appModel.serviceClient.records.isEmpty {
                Text("Captured records will appear here.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
            } else {
                VStack(spacing: 6) {
                    ForEach(appModel.serviceClient.records.prefix(8)) { record in
                        recordRow(record)
                    }
                }
            }
        } label: {
            HStack {
                Label("Captures", systemImage: "tray.full")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if !appModel.serviceClient.records.isEmpty {
                    Text("\(appModel.serviceClient.records.count)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    private func recordRow(_ record: CaptureRecord) -> some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(record.sourceApp ?? "Unknown")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.tertiary)
                    Spacer()
                    Text(record.createdAt.shortTime)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let restored = record.restoredText, !restored.isEmpty {
                    Text(restored)
                        .font(.caption)
                        .foregroundStyle(.blue)
                        .lineLimit(1)
                } else if record.status == "pending" || record.status == "processing" {
                    Text("处理中…")
                        .font(.caption)
                        .foregroundStyle(.blue)
                        .lineLimit(1)
                } else if record.status == "failed" {
                    Text("处理失败，将重试")
                        .font(.caption)
                        .foregroundStyle(.red)
                        .lineLimit(1)
                } else if record.sourceLanguage != "english" {
                    Text(record.sourceText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if record.sourceLanguage == "english" {
                    Text("Polished")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                Text(record.englishText)
                    .font(.caption)
                    .lineLimit(2)
            }

            Button {
                Task { await appModel.serviceClient.deleteRecord(id: record.id) }
            } label: {
                Image(systemName: "trash")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .buttonStyle(.plain)
        }
        .padding(8)
        .background(Color(.windowBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 7))
    }
}

// MARK: - Settings Tab

private struct SettingsTab: View {
    @Bindable var appModel: AppModel
    @State private var baseUrl = ""
    @State private var apiKey = ""
    @State private var model = ""
    @State private var saveConfirmed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                permissionsCard
                providerCard
            }
            .padding(16)
        }
        .frame(height: 460)
        .onAppear {
            let s = appModel.serviceClient.settings
            baseUrl = s.baseUrl
            apiKey = s.apiKey
            model = s.model.isEmpty ? "gpt-4.1-mini" : s.model
        }
    }

    // MARK: Permissions

    private var permissionsCard: some View {
        GroupBox {
            VStack(spacing: 8) {
                ForEach(appModel.onboardingModel.permissions) { permission in
                    permissionRow(permission)
                }

                Divider()

                HStack(spacing: 8) {
                    Button("Request permissions") {
                        appModel.onboardingModel.requestPermissionPrompts()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button("Open Privacy Settings") {
                        openPrivacyPane()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Spacer()

                    Button("Refresh") {
                        appModel.onboardingModel.refreshPermissions()
                    }
                    .buttonStyle(.plain)
                    .controlSize(.small)
                    .foregroundStyle(.secondary)
                }

                if !appModel.onboardingModel.isInputMonitoringGranted {
                    HStack(spacing: 8) {
                        Image(systemName: "info.circle")
                            .foregroundStyle(.orange)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("After granting, restart the app to activate.")
                                .font(.caption)
                            Button("Quit TypeLearn") {
                                NSApplication.shared.terminate(nil)
                            }
                            .font(.caption)
                            .foregroundStyle(.blue)
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        } label: {
            Label("Permissions", systemImage: "hand.raised")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    private func permissionRow(_ permission: PermissionStatus) -> some View {
        HStack(spacing: 10) {
            Image(systemName: permission.granted ? "checkmark.circle.fill" : "circle.dashed")
                .foregroundStyle(permission.granted ? .green : .orange)
                .font(.body)

            VStack(alignment: .leading, spacing: 2) {
                Text(permission.title)
                    .font(.callout.weight(.medium))
                Text(permission.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
    }

    private func openPrivacyPane() {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent") else { return }
        NSWorkspace.shared.open(url)
    }

    // MARK: Provider

    private var providerCard: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 8) {
                providerField("Base URL", value: $baseUrl, placeholder: "https://api.openai.com")
                providerField("API Key", value: $apiKey, placeholder: "sk-…", isSecret: true)
                providerField("Model", value: $model, placeholder: "gpt-4.1-mini")

                HStack {
                    Spacer()
                    if saveConfirmed {
                        Label("Saved", systemImage: "checkmark")
                            .font(.caption)
                            .foregroundStyle(.green)
                            .transition(.opacity)
                    }
                    Button("Save") {
                        appModel.serviceClient.updateSettings(baseUrl: baseUrl, apiKey: apiKey, model: model)
                        Task {
                            await appModel.serviceClient.saveSettings()
                            withAnimation { saveConfirmed = true }
                            try? await Task.sleep(for: .seconds(2))
                            withAnimation { saveConfirmed = false }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                }

                Divider()

                HStack {
                    Text("Version")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(appVersionLabel)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
        } label: {
            Label("AI Provider", systemImage: "cpu")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    private func providerField(_ label: String, value: Binding<String>, placeholder: String, isSecret: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
            if isSecret {
                SecureField(placeholder, text: value)
                    .textFieldStyle(.roundedBorder)
                    .font(.callout)
            } else {
                TextField(placeholder, text: value)
                    .textFieldStyle(.roundedBorder)
                    .font(.callout)
            }
        }
    }

    private var appVersionLabel: String {
        let info = Bundle.main.infoDictionary
        let shortVersion = info?["CFBundleShortVersionString"] as? String ?? "0.0"
        let buildVersion = info?["CFBundleVersion"] as? String ?? "0"
        return "v\(shortVersion) (\(buildVersion))"
    }

}

// MARK: - Helpers

private extension String {
    var shortTime: String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: self) ?? ISO8601DateFormatter().date(from: self)
        guard let date else { return "" }
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm"
        return fmt.string(from: date)
    }
}

private func isLikelyEnglish(_ text: String) -> Bool {
    let hasChinese = text.range(of: "[\\u{4E00}-\\u{9FFF}]", options: .regularExpression) != nil
    let hasLetters = text.range(of: "[A-Za-z]", options: .regularExpression) != nil
    return hasLetters && !hasChinese
}

#Preview {
    ContentView(appModel: AppModel())
}
