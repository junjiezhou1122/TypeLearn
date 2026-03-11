# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** required tools, local dependencies, provider credential notes, platform caveats.
**What does NOT belong here:** service ports or commands; those belong in `.factory/services.yaml`.

---

- Required local tools: full Xcode, Swift toolchain, Node, npm.
- Provider credentials are optional for early work because Local mode is part of the product contract.
- Store provider secrets in macOS Keychain when introduced; do not commit secrets.
- Remote provider testing may be unavailable until a valid API key and model are supplied by the user.
