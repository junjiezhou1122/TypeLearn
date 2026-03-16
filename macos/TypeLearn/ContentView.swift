import AppKit
import SwiftUI

struct ContentView: View {
    @Bindable var appModel: AppModel
    @State private var advancedExpanded = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                capturePanel

                if !appModel.onboardingModel.isInputMonitoringGranted {
                    permissionsPanel
                }

                recentCapturesPanel
                advancedPanel
            }
            .padding(18)
        }
        .frame(width: 420, height: 560)
        .background(UITheme.canvas)
        .preferredColorScheme(.light)
        .task {
            await appModel.bootstrap()
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("TypeLearn")
                    .font(.system(size: 21, weight: .semibold, design: .rounded))
                    .foregroundStyle(UITheme.ink)

                Text("Capture first. Everything else stays out of the way.")
                    .font(.system(size: 12))
                    .foregroundStyle(UITheme.subtleText)

                HStack(spacing: 8) {
                    StatusPill(label: permissionHeadline, color: permissionColor)
                    StatusPill(label: serviceLabel, color: serviceColor)
                }
            }

            Spacer()

            Button {
                NSApplication.shared.terminate(nil)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(UITheme.mutedText)
                    .frame(width: 22, height: 22)
                    .background(UITheme.softFill)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
        }
    }

    private var capturePanel: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(captureHeadline)
                        .font(.system(size: 24, weight: .semibold, design: .rounded))
                        .foregroundStyle(UITheme.ink)

                    Text(captureSubheadline)
                        .font(.system(size: 13))
                        .foregroundStyle(UITheme.subtleText)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let latest = appModel.captureMonitor.latestCapturedText, !latest.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Latest capture")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(UITheme.mutedText)

                            Spacer()

                            if let sourceApp = appModel.captureMonitor.latestSourceApp {
                                Text(sourceApp)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(UITheme.faintText)
                            }
                        }

                        Text("“\(latest)”")
                            .font(.system(size: 14))
                            .foregroundStyle(UITheme.ink)
                            .lineLimit(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(UITheme.softBlueFill)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }

                HStack(spacing: 10) {
                    Button(appModel.isCaptureActive ? "Stop capture" : "Start capture") {
                        if appModel.isCaptureActive {
                            appModel.stopCapture()
                        } else {
                            appModel.startCapture()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .tint(appModel.isCaptureActive ? UITheme.stopAccent : UITheme.primaryAccent)
                    .disabled(!appModel.onboardingModel.isInputMonitoringGranted)

                    if !appModel.onboardingModel.isInputMonitoringGranted {
                        Button("Grant permission") {
                            appModel.onboardingModel.requestPermissionPrompts()
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                        .tint(UITheme.secondaryAccent)
                    }
                }

                HStack(spacing: 8) {
                    Circle()
                        .fill(appModel.isCaptureActive ? UITheme.success : UITheme.faintText.opacity(0.7))
                        .frame(width: 8, height: 8)

                    Text(appModel.captureMonitor.statusMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(UITheme.subtleText)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var permissionsPanel: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Permissions")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(UITheme.ink)

                VStack(alignment: .leading, spacing: 10) {
                    permissionRow(
                        title: "Input Monitoring",
                        detail: "Required. Without it, capture cannot run outside this app.",
                        granted: appModel.onboardingModel.isInputMonitoringGranted
                    )
                }

                HStack(spacing: 10) {
                    Button("Request again") {
                        appModel.onboardingModel.requestPermissionPrompts()
                    }
                    .buttonStyle(.bordered)

                    Button("Open Privacy Settings") {
                        openPrivacyPane()
                    }
                    .buttonStyle(.bordered)

                    Spacer()

                    Button("Refresh") {
                        appModel.onboardingModel.refreshPermissions()
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(UITheme.subtleText)
                }

                Text("After granting Input Monitoring, macOS may require restarting TypeLearn before capture works.")
                    .font(.system(size: 11))
                    .foregroundStyle(UITheme.faintText)
            }
        }
    }

    private var recentCapturesPanel: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Recent captures")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(UITheme.ink)
                    Spacer()
                    if !appModel.serviceClient.records.isEmpty {
                        Text("Latest 3")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(UITheme.faintText)
                    }
                }

                if appModel.serviceClient.records.isEmpty {
                    Text("No captures yet. Start capture, then type in any app.")
                        .font(.system(size: 12))
                        .foregroundStyle(UITheme.faintText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    VStack(spacing: 8) {
                        ForEach(appModel.serviceClient.records.prefix(3)) { record in
                            captureRow(record)
                        }
                    }
                }
            }
        }
    }

    private var advancedPanel: some View {
        SurfaceCard {
            DisclosureGroup(isExpanded: $advancedExpanded) {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Service")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(UITheme.mutedText)

                        HStack {
                            Text(serviceDetails)
                                .font(.system(size: 12))
                                .foregroundStyle(UITheme.subtleText)
                            Spacer()
                            Button {
                                Task { await appModel.serviceClient.refreshHealth() }
                            } label: {
                                Image(systemName: "arrow.clockwise")
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(UITheme.subtleText)
                        }
                    }
                }
                .padding(.top, 12)
            } label: {
                HStack {
                    Text("Advanced")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(UITheme.ink)
                    Spacer()
                    Text("Service only")
                        .font(.system(size: 11))
                        .foregroundStyle(UITheme.faintText)
                }
            }
            .tint(UITheme.ink)
        }
    }

    private func captureRow(_ record: CaptureRecord) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    if let sourceApp = record.sourceApp, !sourceApp.isEmpty {
                        Text(sourceApp)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(UITheme.mutedText)
                    }

                    Text(record.createdAt.shortTime)
                        .font(.system(size: 11))
                        .foregroundStyle(UITheme.faintText)
                }

                Text(recordDisplayText(record))
                    .font(.system(size: 12))
                    .lineLimit(2)
                    .foregroundStyle(UITheme.ink)
            }

            Spacer(minLength: 8)

            Button {
                Task { await appModel.serviceClient.deleteRecord(id: record.id) }
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(UITheme.faintText)
                    .frame(width: 20, height: 20)
            }
            .buttonStyle(.plain)
        }
        .padding(10)
        .background(UITheme.softFill)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func permissionRow(title: String, detail: String, granted: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: granted ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .foregroundStyle(granted ? UITheme.success : UITheme.warning)
                .font(.system(size: 14))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(UITheme.ink)
                Text(detail)
                    .font(.system(size: 12))
                    .foregroundStyle(UITheme.subtleText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()
        }
    }

    private func openPrivacyPane() {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent") else {
            return
        }
        NSWorkspace.shared.open(url)
    }

    private func recordDisplayText(_ record: CaptureRecord) -> String {
        if let restored = record.restoredText, !restored.isEmpty {
            return restored
        }
        if !record.sourceText.isEmpty {
            return record.sourceText
        }
        return record.englishText
    }

    private var permissionHeadline: String {
        appModel.onboardingModel.isInputMonitoringGranted ? "Permission ready" : "Permission needed"
    }

    private var permissionColor: Color {
        appModel.onboardingModel.isInputMonitoringGranted ? UITheme.success : UITheme.warning
    }

    private var captureHeadline: String {
        if !appModel.onboardingModel.isInputMonitoringGranted {
            return "Enable permission to start capture."
        }
        return appModel.isCaptureActive ? "Capture is running." : "Ready to capture."
    }

    private var captureSubheadline: String {
        if !appModel.onboardingModel.isInputMonitoringGranted {
            return "TypeLearn only needs Input Monitoring to listen for typing across apps."
        }
        if appModel.isCaptureActive {
            return "Keep typing anywhere on macOS. TypeLearn will collect short text snippets in the background."
        }
        return "Start capture when you want TypeLearn to observe what you type in other apps."
    }

    private var serviceColor: Color {
        switch appModel.serviceClient.state {
        case .connected:
            return UITheme.success
        case .connecting:
            return UITheme.warning
        case .failed:
            return UITheme.stopAccent
        case .idle:
            return UITheme.faintText
        }
    }

    private var serviceLabel: String {
        switch appModel.serviceClient.state {
        case .connected:
            return "Service online"
        case .connecting:
            return "Service connecting"
        case .failed:
            return "Service offline"
        case .idle:
            return "Service idle"
        }
    }

    private var serviceDetails: String {
        switch appModel.serviceClient.state {
        case .connected(let health):
            return "\(health.service) is ready."
        case .connecting:
            return "Connecting to the local service."
        case .failed(let message):
            return message
        case .idle:
            return "Service has not been checked yet."
        }
    }
}

private struct SurfaceCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(18)
            .background(UITheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(UITheme.border, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.04), radius: 12, x: 0, y: 6)
    }
}

private struct StatusPill: View {
    let label: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 7, height: 7)

            Text(label)
                .font(.system(size: 11, weight: .medium))
        }
        .foregroundStyle(UITheme.subtleText)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(UITheme.softFill)
        .clipShape(Capsule())
    }
}

private enum UITheme {
    static let canvas = Color(red: 0.975, green: 0.979, blue: 0.989)
    static let card = Color(red: 0.996, green: 0.997, blue: 1.0)
    static let softFill = Color(red: 0.949, green: 0.957, blue: 0.973)
    static let softBlueFill = Color(red: 0.933, green: 0.956, blue: 0.995)
    static let border = Color(red: 0.875, green: 0.903, blue: 0.946)
    static let ink = Color(red: 0.106, green: 0.129, blue: 0.18)
    static let subtleText = Color(red: 0.345, green: 0.396, blue: 0.49)
    static let mutedText = Color(red: 0.446, green: 0.49, blue: 0.58)
    static let faintText = Color(red: 0.575, green: 0.616, blue: 0.69)
    static let primaryAccent = Color(red: 0.356, green: 0.588, blue: 0.951)
    static let secondaryAccent = Color(red: 0.835, green: 0.889, blue: 0.972)
    static let stopAccent = Color(red: 0.918, green: 0.411, blue: 0.411)
    static let success = Color(red: 0.188, green: 0.696, blue: 0.416)
    static let warning = Color(red: 0.941, green: 0.592, blue: 0.149)
}

private extension String {
    var shortTime: String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: self) ?? ISO8601DateFormatter().date(from: self)
        guard let date else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

#Preview {
    ContentView(appModel: AppModel())
}
