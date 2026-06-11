# 📈 TV Oracle Bridge

<div align="center">

[![GitHub License](https://img.shields.io/github/license/andreafinazziinfo/TV-Oracle-Bridge?color=8b5cf6&style=for-the-badge)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-10b981?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Python Version](https://img.shields.io/badge/python-3.10%2B-3b82f6?style=for-the-badge&logo=python)](https://python.org)
[![Protocol](https://img.shields.io/badge/mcp-fastmcp-ea580c?style=for-the-badge)](https://modelcontextprotocol.io/)

<p align="center">
  <strong>An elegant, offline TradingView indicator oracle and FastMCP Server</strong><br />
  Bridges real-time TradingView study executions (plots, graphic objects, strategies) to local AI agents and quantitative analysis scripts.
</p>

</div>

---

## 🎯 Quick Capabilities (What You Can Do)

* 📡 **Fetch Indicator Data**: Download computed plots, lines, tables, and strategy trade reports directly into JSON files (`npm run fetch`).
* 📜 **List Private Indicators**: Enumerate all private/invite-only indicators saved under your TradingView account (`npm run list`).
* 📸 **Capture Chart Screenshots**: Programmatically open your charts (supporting **Brave**, Chrome, Firefox, Safari) and take high-resolution PNG snapshots (`node remoteControl.mjs`).
* 🔍 **Market Technical Screening**: Scan global markets (Crypto, Forex, Stocks) for specific technical conditions like RSI oversold/overbought or top volume (`python screener.py`).
* 🕯️ **Candlestick Pattern Scanning**: Scan historical bars for patterns like Hammer, Doji, and Engulfing to generate immediate signal reports (`python pattern_detector.py`).
* 🤖 **AI Agent Integration**: Expose all these features directly to Claude Desktop or other AI clients using built-in FastMCP tools.

### 📸 Chart Screenshot Preview
Here is an example of a high-resolution chart snapshot captured programmatically using the built-in browser controller:

![TradingView Chart Screenshot](docs/images/screenshot_sample.png)

---

## 🗺️ System Architecture

The **TV Oracle Bridge** connects to TradingView's secure WebSockets, streams computed indicator periods/plots and drawing tables, and exposes them locally via a unified JSON format or a **Model Context Protocol (MCP)** server.

```mermaid
graph TD
    %% Define Styles
    classDef client fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff;
    classDef server fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#fff;
    classDef external fill:#ea580c,stroke:#c2410c,stroke-width:2px,color:#fff;
    
    subgraph Client Application
        A["Claude Desktop / Agentic AI"]:::client
    end
    
    subgraph TV Oracle Bridge [Local Machine]
        B["FastMCP Server (mcp_server.py)"]:::server
        C["Extractor Engine (fetchIndicator.mjs)"]:::server
        E["Playwright Automation (remoteControl.mjs)"]:::server
    end
    
    subgraph External Oracle
        D["TradingView WebSocket Protocol"]:::external
    end

    %% Connections
    A <-->|Model Context Protocol| B
    B <-->|Subprocess Runner| C
    B <-->|Automates Browser| E
    E <-->|Injected Cookies| D
    C <-->|Secured WebSockets| D
    D -->|Real-time Plots, Tables & Graphics| C
    C -->|Sanitized JSON Data| B
```

---

## ✨ Codebase Breakdown (How it Works)

This standalone project integrates multiple components to bridge the gap between TradingView's client-side runtime and your local python/agentic environment:

1. **`fetchIndicator.mjs` (WebSocket Extractor)**: Connects to TradingView's WebSocket feed using `@mathieuc/tradingview`. It acts as an offline "oracle" by subscribing to the indicator's raw data stream, materializing complex graphic objects (like lines, labels, boxes, and table cells) which are normally unavailable in CSV exports.
2. **`remoteControl.mjs` (Browser Automator)**: Uses Playwright to launch a browser session (supporting local Brave, Chrome, or default Chromium/Firefox/WebKit). It injects session cookies, navigates to chart layouts, executes commands (like changing symbols, toggling drawings, or saving files), and captures crisp PNG screenshots.
3. **`screener.py` (Market Scanner)**: Queries TradingView's official JSON scanner endpoints to search for assets matching custom technical setups (such as RSI oversold or high-volume breakouts) and formats the output into clean markdown tables.
4. **`pattern_detector.py` (Candlestick Classifier)**: An offline analysis script that parses historical OHLC bars fetched by the oracle and identifies classic price patterns (Doji, Hammer, Engulfing).
5. **`pine_docs.py` (AI Syntax Help)**: Provides a local database of official Pine Script v5/v6 functions, arguments, and linting rules, helping AI agents write syntactically correct code.
6. **`pineTranspilerWrapper.mjs` (Safe TS Transpiler)**: Runs LuxAlgo's `@luxalgo/pinets` compiler in a separate CLI process. This keeps the main project 100% legally independent of copyleft AGPL-3.0 licenses.
7. **`mcp_server.py` (FastMCP Gateway)**: Exposes all these tools under the Model Context Protocol, allowing local AI agents (like Claude Desktop) to invoke them interactively.
8. **`Dockerfile` & `docker-compose.yml` (Docker Stack)**: Containerizes the entire Node.js + Python + Playwright runtime using Microsoft's preconfigured system libraries for headless browser rendering, allowing 24/7 background deployment.

---

## 🚀 Step-by-Step Setup

### 1. Prerequisites
Ensure you have the following installed:
* [Node.js](https://nodejs.org/) `>= 18.0.0`
* [Python](https://python.org/) `>= 3.10`
* [Docker](https://www.docker.com/) *(optional, for containerized deployment)*

### 2. Installation
Clone the repository and install the Node.js and Python dependencies:
```bash
git clone https://github.com/andreafinazziinfo/TV-Oracle-Bridge.git
cd TV-Oracle-Bridge
npm install
pip install -r requirements.txt
```
> 💡 *Note: The Node.js installation automatically executes `apply-lib-patch.mjs` to patch the underlying WebSocket parser, making it resilient to malformed/oversized strategy payload chunks.*

### 3. Session Credentials (`.env`)
Create your local environment file:
```bash
cp .env.example .env
```
Open `.env` and fill in your TradingView session credentials:
* `TV_SESSION`: The value of your `sessionid` cookie.
* `TV_SESSION_SIGN`: The value of your `sessionid_sign` cookie.

*Optional Browser Configuration (e.g., to use your local Brave Browser installation)*:
```ini
TV_BROWSER_TYPE=chromium
TV_BROWSER_PATH=C:/Users/Andrea/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe
TV_BROWSER_HEADLESS=true
```

> 🔍 **How to get cookies**: Log in to `tradingview.com`, open Developer Tools (`F12`), go to **Application** -> **Cookies** -> `https://www.tradingview.com`, and find `sessionid`.

### 4. Config Private Indicators (`indicators.local.json`)
Since this is a public repository, private indicator IDs are stored in a local, uncommitted file.
Create your local config file:
```bash
cp indicators.local.example.json indicators.local.json
```
Edit `indicators.local.json` and insert your invite-only or private indicator IDs:
```json
{
  "completa": {
    "pineId": "USER;your_indicator_id_here",
    "version": "630.0"
  }
}
```
> 💡 *To discover your private indicators, run the helper command:*
> ```bash
> npm run list
> ```

---

## 🛠️ Usage Guide

### 1. Fetching Indicator Data
Extract computed values directly into the `out/` folder:
```bash
node fetchIndicator.mjs <key> [range] [waitMs]
```
* **`key`**: The indicator key defined in `indicators.json` (e.g. `completa`, `model_entry`).
* **`range`**: Number of historical bars to load (default: `5000`).
* **`waitMs`**: Streaming wait time before writing snapshot (default: `20000`ms).

Example:
```bash
node fetchIndicator.mjs completa 5000 20000
```

### 2. Capturing Chart Screenshots
Take high-resolution snapshots of your chart layouts:
```bash
node remoteControl.mjs screenshot <symbol> <timeframe> [output_name.png]
```
Example:
```bash
node remoteControl.mjs screenshot BINANCE:BTCUSDT 60 btc_chart.png
```

### 3. Running the Technical Screener
Scan technical setups across different markets:
```bash
python screener.py <market> <condition> [limit]
```
* **`market`**: `crypto`, `forex`, `america` (stocks).
* **`condition`**: `top_volume`, `top_gainers`, `oversold` (RSI < 30), `overbought` (RSI > 70).

Example:
```bash
python screener.py crypto oversold 15
```

### 4. Scanning Candlestick Patterns
Detect candlestick patterns on historical price data:
```bash
python pattern_detector.py [path_to_fetched_json_file]
```
Example:
```bash
python pattern_detector.py out/completa.json
```

---

## 🤖 Running the MCP Server

Launch the FastMCP server to integrate these tools with your AI client (like Claude Desktop):
```bash
python mcp_server.py
```

### Registered Tools Exposed to AI:
1. `fetch_indicator`: Fetch indicator outputs & strategy logs from WebSocket.
2. `list_indicators`: Enumerate user's private indicators.
3. `capture_screenshot`: Take visual chart screenshots (uses Playwright + Brave/Chrome).
4. `control_chart_macro`: Execute a remote macro on the active chart layout (change symbol, toggle drawings, save).
5. `run_screener`: Scan markets for specific technical states.
6. `detect_patterns`: Classify candlestick setups on historical OHLC bars.
7. `get_pine_docs`: Get syntax guidelines for Pine Script functions.
8. `validate_pine_code`: Run static linting checks on custom Pine code.
9. `transpile_pine_script`: Compiles Pine code into local JS using the AGPL-safe wrapper.

### Configuration for Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "tv-oracle-bridge": {
      "command": "python",
      "args": ["/path/to/TV-Oracle-Bridge/mcp_server.py"],
      "env": {
        "PYTHONPATH": "/path/to/TV-Oracle-Bridge"
      }
    }
  }
}
```

---

## ⚖️ Disclaimer

> [!WARNING]
> This is an unofficial utility and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with TradingView, Inc., or any of its subsidiaries or affiliates. Use this tool responsibly and in accordance with TradingView's terms of service.
