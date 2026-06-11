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

## ✨ Key Features

* 📊 **Full Graphic Materialization**: Extracts study drawings (`study.periods`, lines, labels, boxes, and table cells) which standard CSV exports miss.
* 📷 **Visual Chart Screenshots (Chart Vision)**: Allows AI agents to visually inspect indicator drawings on the actual chart using a headless or visible browser instance.
* 📈 **Strategy Performance Tracking**: Extracts `strategyReport` (trades, prices, execution times, performance metrics) for strategy-type scripts.
* 🔍 **Real-Time Technical Scanner**: Queries TradingView's scanner engine to find assets matching custom criteria.
* 🕯️ **Candlestick Pattern Classifier**: Analyzes historical OHLC data to detect key Japanese candlestick formations.
* 🛡️ **Zero-Drift Candles**: Captures the exact historical candles (`chartOhlc`) used for computations to ensure 100% mathematical parity.
* 🔒 **Zero-Leak Security**: Automatically splits public configurations from private indicators/sessions.

---

## 🚀 Step-by-Step Setup

### 1. Prerequisites
Ensure you have the following installed:
* [Node.js](https://nodejs.org/) `>= 18.0.0`
* [Python](https://python.org/) `>= 3.10`

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
TV_BROWSER_PATH=C:/path/to/Brave-Browser/Application/brave.exe
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
4. `run_screener`: Scan markets for specific technical states.
5. `detect_patterns`: Classify candlestick setups on historical OHLC bars.

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
