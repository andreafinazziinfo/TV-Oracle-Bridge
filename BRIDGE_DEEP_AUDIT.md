# TV-Oracle-Bridge — Deep Architectural Audit Report

**Audit Date:** 2026-06-12  
**Scope:** Full codebase analysis of TV-Oracle-Bridge (15 source files, 1 dashboard SPA, tests, configurations)  
**Objective:** Validate assertions, map file responsibilities, register MCP tools, identify technical debt, and establish architectural boundaries.

---

## 1. Validation of Codebase Assertions

Based on a thorough review of the codebase, we validate the following claims from the operational review:

1. **Vulnerabilities S1, S2, and S3 are FULLY MITIGATED**:
   - **S1 (Command Injection)**: In `dashboard/server.mjs`, all user-controlled command executions (such as download, custom screener queries, and yield extraction) are spawned securely using `execFileAsync` (from `child_process.execFile`) instead of passing raw string templates into a shell command interpreter (`child_process.exec`).
   - **S2 (XSS via innerHTML)**: In `dashboard/public/app.js`, dynamic text values loaded from the server are sanitized using a new `escapeHtml()` helper before insertion, neutralizing potential script tags or malicious event handlers.
   - **S3 (Path Traversal)**: In `dashboard/server.mjs`, the `/api/indicators/:key` endpoint uses `sanitizeKey(req.params.key)` to ensure the parameter contains only alphanumeric characters, underscores, and dashes, preventing directory traversal via `..` sequences.
2. **Economic Calendar & News Feed are INTEGRATED**:
   - `macro_data.py` implements calendar scraping via TradingView's JSON feeds and Yahoo Finance RSS news aggregation.
   - These feeds are exposed via FastMCP tools: `get_economic_calendar` and `get_market_news` inside `mcp_server.py`.
3. **AST Pine Linter & Compiler Check are INTEGRATED**:
   - `pineTranspilerWrapper.mjs` runs local script transpilation in V8 using Node.js's programmatically loaded `pinets` library.
   - `pine_docs.py` implements a linter (`validate_pine_code`) that runs static regex/bracket check routines and overlays a programmatic transpilation run.
4. **Active SQLite Persistence & Telemetry are INTEGRATED**:
   - `tv_cache.py` manages historical OHLCV data under a local SQLite table (`bars`).
   - It performs automated delta-sync logic (reducing WebSocket stream time from 20s to 8s) and records execution metadata inside a `runs` schema database table.

---

## 2. File Responsibility Map

### 2.1 Core Bridge & Browser Automation Layer (Node.js)
- [fetchIndicator.mjs](file:///c:/Users/Andrea/dev/tv-oracle-bridge/fetchIndicator.mjs): Establishes WebSocket channels using `@mathieuc/tradingview`, subscribes to study streams, parses lazy tables into static arrays, and dumps raw period series and OHLC candles to JSON caches.
- [remoteControl.mjs](file:///c:/Users/Andrea/dev/tv-oracle-bridge/remoteControl.mjs): Playwright controller for capturing high-resolution chart screenshots, drawing HTML5 Canvas pattern annotations, executing UI hotkey macros, extracting bond yields/heatmaps/options, and downloading source code from public script URLs.
- [session_helper.mjs](file:///c:/Users/Andrea/dev/tv-oracle-bridge/session_helper.mjs): Launches a visible browser window prompting the operator for TradingView authentication and updates the local `.env` with new cookies.
- [build_pine_docs.mjs](file:///c:/Users/Andrea/dev/tv-oracle-bridge/build_pine_docs.mjs): Scraper that crawls TradingView's documentation sitemap or parses community signatures to generate the offline docs JSON.
- [pineTranspilerWrapper.mjs](file:///c:/Users/Andrea/dev/tv-oracle-bridge/pineTranspilerWrapper.mjs): Isolated wrapper executing `pinets` transpilation in a safe Node process.
- [apply-lib-patch.mjs](file:///c:/Users/Andrea/dev/tv-oracle-bridge/apply-lib-patch.mjs): `postinstall` patch replacing `@mathieuc/tradingview` buffer parsers to handle large base64 protocol updates.

### 2.2 Quantitative Analysis & Data Layer (Python)
- [mcp_server.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/mcp_server.py): Gateway registering 17 FastMCP tools and orchestrating subprocesses and module logic.
- [screener.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/screener.py) / [screener_core.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/screener_core.py) / [screener_presets.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/screener_presets.py): Advanced screener client supporting 23 presets, local Python filters, and custom JSON query filters.
- [tv_cache.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/tv_cache.py): Ephemeral caching controller inside SQLite supporting WAL journaling, telemetry runs logging, and delta-sync merge computations.
- [pattern_detector.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/pattern_detector.py): Candlestick classifier locating Doji, Hammer, Shooting Star, and Engulfing structures on price data.
- [pine_docs.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/pine_docs.py): Offline reference manual browser and linter combining typo lookups (`difflib`) and PineTS transpiler compilation checks.
- [notifier.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/notifier.py): Zero-dependency webhook wrapper using Python's stdlib `urllib` to dispatch text and image attachments to Telegram and Discord.
- [offline_pine_runtime.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/offline_pine_runtime.py): Spike script evaluating local calculations. Concludes in a **NO-GO** decision for full offline execution due to structural math drift and missing multi-timeframe (`request.security`) resolving support.

### 2.3 Technical Dashboard (Express & SPA)
- [dashboard/server.mjs](file:///c:/Users/Andrea/dev/tv-oracle-bridge/dashboard/server.mjs): Express router serving static assets, caching daemon management commands, logs consolidation, and data proxy endpoints.
- [dashboard/public/index.html](file:///c:/Users/Andrea/dev/tv-oracle-bridge/dashboard/public/index.html) / [app.js](file:///c:/Users/Andrea/dev/tv-oracle-bridge/dashboard/public/app.js) / [style.css](file:///c:/Users/Andrea/dev/tv-oracle-bridge/dashboard/public/style.css): Neon dark-mode admin dashboard that displays caching charts, log files, sitemaps, downloads, and preset controls.

---

## 3. Active MCP Tools

The FastMCP server exposes 17 developer-ready tools to AI clients:

1. `fetch_indicator`: WebSocket delta-fetch stream.
2. `get_run_history`: Retrieve execution telemetry and synchronization runs history.
3. `list_indicators`: List private account indicator invite keys.
4. `capture_screenshot`: Capture chart layout PNGs with canvas overlays.
5. `refresh_session_credentials`: Launch session refresher utility.
6. `run_screener`: Query TradingView scanner API using predefined presets.
7. `run_custom_screener`: Run arbitrary scanner query fields and filters.
8. `detect_patterns`: Classify candlestick patterns in price cache data.
9. `get_pine_docs`: Offline Pine Script documentation lookup.
10. `validate_pine_code`: Syntax linter + transpiler verification.
11. `transpile_pine_script`: Transpile Pine to JS code.
12. `download_public_script`: Download source code from open script pages.
13. `control_chart_macro`: Execute UI chart macros (timeframe, symbol, save, clear drawings).
14. `get_structured_market_data`: Intercept options chain, heatmaps, and yields curve data.
15. `send_notification`: Webhook notifier to Discord/Telegram.
16. `get_economic_calendar`: Macroeconomic economic events calendar.
17. `get_market_news`: Asset news feed headlines.

---

## 4. Technical Debt Inventory

### 4.1 Critical Debt
- **Missing Integration Tests (D1)**: No integration test suite checks the MCP gateway directly (`mcp_server.py`).
- **Cache DB Initialization Overhead (D4)**: `tv_cache.py` runs `init_db()` redundantly on multiple entrypoints. Centralizing db creation into a single initializer is recommended.
- **Daemon Persistence (D6)**: The Express auto-caching daemon state is kept in-memory. If the server crashes, the daemon running configuration is lost.
- **Boilerplate UTF-8 stdout configuration (D11)**: Multiple Python scripts duplicate `init_io()` reconfigure calls instead of centralizing them into a single decorator or module utility.

---

## 5. Architectural Boundaries — What TV-Oracle-Bridge IS and IS NOT

### 5.1 IS (Bounded Context Definition)
```
TV-Oracle-Bridge is a SERVICE LAYER that:
  ├── Extracts data FROM TradingView (WebSocket, scanner API, browser DOM)
  ├── Transforms it into normalized local formats (JSON, SQLite, PNG)
  ├── Exposes it TO AI agents via MCP tools
  ├── Provides debug/admin tooling via a local dashboard
  └── Sends operational notifications via webhooks
```

### 5.2 IS NOT (Anti-Patterns to Avoid)
1. **TradingView Terminal Clone**: The dashboard must remain an admin/debug console. It must not become a user-facing trading UI with active watchlists, charting, or trade execution.
2. **Duplicate Analytics Engine**: Keep calculations, strategy parsing, and indicator logic simple. Complex portfolio management and advanced quant models belong in **CycleLab Terminal**.
3. **Data Warehouse**: The local SQLite database is for caching acceleration, not for long-term quantitative storage or massive historical databases.

---

## 6. Priorities for Phased Execution

1. **Phase 1: Parity Suite for Pine Runtime** (Establish local V8 transpiler plots verification against live WebSocket snapshots).
2. **Phase 2: Remote Control Hardening** (Selector retries, redirect identification, timeout/lags handling).
3. **Phase 3: Integration Contract for CycleLab** (Formalizing responses, error schemas, and contracts).
4. **Phase 4: Test Expansion** (Testing REST endpoints, notifier, and MCP server outputs).
5. **Phase 5: MCP Server Modularization** (Optional splitting of tools into files).
