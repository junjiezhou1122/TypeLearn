import AppKit
import ApplicationServices
import Foundation

@Observable
final class CaptureMonitor {
    private(set) var latestCapturedText: String?
    private(set) var latestSourceApp: String?
    private(set) var statusMessage = "Capture is idle."
    private(set) var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var buffer = ""
    private var lastEventDate = Date.distantPast
    private var lastBundleIdentifier: String?
    private var lastAppName: String?
    private let excludedBundleIdentifiers: Set<String> = [
        "com.apple.systempreferences",
        "com.apple.SecurityAgent"
    ]

    var onCapture: ((String, String?) -> Void)?

    var isActive: Bool { eventTap != nil }

    deinit {
        stop()
    }

    func start() {
        guard eventTap == nil else { return }

        guard CGPreflightListenEventAccess() else {
            statusMessage = "Input Monitoring permission is required."
            return
        }

        let mask = (1 << CGEventType.keyDown.rawValue)
            | (1 << CGEventType.leftMouseDown.rawValue)
            | (1 << CGEventType.rightMouseDown.rawValue)
            | (1 << CGEventType.otherMouseDown.rawValue)
        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .listenOnly,
            eventsOfInterest: CGEventMask(mask),
            callback: { _, type, event, userInfo in
                guard let userInfo else {
                    return Unmanaged.passUnretained(event)
                }

                let monitor = Unmanaged<CaptureMonitor>.fromOpaque(userInfo).takeUnretainedValue()

                if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
                    if let tap = monitor.eventTap {
                        CGEvent.tapEnable(tap: tap, enable: true)
                    }
                    monitor.statusMessage = "Event tap was disabled; re-enabled."
                    return Unmanaged.passUnretained(event)
                }

                if type == .leftMouseDown || type == .rightMouseDown || type == .otherMouseDown {
                    monitor.handlePointerEvent()
                    return Unmanaged.passUnretained(event)
                }

                guard type == .keyDown else {
                    return Unmanaged.passUnretained(event)
                }

                monitor.handle(cgEvent: event)
                return Unmanaged.passUnretained(event)
            },
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        ) else {
            statusMessage = "Could not create a global event tap."
            return
        }

        statusMessage = "Listening for global typing in normal apps."
        eventTap = tap
        runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)

        if let runLoopSource {
            CFRunLoopAddSource(CFRunLoopGetMain(), runLoopSource, .commonModes)
        }

        CGEvent.tapEnable(tap: tap, enable: true)
    }

    func stop() {
        if let eventTap {
            CGEvent.tapEnable(tap: eventTap, enable: false)
            CFMachPortInvalidate(eventTap)
            self.eventTap = nil
        }

        if let runLoopSource {
            CFRunLoopRemoveSource(CFRunLoopGetMain(), runLoopSource, .commonModes)
            self.runLoopSource = nil
        }

        statusMessage = "Capture is idle."
        lastBundleIdentifier = nil
        lastAppName = nil
    }

    private func handle(cgEvent: CGEvent) {
        guard let event = NSEvent(cgEvent: cgEvent) else {
            return
        }

        guard let frontmostApp = NSWorkspace.shared.frontmostApplication else {
            statusMessage = "Could not determine the active app."
            return
        }

        let bundleId = frontmostApp.bundleIdentifier ?? ""
        if excludedBundleIdentifiers.contains(bundleId) {
            statusMessage = "Capture skipped in excluded or sensitive apps."
            return
        }

        if bundleId != lastBundleIdentifier {
            flushBuffer(for: lastAppName ?? frontmostApp.localizedName)
            lastBundleIdentifier = bundleId
            lastAppName = frontmostApp.localizedName
        }

        let now = Date()
        if now.timeIntervalSince(lastEventDate) > 0.6 {
            flushBuffer(for: frontmostApp.localizedName)
        }
        lastEventDate = now

        let keyCode = event.keyCode
        if isBackspaceKey(keyCode: keyCode) {
            if !buffer.isEmpty {
                buffer.removeLast()
            }
            return
        }

        guard let characters = (event.characters?.isEmpty == false ? event.characters : event.charactersIgnoringModifiers),
              !characters.isEmpty else {
            return
        }

        if characters == "\r" || characters == "\n" {
            flushBuffer(for: frontmostApp.localizedName)
            return
        }

        if characters == "\u{7F}" {
            if !buffer.isEmpty {
                buffer.removeLast()
            }
            return
        }

        guard shouldCapture(event: event, characters: characters) else {
            return
        }

        buffer.append(characters)
        latestSourceApp = frontmostApp.localizedName
        statusMessage = "Capturing from \(frontmostApp.localizedName ?? "the active app")."

        if characters == "." || characters == "!" || characters == "?" {
            flushBuffer(for: frontmostApp.localizedName)
        }
    }

    private func shouldCapture(event: NSEvent, characters: String) -> Bool {
        if event.modifierFlags.contains(.command) || event.modifierFlags.contains(.control) || event.modifierFlags.contains(.option) {
            return false
        }

        return characters.rangeOfCharacter(from: .alphanumerics.union(.whitespaces).union(.punctuationCharacters)) != nil
    }

    private func flushBuffer(for sourceApp: String?) {
        let trimmed = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
        defer { buffer = "" }

        guard trimmed.count >= 2 else { return }

        latestCapturedText = trimmed
        latestSourceApp = sourceApp
        statusMessage = "Captured text from \(sourceApp ?? "the active app")."
        onCapture?(trimmed, sourceApp)
    }

    private func handlePointerEvent() {
        flushBuffer(for: lastAppName)
    }

    private func isBackspaceKey(keyCode: UInt16) -> Bool {
        return keyCode == 51 || keyCode == 117
    }

}
