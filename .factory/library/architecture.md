# Architecture

Architectural decisions and patterns for this mission.

**What belongs here:** boundaries between the macOS app and TypeScript service, persistence patterns, provider abstractions, and UI behavior rules.

---

- The macOS menu bar app owns onboarding, permissions, capture, and user-facing state.
- The local TypeScript service owns provider abstraction, Chinese-to-English generation, English coaching, and Daily Story orchestration.
- Capture is best-effort across apps; unsupported contexts must degrade honestly.
- Provider modes are fixed for this MVP: `Local`, `BYOK remote`, `Custom base URL`.
- Local mode must not send user writing content to remote endpoints.
