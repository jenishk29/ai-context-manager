# Changelog

All notable changes to `@jenishk29/ai-context-manager` will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
and [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] - 2026-03-03

### Added

- **CLI** (`acm` / `ai-context-manager`) with five commands:
  - `acm init` — interactive project initializer with auto stack detection
  - `acm snapshot` — generates a rich AI handoff file (Markdown + JSON)
  - `acm stats` — displays snapshot history and token usage
  - `acm validate` — validates `.contextbridge.json` schema and file paths
  - `acm doctor` — self-diagnostic health check
- **`ContextManager` library** — programmatic event tracking API with:
  - `addEvent()`, `updateEvent()`, `abortEvent()`, `removeEvent()`
  - `getHistory()` with filtering by tool, user, operation, status
  - `export()` / `import()` for cross-session context sharing
  - `prune()` for token budget management
  - `rollbackToEvent()` for soft and hard rollbacks
  - `validateAccuracy()` for state auditing
- **Token estimation** — built-in estimator for context size awareness
- **Secret scanning** — prevents accidental exposure of credentials in handoffs
- **Git integration** — auto-captures branch, commits, status in snapshots
- **Stack detection** — auto-detects Node.js, Python, Go, Rust, Java, and more
- **Schema validation** — AJV-powered JSON Schema validation for all data
- **TypeScript** — full type definitions included
- **Dual module format** — CJS and ESM builds
- **JSON Schemas** — exported for external use via `@jenishk29/ai-context-manager/schemas/*`

[1.0.0]: https://github.com/jenishk29/ai-context-manager/releases/tag/v1.0.0
