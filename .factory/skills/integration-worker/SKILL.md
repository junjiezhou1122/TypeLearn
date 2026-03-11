---
name: integration-worker
description: Build and verify cross-boundary features that wire the macOS app, local service, persistence, privacy controls, and user-facing flows together.
---

# integration-worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the work procedure.

## When to Use This Skill

Use this skill for features that span multiple layers:
- repo/workspace scaffolding
- settings wired to service behavior
- Live/Learn/Daily Story integration
- privacy controls that affect app state, storage, and provider traffic
- provider runtime indicators and failure handling

## Work Procedure

1. Read the feature, `mission.md`, `AGENTS.md`, `validation-contract.md`, `.factory/services.yaml`, and relevant library notes before editing.
2. Inspect both the macOS app and TypeScript service codepaths involved. Do not guess interfaces that already exist.
3. Write failing tests first in the most relevant layer(s). If the feature spans both app and service behavior, add the minimum tests needed on each side before implementation.
4. Implement the vertical slice end to end, keeping boundaries explicit: app shell owns UX and capture state; service owns learning/provider orchestration.
5. Manually verify the full user flow named by the feature, not just individual functions. Capture the exact action and observed outcome in the handoff.
6. Run the repo validators from `.factory/services.yaml` plus any focused `xcodebuild test` command needed for changed macOS behavior.
7. Confirm privacy rules at the integration boundary: secure fields, paused capture, excluded apps, deleted content, and Local mode must all be honored downstream.
8. Stop any background services you started before ending the feature session.

## Example Handoff

```json
{
  "salientSummary": "Wired generated learning items into the menu bar Live and Learn surfaces and completed the first-run path from onboarding to the first visible learning item. Added app and service tests for item retention plus manually verified the end-to-end flow in a supported app.",
  "whatWasImplemented": "Connected persisted capture items and generated learning output to the menu bar Live and Learn views, added retention logic so newer items do not displace older Learn entries, and completed the first-run navigation path so a fresh user can see the first learning item after setup and typing in a supported context.",
  "whatWasLeftUndone": "Provider runtime failure behavior is handled by a later feature and was not implemented here.",
  "verification": {
    "commandsRun": [
      {
        "command": "npm run test -- --grep live",
        "exitCode": 0,
        "observation": "Integration-facing service tests for Live/Learn item retention passed."
      },
      {
        "command": "xcodebuild test -project macos/TypeLearn.xcodeproj -scheme TypeLearnApp -destination 'platform=macOS'",
        "exitCode": 0,
        "observation": "macOS tests for menu bar navigation and item rendering passed."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Completed onboarding, typed a Chinese sample in a supported app, and opened the menu bar panel.",
        "observed": "A new learning item appeared in Live, and after another sample it remained accessible in Learn while the newer item replaced it in Live."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "service/src/liveLearn/liveLearnStore.test.ts",
        "cases": [
          {
            "name": "new live item remains accessible in learn history",
            "verifies": "Later items do not erase previously generated Learn entries."
          }
        ]
      },
      {
        "file": "macos/TypeLearnTests/LiveLearnNavigationTests.swift",
        "cases": [
          {
            "name": "fresh user reaches first learning item after onboarding",
            "verifies": "The first-run flow reaches a visible Live learning item after setup and a supported typing event."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The feature requires a new product decision about privacy, provider behavior, or supported-app guarantees.
- A required layer is missing such that the feature would require unplanned foundational work outside reasonable scope.
- Manual validation cannot be completed because the necessary macOS or provider environment is unavailable.
