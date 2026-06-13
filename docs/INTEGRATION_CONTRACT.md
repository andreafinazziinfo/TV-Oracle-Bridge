# TV-Oracle-Bridge — Integration Contract

> **Version:** 1.0.0  
> **Date:** 2026-06-12  
> **Bridge Version:** 1.1.0  
> **Status:** Production-Ready  
> **Consumer:** Standalone Client / AI agents via MCP

---

## 1. Overview

TV-Oracle-Bridge is a **specialistic bridge service** that extracts, caches, and serves
TradingView data to consumers — primarily local applications and AI coding agents.

It exposes **two integration surfaces**:

| Surface | Protocol | Port | Authentication |
|---------|----------|------|----------------|
| **MCP Server** | JSON-RPC (stdio) | N/A | None (local process) |
| **Dashboard REST API** | HTTP/JSON | 5000 (configurable) | None (local network only) |

### Architecture Diagram

```
┌─────────────────────┐    MCP (stdio)    ┌──────────────────────┐
│  Client Application │◄────────────────►│   mcp_server.py      │
│  (AI Agent / Backend)│                   │   (FastMCP)          │
└─────────────────────┘                   └──────────┬───────────┘
                                                     │ subprocess
┌─────────────────────┐    HTTP/JSON     ┌───────────▼───────────┐
│  Dashboard UI       │◄───────────────►│  dashboard/server.mjs  │
│  (Web Client)       │                  │  (Express, port 5000)  │
└─────────────────────┘                  └───────────┬───────────┘
                                                     │
                                          ┌──────────▼──────────┐
                                          │  TradingView APIs   │
                                          │  (Charts, Screener, │
                                          │   Calendar, News)   │
                                          └─────────────────────┘
```

---

## 2. MCP Tools — Complete Reference

The MCP server registers **15 tools** via FastMCP. Each tool is callable from
any MCP-compatible client (Claude Desktop, custom AI agent, etc.).

### 2.1 `fetch_indicator`

**Purpose:** Fetch computed indicator output from TradingView with delta-sync caching.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | `string` | `"completa"` | Indicator key from `indicators.json` |
| `range_val` | `int` | `5000` | Number of bars to load |
| `wait_ms` | `int` | `20000` | Streaming wait time in ms before snapshot |

**Response (JSON string):**
```json
{
  "meta": {
    "name": "Indicator Name",
    "symbol": "BINANCE:BTCUSDT",
    "timeframe": "60",
    "pineId": "PUB;abc123",
    "key": "completa"
  },
  "plots": ["Plot1", "Plot2"],
  "graphicSummary": { ... },
  "periodsCount": 5000,
  "strategyReport": { ... },
  "periodsSample": [
    { "time": 1700000000, "plots": { "Plot1": 42.5, "Plot2": -1.2 } }
  ],
  "output_path": "/path/to/out/completa.json",
  "delta_sync": false
}
```

**Error responses:** Plain text string starting with `"Error"`.

**Side effects:**
- Writes full output to `out/<key>.json`
- Merges with SQLite cache (`out/tv_oracle_cache.db`)
- Records run telemetry in `run_history` table

---

### 2.2 `get_run_history`

**Purpose:** Retrieve execution telemetry and sync history.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | `string` | `None` | Optional indicator key filter |
| `limit` | `int` | `50` | Max history entries |

**Response (JSON string):**
```json
[
  {
    "id": 1,
    "key": "completa",
    "symbol": "BINANCE:BTCUSDT",
    "timeframe": "60",
    "started_at": "2026-06-12T10:00:00",
    "finished_at": "2026-06-12T10:00:25",
    "status": "success",
    "bars_requested": 5000,
    "bars_received": 5000,
    "is_delta_sync": false,
    "error_message": null
  }
]
```

---

### 2.3 `list_indicators`

**Purpose:** Enumerate the authenticated user's private/invite-only TradingView indicators.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| *(none)* | — | — | — |

**Response:** Plain text stdout from `listIndicators.mjs`.

---

### 2.4 `capture_screenshot`

**Purpose:** Capture a high-resolution chart screenshot with candlestick pattern annotations.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | `string` | `"BINANCE:BTCUSDT"` | Market ticker |
| `timeframe` | `string` | `"60"` | Chart interval |
| `name` | `string` | `"mcp_capture.png"` | Output filename |

**Response (JSON string on success):**
```json
{
  "status": "success",
  "message": "Screenshot saved successfully to /path/out/screenshots/mcp_capture.png",
  "metadata": {
    "path": "/path/out/screenshots/mcp_capture.png",
    "width": 1920,
    "height": 1080
  }
}
```

**Side effects:**
- Saves PNG to `out/screenshots/<name>`
- Saves JSON sidecar to `out/screenshots/<name>.json` with `{ symbol, timeframe, timestamp, patterns }`

---

### 2.5 `refresh_session_credentials`

**Purpose:** Launch interactive browser window to refresh TradingView session cookies.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| *(none)* | — | — | — |

**Response:** Success/error string.

> [!WARNING]
> This tool opens a GUI window. Not suitable for headless/CI environments.

---

### 2.6 `run_screener`

**Purpose:** Query TradingView screener API with preset filter configurations.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `market` | `string` | `"crypto"` | Target: `crypto`, `forex`, `america`, `global` |
| `condition` | `string` | `"top_volume"` | One of 24 preset filter names (see list below) |
| `limit` | `int` | `15` | Max results |

**Available presets:** `top_volume`, `top_gainers`, `oversold`, `overbought`, `momentum_breakout`, `trend_following`, `golden_cross`, `death_cross`, `mean_reversion`, `stoch_oversold`, `stoch_overbought`, `cci_extreme_low`, `cci_extreme_high`, `whale_accumulation`, `high_volatility`, `low_volatility_squeeze`, `unusual_volume`, `strong_buy_consensus`, `strong_sell_consensus`, `weekly_performers`, `monthly_losers`, `cycle_reversal_long`, `cycle_reversal_short`, `divergence_scan`.

**Response:** Markdown-formatted table of screener results.

---

### 2.7 `run_custom_screener`

**Purpose:** Run arbitrary custom TradingView scanner queries.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `market` | `string` | *(required)* | Target market |
| `fields_json` | `string` | *(required)* | JSON array of fields: `'["name","close","RSI"]'` |
| `filters_json` | `string` | *(required)* | JSON array of filter dicts (see below) |
| `sort_by` | `string` | *(required)* | Sort field name |
| `sort_order` | `string` | `"desc"` | `"desc"` or `"asc"` |
| `limit` | `int` | `15` | Max results |

**Filter dict format:**
```json
{ "left": "RSI", "op": "less", "right": 30 }
```
Supported operators: `less`, `greater`, `equal`, `ne`, `crosses_above`, `crosses_below`.

---

### 2.8 `detect_patterns`

**Purpose:** Detect classic candlestick patterns in the last 15 OHLC bars.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | `string` | `"completa"` | Indicator key for the data source |

**Response:** Markdown-formatted pattern detection report.

---

### 2.9 `get_pine_docs`

**Purpose:** Offline Pine Script function documentation and autocompletion.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `function_name` | `string` | *(required)* | Dot-notation function name (e.g. `ta.ema`) |

**Response:** Markdown-formatted documentation including syntax, parameters, return type, and examples.

---

### 2.10 `validate_pine_code`

**Purpose:** Static analysis of Pine Script code for common errors.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `code` | `string` | *(required)* | Pine Script source code |

**Response:** Markdown-formatted validation report with warnings, errors, and suggestions. Includes PineTS transpilation check if possible.

---

### 2.11 `transpile_pine_script`

**Purpose:** Transpile a Pine Script file to JavaScript offline via PineTS.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `file_path` | `string` | *(required)* | Path to `.pine` file |

**Response:** Transpiled JavaScript code as stdout, or error message.

---

### 2.12 `download_public_script`

**Purpose:** Download source code of an open-source TradingView script.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `script_url` | `string` | *(required)* | Public TradingView script URL |
| `output_name` | `string` | `"downloaded_script.pine"` | Output filename |

**Response:** Success message with file path, or error.

**Side effects:** Saves `.pine` file to `out/downloads/`.

---

### 2.13 `control_chart_macro`

**Purpose:** Execute remote-control macros on the active TradingView chart.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `action_type` | `string` | `"save"` | Macro type (see below) |
| `value` | `string` | `""` | Macro parameter value |
| `symbol` | `string` | `""` | Default chart symbol |
| `interval` | `string` | `""` | Default chart timeframe |

**Available macros:** `change_symbol`, `toggle_drawings`, `save`, `change_timeframe`, `clear_all_drawings`.

---

### 2.14 `get_structured_market_data`

**Purpose:** Extract structured data for Options chains, Heatmaps, or Yield Curves.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type_val` | `string` | *(required)* | `"options"`, `"heatmap"`, `"yield-curve"`, `"yield"` |
| `symbol` | `string` | `""` | Context-dependent symbol or category |

**Response:** JSON-structured extraction result.

> [!NOTE]
> This tool requires browser automation (Puppeteer/headless Chrome). Data quality depends on
> TradingView's DOM structure at execution time.

---

### 2.15 `send_notification`

**Purpose:** Send notifications to configured Discord/Telegram channels.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `message` | `string` | *(required)* | Notification text (Markdown supported) |
| `filepath` | `string` | `None` | Optional attachment (image/text file) |

**Response:** Success/error string.

---

### 2.16 `get_economic_calendar`

**Purpose:** Retrieve upcoming macroeconomic events.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days_ahead` | `int` | `7` | Days to scan ahead |
| `countries` | `string` | `"US,EU,GB,JP"` | Comma-separated country codes |

**Response:** Markdown-formatted economic calendar table.

---

### 2.17 `get_market_news`

**Purpose:** Retrieve real-time news headlines for an asset.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbol` | `string` | `"BINANCE:BTCUSDT"` | Asset ticker |
| `limit` | `int` | `5` | Max news entries |

**Response:** Markdown-formatted news summary.

---

## 3. Dashboard REST API — Complete Reference

The Dashboard API runs on Express.js (port 5000) and serves both the web UI
and programmatic consumers.

### 3.1 Health & Status

| Endpoint | Method | Response |
|----------|--------|----------|
| `GET /api/health` | GET | `{ status, uptime, version, timestamp, node }` |
| `GET /api/status` | GET | `{ config, cacheStats, indicatorCount }` |
| `GET /api/logs` | GET | `{ logs: string[] }` (last 300 server log lines) |

### 3.2 Indicators

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/indicators` | GET | List all indicators with metadata |
| `GET /api/indicators/:key` | GET | Get specific indicator's cached JSON data |

**`:key` validation:** Alphanumeric + underscore + hyphen only. Returns 400 for invalid keys.

### 3.3 Screener

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `GET /api/screener/presets` | GET | — | List all screener presets |
| `POST /api/screener/presets` | POST | `{ key, name, market, fields, filters, sortBy, sortOrder }` | Create custom preset |
| `DELETE /api/screener/presets/:key` | DELETE | — | Delete a custom preset |
| `GET /api/screener/preview` | GET | `?market=&condition=&limit=` | Preview screener results |

### 3.4 Screenshots

| Endpoint | Method | Response |
|----------|--------|----------|
| `GET /api/screenshots` | GET | `{ screenshots: [{ filename, size, modified, url, sidecar }] }` |

Static files are served at `/screenshots/<filename>`.

### 3.5 Alerts (Webhook Ingestion)

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `POST /api/alerts` | POST | Any JSON payload | Ingest a webhook alert from TradingView |
| `GET /api/alerts` | GET | — | Retrieve stored alert history |

**Alert storage:** In-memory array (last 100 alerts). Not persisted across restarts.

### 3.6 Data Extraction

| Endpoint | Method | Query Params | Description |
|----------|--------|--------------|-------------|
| `GET /api/extract/:type` | GET | `?symbol=` | Extract structured data (options, heatmap, yield-curve) |

**`:type` validation:** Must be one of `options`, `heatmap`, `yield-curve`, `yield`.

### 3.7 Cache

| Endpoint | Method | Response |
|----------|--------|----------|
| `GET /api/cache/stats` | GET | `{ totalBars, indicators: [...], runHistory: [...] }` |

### 3.8 Daemon (Auto-refresh)

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `GET /api/daemon/status` | GET | — | Check daemon running state |
| `POST /api/daemon/start` | POST | `{ intervalMinutes }` | Start auto-refresh daemon |
| `POST /api/daemon/stop` | POST | — | Stop the daemon |

**Validation:** `intervalMinutes` must be 1–1440 (inclusive). Returns 400 otherwise.

### 3.9 Pine Docs

| Endpoint | Method | Query Params | Description |
|----------|--------|--------------|-------------|
| `GET /api/docs` | GET | `?q=ta.ema` | Search Pine Script documentation |

### 3.10 Session

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/session/validate` | GET | Validate TradingView session cookies |

### 3.11 Notifier

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `POST /api/notifier/test` | POST | `{ message }` | Test notification delivery |

### 3.12 Script Download

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `POST /api/download` | POST | `{ url, name? }` | Download a public TradingView script |

---

## 4. Error Handling Contract

### 4.1 MCP Tool Errors

All MCP tools return errors as **plain-text strings** (not JSON), prefixed with `"Error"`:

```
Error running fetchIndicator: ...
Error: Key contains invalid characters: '../../etc/passwd'
```

**Consumer should:** Check if the returned string starts with `"Error"` before parsing as JSON.

### 4.2 REST API Errors

Dashboard endpoints return standard HTTP status codes:

| Code | When |
|------|------|
| `200` | Success |
| `400` | Validation failure (invalid key, missing params, out-of-range values) |
| `404` | Resource not found (indicator key, screenshot) |
| `500` | Internal server error |

Error response body format:
```json
{ "error": "Human-readable error message" }
```

### 4.3 Security Validations

| Input | Validation | Error |
|-------|-----------|-------|
| Indicator key | `^[a-zA-Z0-9_\-]+$` | 400: Invalid key |
| File paths | No `..` traversal, within project dir | ValueError |
| URLs | http/https only, tradingview.com domains | ValueError |
| `intervalMinutes` | 1–1440 range | 400: out of range |

---

## 5. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TV_SESSION` | Yes | — | TradingView `sessionid` cookie |
| `TV_SESSION_SIGNATURE` | Yes | — | TradingView `sessionid_sign` cookie |
| `TV_SYMBOL` | No | `BINANCE:BTCUSDT` | Default chart symbol |
| `TV_TIMEFRAME` | No | `60` | Default chart timeframe |
| `DISCORD_WEBHOOK_URL` | No | — | Discord notification webhook |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram bot token |
| `TELEGRAM_CHAT_ID` | No | — | Telegram chat ID |
| `PORT` | No | `5000` | Dashboard server port |

---

## 6. Data Persistence

| Store | Location | Purpose |
|-------|----------|---------|
| **SQLite** | `out/tv_oracle_cache.db` | OHLCV bar cache, run history |
| **JSON files** | `out/<key>.json` | Latest indicator fetch results |
| **Screenshots** | `out/screenshots/` | PNG + JSON sidecar files |
| **Downloads** | `out/downloads/` | Downloaded Pine scripts |
| **Pine Docs** | `pine_docs_db.json` | Offline Pine documentation index |
| **Presets** | `screener_presets.local.json` | Custom screener presets |
| **Daemon state** | `daemon_state.json` | Auto-refresh daemon persistence |

> [!IMPORTANT]
> The SQLite cache (`tv_cache.py`) is the **single source of truth** for historical OHLCV data.
> JSON files in `out/` are ephemeral and regenerated on each fetch.

---

## 7. Consumption Notes for Client Applications

### 7.1 MCP Integration Pattern

```python
# In client backend, consume via MCP client:
result = await mcp_client.call_tool("fetch_indicator", {
    "key": "completa",
    "range_val": 5000,
    "wait_ms": 20000
})

# Check for errors
if result.startswith("Error"):
    handle_error(result)
else:
    data = json.loads(result)
    periods = data["periodsCount"]
    sample = data["periodsSample"]
```

### 7.2 Recommended Workflow

1. **Session check:** Call `refresh_session_credentials` if auth fails
2. **Indicator fetch:** Use `fetch_indicator` with delta-sync (automatic)
3. **Analysis:** Use `detect_patterns`, `run_screener` for signals
4. **Visual capture:** Use `capture_screenshot` for reports
5. **Notification:** Use `send_notification` to alert on signals

### 7.3 Rate Limits & Performance

| Operation | Typical Duration | Notes |
|-----------|-----------------|-------|
| `fetch_indicator` (cold) | 20-30s | Full fetch, 5000 bars |
| `fetch_indicator` (delta) | 5-10s | Only last 100 bars |
| `run_screener` | 2-5s | HTTP API call |
| `capture_screenshot` | 5-15s | Browser automation |
| `get_pine_docs` | <100ms | Local file lookup |
| `validate_pine_code` | <500ms | Local analysis |

### 7.4 Idempotency

| Tool | Idempotent | Notes |
|------|-----------|-------|
| `fetch_indicator` | ⚠️ Side effects | Updates cache, writes files |
| `run_screener` | ✅ Yes | Read-only API call |
| `get_pine_docs` | ✅ Yes | Local file read |
| `capture_screenshot` | ⚠️ Side effects | Writes image file |
| `send_notification` | ❌ No | Sends external message |

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-12 | Initial contract — all 17 MCP tools + 21 REST endpoints documented |
