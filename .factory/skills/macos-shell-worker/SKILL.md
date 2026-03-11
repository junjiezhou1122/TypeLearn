---
name: macos-shell-worker
description: Build and verify SwiftUI/AppKit menu bar app features, macOS permissions, and capture-facing UX.
---

# macos-shell-worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the work procedure.

## When to Use This Skill

Use this skill for features centered on the macOS app shell:
- menu bar UI and navigation
- onboarding and permission guidance
- capture-state UX
- best-effort capture behavior and honest fallback UX
- macOS-side privacy behavior tied to secure fields or permission changes

## Work Procedure

1. Read `mission.md`, the assigned feature in `features.json`, `AGENTS.md`, and relevant `.factory/library/*.md` files.
2. Inspect the current macOS project structure and existing SwiftUI/AppKit patterns before editing.
3. Write or update Swift/macOS tests first so the target behavior fails before implementation.
4. Implement the smallest app-layer change needed to satisfy the feature without expanding scope.
5. If capture behavior depends on macOS permission or AX state, add explicit user-visible status handling instead of hiding platform uncertainty.
6. Manually verify the feature on-device in a real macOS session. For capture work, test at least one supported text context and any edge context named by the feature.
7. Run the relevant validators from `.factory/services.yaml`, plus focused `xcodebuild test` commands for changed app behavior.
8. Before handoff, confirm no UI copy overpromises universal capture and no secure-field behavior violates mission boundaries.

## Example Handoff

```json
{
  "salientSummary": "Built the menu bar onboarding shell with separate Accessibility/Input Monitoring status and a blocked capture state until permissions are granted. Added macOS unit tests for permission-state rendering and manually verified the first-launch flow on device.",
  "whatWasImplemented": "Created the initial menu bar window group, onboarding state model, permission status section, and blocked-state UI copy. The app now distinguishes Accessibility from Input Monitoring, shows the next setup step, and never presents capture as active before required permissions are granted.",
  "whatWasLeftUndone": "Did not implement live capture yet; the shell only exposes onboarding and readiness state.",
  "verification": {
    "commandsRun": [
      {
        "command": "xcodebuild test -project macos/TypeLearn.xcodeproj -scheme TypeLearnApp -destination 'platform=macOS'",
        "exitCode": 0,
        "observation": "Swift unit tests for onboarding and permission-state rendering passed."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Launched the app from a clean state without permissions and opened the menu bar panel.",
        "observed": "Onboarding copy appeared, both permission rows were shown separately, and capture state remained blocked."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "macos/TypeLearnTests/OnboardingViewModelTests.swift",
        "cases": [
          {
            "name": "shows blocked state when accessibility is missing",
            "verifies": "The onboarding model does not present capture as ready when Accessibility is not granted."
          },
          {
            "name": "shows separate status rows for each required permission",
            "verifies": "The shell distinguishes Accessibility and Input Monitoring in the visible state."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The feature requires a TypeScript/provider capability that does not exist yet.
- macOS permissions or platform APIs behave inconsistently enough that the agreed UX contract cannot be honored without changing scope.
- The required manual validation surface is unavailable on the machine.
