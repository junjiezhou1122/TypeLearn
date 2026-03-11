import AppKit
import ApplicationServices
import Foundation

/// Monitors the focused text field's value via the Accessibility API.
/// This captures composed IME text (Chinese, Japanese, etc.) that CGEvent
/// taps cannot see, since IME-committed characters bypass keyDown events.
@Observable
final class AXTextCapture {
    private(set) var statusMessage = "AX capture is idle."
    private(set) var latestCapturedText: String?
    private(set) var latestSourceApp: String?
    private(set) var debugSelectedText: String?
    private(set) var debugSelectedRangeText: String?
    private(set) var debugValueText: String?
    private(set) var debugRole: String?
    private(set) var debugSubrole: String?
    private(set) var debugFocusedRole: String?
    private(set) var debugFocusedSubrole: String?
    private(set) var debugObserverStatus: String?
    private(set) var debugObserverEvent: String?
    private(set) var debugAvailableAttributes: [String] = []
    private(set) var debugBundleId: String?

    private var pollTimer: Timer?
    private var previousValue: String = ""
    private var previousElementHash: CFHashCode = 0
    private var observer: AXObserver?
    private var observerRunLoopSource: CFRunLoopSource?
    private var observedPid: pid_t?
    private let excludedBundleIdentifiers: Set<String> = [
        "com.apple.systempreferences",
        "com.apple.SecurityAgent"
    ]

    var onCapture: ((String, String?) -> Void)?

    var isActive: Bool { pollTimer != nil }

    deinit {
        stop()
    }

    func start() {
        guard pollTimer == nil else { return }

        guard AXIsProcessTrusted() else {
            statusMessage = "Accessibility permission is required for IME capture."
            return
        }

        previousValue = ""
        previousElementHash = 0

        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { [weak self] _ in
            self?.poll()
        }

        statusMessage = "Listening for text changes via Accessibility."
    }

    func stop() {
        pollTimer?.invalidate()
        pollTimer = nil
        previousValue = ""
        previousElementHash = 0
        statusMessage = "AX capture is idle."
        debugSelectedText = nil
        debugSelectedRangeText = nil
        debugValueText = nil
        debugRole = nil
        debugSubrole = nil
        debugFocusedRole = nil
        debugFocusedSubrole = nil
        debugObserverStatus = nil
        debugObserverEvent = nil
        debugAvailableAttributes = []
        debugBundleId = nil
        teardownObserver()
    }

    // MARK: - Private

    private func poll() {
        guard let app = NSWorkspace.shared.frontmostApplication else { return }

        let bundleId = app.bundleIdentifier ?? ""
        if excludedBundleIdentifiers.contains(bundleId) {
            return
        }
        debugBundleId = bundleId

        let appElement = AXUIElementCreateApplication(app.processIdentifier)
        ensureObserver(for: app.processIdentifier)
        enableManualAccessibility(for: appElement)

        guard let focused = focusedElement(appElement: appElement) else {
            statusMessage = "No focused AX element found."
            return
        }
        debugFocusedRole = role(of: focused)
        debugFocusedSubrole = subrole(of: focused)

        let element = findTextElement(from: focused, depth: 0) ?? focused
        let elementHash = CFHash(element)
        debugRole = role(of: element)
        debugSubrole = subrole(of: element)
        debugAvailableAttributes = attributeNames(of: element)

        // When the user switches to a different text field, reset tracking.
        if elementHash != previousElementHash {
            previousElementHash = elementHash
            previousValue = currentValue(of: element) ?? ""
            return
        }

        guard let value = currentValue(of: element) else { return }
        guard value != previousValue else { return }

        let delta = extractDelta(old: previousValue, new: value)
        previousValue = value

        let trimmed = delta.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return }

        // Only emit if the delta contains non-ASCII characters (IME output)
        // to avoid duplicating what the CGEvent tap already captures.
        let hasNonASCII = trimmed.unicodeScalars.contains { $0.value > 127 }
        guard hasNonASCII else { return }

        latestCapturedText = trimmed
        latestSourceApp = app.localizedName
        statusMessage = "Captured IME text from \(app.localizedName ?? "the active app")."
        onCapture?(trimmed, app.localizedName)
    }

    private func currentValue(of element: AXUIElement) -> String? {
        let selected = selectedText(of: element)
        let rangeText = selectedRangeText(of: element)
        let valueText = valueText(of: element)

        debugSelectedText = selected
        debugSelectedRangeText = rangeText
        debugValueText = valueText
        debugRole = role(of: element)
        debugSubrole = subrole(of: element)

        return selected ?? rangeText ?? valueText
    }

    private func findTextElement(from element: AXUIElement, depth: Int) -> AXUIElement? {
        if depth > 3 {
            return nil
        }

        if hasReadableText(element) {
            return element
        }

        var childrenRef: AnyObject?
        let result = AXUIElementCopyAttributeValue(
            element,
            kAXChildrenAttribute as CFString,
            &childrenRef
        )
        guard result == .success, let children = childrenRef as? [AXUIElement] else { return nil }

        for child in children {
            if let match = findTextElement(from: child, depth: depth + 1) {
                return match
            }
        }

        return nil
    }

    private func hasReadableText(_ element: AXUIElement) -> Bool {
        if let selected = selectedText(of: element), !selected.isEmpty {
            return true
        }

        if let rangeText = selectedRangeText(of: element), !rangeText.isEmpty {
            return true
        }

        if let value = valueText(of: element), !value.isEmpty {
            return true
        }

        let roleValue = role(of: element) ?? ""
        return ["AXTextField", "AXTextArea", "AXWebArea"].contains(roleValue)
    }

    private func attributeNames(of element: AXUIElement) -> [String] {
        var namesRef: CFArray?
        let result = AXUIElementCopyAttributeNames(element, &namesRef)
        guard result == .success, let names = namesRef as? [String] else { return [] }
        return names.sorted()
    }

    private func selectedText(of element: AXUIElement) -> String? {
        var selectedRef: AnyObject?
        let result = AXUIElementCopyAttributeValue(
            element,
            kAXSelectedTextAttribute as CFString,
            &selectedRef
        )
        guard result == .success, let str = selectedRef as? String, !str.isEmpty else { return nil }
        return str
    }

    private func valueText(of element: AXUIElement) -> String? {
        var valueRef: AnyObject?
        let result = AXUIElementCopyAttributeValue(
            element,
            kAXValueAttribute as CFString,
            &valueRef
        )
        guard result == .success, let str = valueRef as? String, !str.isEmpty else { return nil }
        return str
    }

    private func selectedRangeText(of element: AXUIElement) -> String? {
        var rangeRef: AnyObject?
        let rangeResult = AXUIElementCopyAttributeValue(
            element,
            kAXSelectedTextRangeAttribute as CFString,
            &rangeRef
        )
        guard rangeResult == .success, let rangeRef else { return nil }
        let rangeValue = rangeRef as! AXValue
        guard AXValueGetType(rangeValue) == .cfRange else { return nil }

        var range = CFRange()
        guard AXValueGetValue(rangeValue, .cfRange, &range) else { return nil }
        guard range.length > 0 else { return nil }

        var textRef: AnyObject?
        let textResult = AXUIElementCopyParameterizedAttributeValue(
            element,
            kAXStringForRangeParameterizedAttribute as CFString,
            rangeValue,
            &textRef
        )
        guard textResult == .success, let text = textRef as? String, !text.isEmpty else { return nil }
        return text
    }

    private func role(of element: AXUIElement) -> String? {
        var roleRef: AnyObject?
        let result = AXUIElementCopyAttributeValue(
            element,
            kAXRoleAttribute as CFString,
            &roleRef
        )
        guard result == .success, let role = roleRef as? String else { return nil }
        return role
    }

    private func subrole(of element: AXUIElement) -> String? {
        var subroleRef: AnyObject?
        let result = AXUIElementCopyAttributeValue(
            element,
            kAXSubroleAttribute as CFString,
            &subroleRef
        )
        guard result == .success, let subrole = subroleRef as? String else { return nil }
        return subrole
    }

    private func focusedElement(appElement: AXUIElement) -> AXUIElement? {
        let systemWide = AXUIElementCreateSystemWide()
        var focusedRef: AnyObject?
        let systemResult = AXUIElementCopyAttributeValue(
            systemWide,
            kAXFocusedUIElementAttribute as CFString,
            &focusedRef
        )
        if systemResult == .success, let focusedRef {
            return focusedRef as! AXUIElement
        }

        let appResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXFocusedUIElementAttribute as CFString,
            &focusedRef
        )
        if appResult == .success, let focusedRef {
            return focusedRef as! AXUIElement
        }

        return nil
    }

    private func enableManualAccessibility(for appElement: AXUIElement) {
        let manualAttr = "AXManualAccessibility" as CFString
        AXUIElementSetAttributeValue(appElement, manualAttr, kCFBooleanTrue)
    }

    private func ensureObserver(for pid: pid_t) {
        if observedPid == pid, observer != nil {
            return
        }

        teardownObserver()
        observedPid = pid

        var newObserver: AXObserver?
        let result = AXObserverCreate(pid, { _, _, notification, refcon in
            guard let refcon else { return }
            let instance = Unmanaged<AXTextCapture>.fromOpaque(refcon).takeUnretainedValue()
            instance.debugObserverEvent = notification as String
            instance.statusMessage = "AX observer saw \(notification)."
            instance.poll()
        }, &newObserver)

        guard result == .success, let createdObserver = newObserver else {
            debugObserverStatus = "AXObserverCreate failed (\(result.rawValue))."
            return
        }

        observer = createdObserver
        let notifications: [CFString] = [
            kAXFocusedUIElementChangedNotification as CFString,
            kAXValueChangedNotification as CFString,
            kAXSelectedTextChangedNotification as CFString
        ]

        let appElement = AXUIElementCreateApplication(pid)
        for notification in notifications {
            AXObserverAddNotification(createdObserver, appElement, notification, Unmanaged.passUnretained(self).toOpaque())
        }

        observerRunLoopSource = AXObserverGetRunLoopSource(createdObserver)
        if let source = observerRunLoopSource {
            CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
            debugObserverStatus = "AXObserver running"
        } else {
            debugObserverStatus = "AXObserver missing run loop source"
        }
    }

    private func teardownObserver() {
        if let source = observerRunLoopSource {
            CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes)
        }
        observerRunLoopSource = nil
        observer = nil
        observedPid = nil
    }


    /// Extract the newly typed portion by comparing old and new field values.
    private func extractDelta(old: String, new: String) -> String {
        if new.hasPrefix(old) {
            return String(new.dropFirst(old.count))
        }
        if new.hasSuffix(old) {
            return String(new.dropLast(old.count))
        }
        // If neither prefix nor suffix matches (mid-text edit), return the full
        // new value only when it is longer — avoids false positives on deletions.
        if new.count > old.count {
            return new
        }
        return ""
    }
}
