import Foundation

struct PermissionStatus: Identifiable {
    let id: String
    let title: String
    let granted: Bool
    let detail: String
}

@Observable
final class OnboardingViewModel {
    private let permissionMonitor: PermissionMonitoring

    var permissions: [PermissionStatus] = []
    var bundleIdentifier = ""
    var bundlePath = ""

    init(permissionMonitor: PermissionMonitoring = PermissionMonitor()) {
        self.permissionMonitor = permissionMonitor
        refreshPermissions()
    }

    func refreshPermissions() {
        let snapshot = permissionMonitor.currentSnapshot()
        bundleIdentifier = snapshot.bundleIdentifier
        bundlePath = snapshot.bundlePath
        permissions = [
            PermissionStatus(
                id: "accessibility",
                title: "Accessibility",
                granted: snapshot.accessibilityGranted,
                detail: snapshot.accessibilityGranted
                    ? "Granted. TypeLearn can inspect richer UI context in future capture flows."
                    : "Optional for richer app context. Not required for the current event-tap capture path."
            ),
            PermissionStatus(
                id: "input-monitoring",
                title: "Input Monitoring",
                granted: snapshot.inputMonitoringGranted,
                detail: snapshot.inputMonitoringGranted
                    ? "Granted. Best-effort capture can observe normal text entry."
                    : "Needed for global keyboard event listening outside TypeLearn."
            )
        ]
    }

    func requestPermissionPrompts() {
        permissionMonitor.requestAccessibilityPrompt()
        permissionMonitor.requestInputMonitoringPrompt()
    }

    /// Polls every 2 seconds until Input Monitoring is granted.
    /// Safe to call multiple times — only one polling loop runs at a time.
    func startPolling() {
        guard !isInputMonitoringGranted else { return }
        Task { @MainActor [weak self] in
            while let self, !self.isInputMonitoringGranted {
                try? await Task.sleep(for: .seconds(2))
                self.refreshPermissions()
            }
        }
    }

    var nextStep: String {
        isInputMonitoringGranted ? "Start typing in a supported app" : "Input Monitoring"
    }

    var isAccessibilityGranted: Bool {
        permissions.first(where: { $0.id == "accessibility" })?.granted ?? false
    }

    var isInputMonitoringGranted: Bool {
        permissions.first(where: { $0.id == "input-monitoring" })?.granted ?? false
    }

    var captureSummary: String {
        isInputMonitoringGranted
            ? "Ready for best-effort capture in supported apps."
            : "Capture stays off until Input Monitoring is granted."
    }

    var diagnosticsSummary: String {
        "Bundle ID: \(bundleIdentifier)\nBundle Path: \(bundlePath)\nAccessibility: \(isAccessibilityGranted ? "granted" : "not granted")\nInput Monitoring: \(isInputMonitoringGranted ? "granted" : "not granted")"
    }
}
