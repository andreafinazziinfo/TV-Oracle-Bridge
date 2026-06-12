# TV-Oracle-Bridge — Multi-Phase Implementation Plan

This document outlines the operational plan for the subsequent phases of work on the `TV-Oracle-Bridge` repository. 

---

## Phase 1: Parity Suite for Pine Runtime

### Objective
Create a test suite that executes custom Pine Scripts programmatically via the `pinets` runtime, runs the same scripts on TradingView via Playwright automation, captures and compares the outputs (plots/series data), and reports any discrepancies.

### Tasks
1. Create a parity test script `tests/test_pine_parity.py` (or Node equivalent) that:
   - Takes a list of test scripts from `out/spike_tests/`.
   - Executes them locally via `pinets` (through `pineTranspilerWrapper.mjs`).
   - Fetches the same indicator outputs from TradingView using `fetchIndicator.mjs`.
   - Aligns timestamps and evaluates deviations or numeric differences between the local plot series and the real TradingView plots.
2. Compile results into a Markdown report `out/PINE_PARITY_REPORT.md` mapping functions that drift or fail.

### Files to Modify / Create
- [NEW] `tests/test_pine_parity.py` (or `tests/node/test_pine_parity.test.mjs`)
- [NEW] `out/PINE_PARITY_REPORT.md` (generated dynamically)

### Completion Criteria
- Parity comparisons run automatically without hanging.
- A clean markdown compatibility report is compiled containing results for core functions (EMA, RSI, SMA, crossing conditions).

### Regression Risks
- None. This is a validation suite and has zero impact on the production indicators runtime.

---

## Phase 2: Remote Control Hardening

### Objective
Improve the reliability of Playwright automation inside `remoteControl.mjs` against TradingView DOM shifts, connection lags, or login expiration states.

### Tasks
1. Audit selector strings in `remoteControl.mjs` and establish a **Selector Failure Matrix**.
2. Add structured fallback mechanisms: if standard chart selectors fail to find DOM elements within the timeout, attempt multiple retry cycles with alternate selectors or simulate raw click events at coordinates.
3. Handle session failures: detect redirection states to `/signin` or `/login` pages and throw a specific, clean error ("sessionid_expired") that is caught by the Express server and triggers dashboard notifications.

### Files to Modify
- [MODIFY] [remoteControl.mjs](file:///c:/Users/Andrea/dev/tv-oracle-bridge/remoteControl.mjs) (harden browser launch parameters and selector wait hooks)

### Completion Criteria
- Screenshot and macro commands survive simulated 5-second WebSocket connection timeouts.
- Redirection states are correctly identified and throw clean session errors.

### Regression Risks
- Selector updates could break existing screenshot functions if selectors are mapped incorrectly. Verification requires running screenshot unit tests before commits.

---

## Phase 3: Integration Contract for CycleLab

### Objective
Establish a formal, documented contract (JSON schema, MCP Tool schemas, error codes) of the bridge service to ensure stable integration with the CycleLab Terminal.

### Tasks
1. Define a standardized JSON response envelope for indicator fetches, screenshots, and screener results.
2. Document all exposed tools, query schemas, and standard error returns (e.g. `SESSION_EXP`, `INDICATOR_NOT_FOUND`, `WS_TIMEOUT`).
3. Compile this contract into a markdown document `docs/INTEGRATION_CONTRACT.md`.

### Files to Modify / Create
- [NEW] `docs/INTEGRATION_CONTRACT.md`
- [MODIFY] [mcp_server.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/mcp_server.py) (align tool JSON returns with the schema contract)

### Completion Criteria
- The integration contract is fully documented.
- All FastMCP tools return envelopes matching the defined schemas.

### Regression Risks
- Modifying return envelopes of existing MCP tools could break clients expecting raw strings. This requires aligning with CycleLab's developers before merging.

---

## Phase 4: Test Expansion

### Objective
Increase test coverage across all REST routes, daemon operations, notifier scripts, and MCP server endpoints.

### Tasks
1. Add Express routing flow tests in `tests/node/test_dashboard_api.test.mjs` covering background daemon start/stop cycles and system logs fetching.
2. Create unit tests for Python modules: `notifier.py`, `screener.py`, and `tv_cache.py`.
3. Establish a mock-based test suite for FastMCP server tool execution.

### Files to Modify / Create
- [MODIFY] [tests/node/test_dashboard_api.test.mjs](file:///c:/Users/Andrea/dev/tv-oracle-bridge/tests/node/test_dashboard_api.test.mjs)
- [NEW] `tests/test_notifier.py` / `tests/test_screener.py`

### Completion Criteria
- Node.js and Python test coverage covers 90%+ of routing logic and utility functions.
- All tests execute and pass locally via `npm test`.

### Regression Risks
- Low risk. Only test scripts are added or updated.

---

## Phase 5: MCP Server Modularization (Optional / If Needed)

### Objective
Cleanly divide the growing `mcp_server.py` codebase into specialized sub-modules to ease maintenance and testing if tool registry counts increase.

### Tasks
1. If the tool count gets high, create a `tools/` directory.
2. Move tool function groups into specialized modules:
   - `tools/indicator_tools.py`
   - `tools/screener_tools.py`
   - `tools/chart_tools.py`
   - `tools/pine_tools.py`
3. Import and register these tools programmatically inside `mcp_server.py`, keeping it as a clean registration hub.

### Files to Modify / Create
- [MODIFY] [mcp_server.py](file:///c:/Users/Andrea/dev/tv-oracle-bridge/mcp_server.py)
- [NEW] `tools/` modules

### Completion Criteria
- `mcp_server.py` behaves as a minimal registration controller.
- AI clients consume MCP server tools without seeing any breaking changes.

### Regression Risks
- High risk of breaking tool names, signatures, or registration decorators. Requires rigorous regression testing of the MCP server after refactoring.
