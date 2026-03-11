---
name: typescript-platform-worker
description: Build and verify the local TypeScript orchestration service, provider abstraction, and learning-generation pipelines.
---

# typescript-platform-worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the work procedure.

## When to Use This Skill

Use this skill for TypeScript-dominant features:
- provider abstraction and routing
- connection testing logic
- Chinese-to-English generation
- English coaching generation
- Daily Story orchestration logic
- persistence schemas or service endpoints that mainly support learning generation

## Work Procedure

1. Read the assigned feature, `mission.md`, `AGENTS.md`, `.factory/services.yaml`, and provider-related library notes.
2. Inspect the current service package structure and reuse existing libraries, request wrappers, and test helpers.
3. Add or update failing TypeScript tests first. Prefer behavior-focused tests over purely structural tests.
4. Implement the smallest service-layer change needed to make the tests pass.
5. If a feature touches provider modes, enforce the privacy contract explicitly: Local mode must not send user writing content to remote endpoints.
6. Run focused TypeScript tests during iteration, then run the service validators from `.factory/services.yaml` before handoff.
7. If the feature affects user-visible output quality, include at least one representative manual sample in the handoff observations.
8. Do not leave long-running dev servers running unless the assigned feature explicitly requires them for manual validation; stop anything you started.

## Example Handoff

```json
{
  "salientSummary": "Implemented the Chinese learning pipeline in the TypeScript service with tests for provider selection, output normalization, and persistence of generated learning items. Verified one representative Chinese sample end to end through the local service API.",
  "whatWasImplemented": "Added a Chinese-input generation route, provider-independent generation adapter, result normalization, and persistence for generated learning items. The pipeline now returns natural-English learning content suitable for the app to surface in Live and Learn.",
  "whatWasLeftUndone": "The macOS UI wiring for these generated items is not part of this feature.",
  "verification": {
    "commandsRun": [
      {
        "command": "npm run test -- --grep chinese",
        "exitCode": 0,
        "observation": "Chinese pipeline tests passed, including provider stub and persistence behavior."
      },
      {
        "command": "npm run typecheck",
        "exitCode": 0,
        "observation": "No TypeScript type errors remain in the service package."
      }
    ],
    "interactiveChecks": [
      {
        "action": "Posted a representative Chinese sample to the local generation endpoint.",
        "observed": "The service returned natural-English learning content instead of a literal echo, and persisted the generated item for later UI use."
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "service/src/learning/chinesePipeline.test.ts",
        "cases": [
          {
            "name": "returns natural english learning content for chinese input",
            "verifies": "The pipeline produces educational English output rather than echoing the source text."
          },
          {
            "name": "uses the selected provider without leaking local mode to remote",
            "verifies": "Provider routing respects the configured mode and privacy boundaries."
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The feature requires macOS UI or permission behavior that does not yet exist.
- The provider contract needs a product decision beyond the agreed Local/BYOK/Custom modes.
- Manual validation shows the agreed output quality bar cannot be met without changing scope or provider assumptions.
