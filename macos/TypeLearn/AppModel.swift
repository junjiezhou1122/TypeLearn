import Foundation

@Observable
final class AppModel {
    let onboardingModel = OnboardingViewModel()
    let serviceClient = ServiceClient()
    let captureMonitor = CaptureMonitor()

    var draftText = ""

    init() {
        let submit: (String, String?) -> Void = { [weak self] text, appName in
            guard let self else { return }
            self.draftText = text
            Task {
                await self.serviceClient.submitArtifact(sourceText: text, sourceApp: appName)
            }
        }

        captureMonitor.onCapture = submit
    }

    @MainActor
    func bootstrap() async {
        onboardingModel.refreshPermissions()
        onboardingModel.startPolling()
        await serviceClient.refreshHealth()
    }

    /// Start both the CGEvent tap (English) and the AX text capture (IME/Chinese).
    func startCapture() {
        captureMonitor.start()
    }

    /// Stop both capture paths.
    func stopCapture() {
        captureMonitor.stop()
    }

    var isCaptureActive: Bool {
        captureMonitor.isActive
    }
}
