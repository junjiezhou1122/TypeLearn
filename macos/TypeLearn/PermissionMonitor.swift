import ApplicationServices
import AppKit
import Foundation

struct PermissionSnapshot {
    let accessibilityGranted: Bool
    let inputMonitoringGranted: Bool
    let bundleIdentifier: String
    let bundlePath: String
}

protocol PermissionMonitoring {
    func currentSnapshot() -> PermissionSnapshot
    func requestAccessibilityPrompt()
    func requestInputMonitoringPrompt()
}

struct PermissionMonitor: PermissionMonitoring {
    func currentSnapshot() -> PermissionSnapshot {
        PermissionSnapshot(
            accessibilityGranted: AXIsProcessTrusted(),
            inputMonitoringGranted: CGPreflightListenEventAccess(),
            bundleIdentifier: Bundle.main.bundleIdentifier ?? "unknown-bundle-id",
            bundlePath: Bundle.main.bundleURL.path
        )
    }

    func requestAccessibilityPrompt() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
    }

    func requestInputMonitoringPrompt() {
        _ = CGRequestListenEventAccess()
    }
}
