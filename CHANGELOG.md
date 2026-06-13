# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-06-13

### Added
- Local Pine Script sandbox in the dashboard: offline indicator evaluation (PineTS + `@opus-aether-ai/pine-transpiler`) and C++ strategy backtests (PineForge Docker), rendered on Lightweight Charts with entries/exits, volume, and custom plot lines.
- GitHub Actions CI (`.github/workflows/ci.yml`): ruff lint gate + Python and Node test suites on `ubuntu-latest`.
- CodeQL static analysis (`.github/workflows/codeql.yml`) for Python and JavaScript/TypeScript.
- Dependabot (`.github/dependabot.yml`) for pip, npm, and GitHub Actions updates.
- `ruff.toml` lint configuration (E + F rule set).
- `examples/` with runnable REST, screener, alert-ingestion, and MCP-config samples.
- `docs/TROUBLESHOOTING.md` covering native-binding, CRLF, Playwright, Docker, and MCP setup issues.
- `.gitattributes` to normalize line endings to LF.
- Pull request template.

### Changed
- Split `docker-compose.yml` into separate `mcp-server` and `dashboard` services.
- `README.md`: documented the local sandbox and compiler integration; corrected test counts.

### Security
- Added `express-rate-limit` (120 req/min) on the unauthenticated `/api` surface, which spawns subprocesses and touches disk.
- Added a resolved-path containment check to `/api/indicators/:key` (defense-in-depth over the existing key sanitizer).
- Set least-privilege `permissions: contents: read` on the CI workflow.
- Resolved the CodeQL alerts surfaced by enabling code scanning.

### Fixed
- Resolved a Lightweight Charts API crash, the `pineforge_codegen` module import, and a Linux path-sanitization error.
- Resolved Docker container startup failures, a port conflict, and a `node_modules` platform mismatch.
- Committed `pine_docs_db.json` so the offline Pine docs/linter work on clean clones.
- Made the `fetchIndicator` TV_SESSION test independent of the gitignored `indicators.local.json`.
- Replaced deprecated `datetime.utcnow()` with timezone-aware datetimes in `mcp_server.py`.
- Removed a dead variable assignment and unused imports flagged by ruff.

## [1.0.0]

### Added
- Initial public release: TradingView ↔ AI bridge with MCP server, REST dashboard,
  SQLite caching, offline Pine Script runtime/parity suite, screener, pattern
  detector, macro/news feeds, and Playwright-based chart capture.
- Apache-2.0 licensing and security hardening (command-injection, XSS, path-traversal mitigations).

[Unreleased]: https://github.com/andreafinazziinfo/TV-Oracle-Bridge/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/andreafinazziinfo/TV-Oracle-Bridge/compare/v1.0.0...v1.2.0
[1.0.0]: https://github.com/andreafinazziinfo/TV-Oracle-Bridge/releases/tag/v1.0.0
