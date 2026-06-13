# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub Actions CI (`.github/workflows/ci.yml`): ruff lint gate + Python and Node test suites on `ubuntu-latest`.
- CodeQL static analysis (`.github/workflows/codeql.yml`) for Python and JavaScript/TypeScript.
- Dependabot (`.github/dependabot.yml`) for pip, npm, and GitHub Actions updates.
- `ruff.toml` lint configuration (E + F rule set).
- `examples/` with runnable REST, screener, alert-ingestion, and MCP-config samples.
- `docs/TROUBLESHOOTING.md` covering native-binding, CRLF, Playwright, Docker, and MCP setup issues.
- `.gitattributes` to normalize line endings to LF.
- Pull request template.

### Changed
- `README.md`: corrected test counts.

### Fixed
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

[Unreleased]: https://github.com/andreafinazziinfo/TV-Oracle-Bridge/compare/main...HEAD
