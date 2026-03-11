# Provider Routing

Notes about provider behavior, routing, and privacy boundaries.

**What belongs here:** provider-mode rules, generation routing expectations, and error-handling conventions.

---

- Remote provider use is optional and user-configured.
- Connection testing must validate generation readiness, not only endpoint reachability.
- Switching provider modes should affect only later generations; earlier generated artifacts stay stable unless explicitly regenerated.
- Broken provider configuration must fail clearly while preserving capture history and earlier outputs.
