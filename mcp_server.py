import subprocess
import os
import sys
import json
from pathlib import Path
from mcp.server.fastmcp import FastMCP
from bridge_utils import init_io, ORACLE_DIR, sanitize_key, sanitize_path, sanitize_url

# Ensure UTF-8 stdout on Windows
init_io()

# Initialize FastMCP server
import os
mcp = FastMCP(
    "TV Oracle Bridge", 
    host=os.getenv("MCP_HOST", "127.0.0.1"), 
    port=int(os.getenv("MCP_PORT", "8000"))
)

from screener import run_screener as exec_screener
from pattern_detector import detect_from_oracle_file, get_candlestick_annotations
from pine_docs import get_pine_docs as fetch_pine_docs, validate_pine_code as check_pine_syntax
from tv_cache import get_last_cached_timestamp, merge_and_update_cache, get_cached_bars
from notifier import send_notification as dispatch_notification
from macro_data import (
    get_economic_calendar as fetch_calendar_data,
    format_calendar_markdown,
    get_symbol_news as fetch_news_data,
    format_news_markdown
)


@mcp.tool()
def fetch_indicator(key: str = "completa", range_val: int = 5000, wait_ms: int = 20000) -> str:
    """Fetch an indicator's computed output from TradingView, leveraging local SQLite cache and logging run telemetry.
    
    Args:
        key: The indicator key from indicators.json (e.g. "completa", "model_entry", "pattern_matching").
        range_val: Number of bars to load (default: 5000).
        wait_ms: Streaming wait time in milliseconds before snapshotting (default: 20000).
    """
    from datetime import datetime
    from tv_cache import record_run
    
    symbol = os.getenv("TV_SYMBOL", "BINANCE:BTCUSDT")
    timeframe = os.getenv("TV_TIMEFRAME", "60")
    started_at = datetime.utcnow().isoformat()
    is_delta_sync = False
    
    try:
        # Check if we already have cached bars to enable delta synchronization
        last_timestamp = get_last_cached_timestamp(key, symbol, timeframe)
        
        if last_timestamp > 0:
            print(f"[SQLite Cache] Found last cached timestamp: {last_timestamp}. Enabling delta-sync (last 100 bars).")
            range_val = 100
            wait_ms = min(wait_ms, 8000) # Reduce stream wait time for speed
            is_delta_sync = True
            
        # Run node fetchIndicator.mjs
        cmd = ["node", "fetchIndicator.mjs", key, str(range_val), str(wait_ms)]
        result = subprocess.run(
            cmd,
            cwd=str(ORACLE_DIR),
            capture_output=True,
            text=True,
            check=True
        )
        
        # Check output file
        out_file = ORACLE_DIR / "out" / f"{key}.json"
        if not out_file.exists():
            err_msg = f"Error: Indicator fetched but output file {out_file} not found."
            finished_at = datetime.utcnow().isoformat()
            record_run(key, symbol, timeframe, started_at, finished_at, "failure", range_val, 0, is_delta_sync, err_msg)
            return f"{err_msg} Stdout:\n{result.stdout}\nStderr:\n{result.stderr}"
            
        # Read the fresh fetched data
        with open(out_file, "r", encoding="utf-8") as f:
            fresh_data = json.load(f)
            
        # Merge fresh data with SQLite history and rewrite out/<key>.json
        merged_data = merge_and_update_cache(key, symbol, timeframe, fresh_data)
        
        finished_at = datetime.utcnow().isoformat()
        record_run(
            key, symbol, timeframe, started_at, finished_at, "success", 
            range_val, merged_data.get("periodsCount", 0), is_delta_sync
        )
        
        summary = {
            "meta": merged_data.get("meta"),
            "plots": merged_data.get("plots"),
            "graphicSummary": merged_data.get("graphicSummary"),
            "periodsCount": merged_data.get("periodsCount"),
            "strategyReport": merged_data.get("strategyReport"),
            "periodsSample": merged_data.get("periodsSample", [])[-3:], # last 3 periods
            "output_path": str(out_file),
            "delta_sync": is_delta_sync
        }
        return json.dumps(summary, indent=2)
        
    except subprocess.CalledProcessError as e:
        finished_at = datetime.utcnow().isoformat()
        record_run(key, symbol, timeframe, started_at, finished_at, "failure", range_val, 0, is_delta_sync, f"Subprocess error: {str(e.stderr)}")
        return f"Error running fetchIndicator: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
    except Exception as e:
        finished_at = datetime.utcnow().isoformat()
        record_run(key, symbol, timeframe, started_at, finished_at, "failure", range_val, 0, is_delta_sync, str(e))
        return f"Error: {e}"

@mcp.tool()
def get_run_history(key: str = None, limit: int = 50) -> str:
    """Retrieve execution telemetry and synchronization runs history log.
    
    Args:
        key: Optional indicator key to filter history logs (e.g. "completa").
        limit: Max number of history items to return (default: 50).
    """
    from tv_cache import get_run_history as fetch_run_history
    try:
        history = fetch_run_history(key, limit)
        return json.dumps(history, indent=2)
    except Exception as e:
        return f"Error: {e}"

@mcp.tool()
def list_indicators() -> str:
    """Enumerate the authenticated user's private/invite-only TradingView indicators."""
    try:
        cmd = ["node", "listIndicators.mjs"]
        result = subprocess.run(
            cmd,
            cwd=str(ORACLE_DIR),
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        return f"Error running listIndicators: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
    except Exception as e:
        return f"Error: {e}"

@mcp.tool()
def capture_screenshot(symbol: str = "BINANCE:BTCUSDT", timeframe: str = "60", name: str = "mcp_capture.png") -> str:
    """Capture a high-resolution visual screenshot of a TradingView chart.
    
    Args:
        symbol: Market ticker to display (e.g. "BINANCE:BTCUSDT", "NASDAQ:AAPL").
        timeframe: Chart interval (e.g. "60" for 1-hour, "D" for daily).
        name: Name of the output image file saved in out/screenshots/.
    """
    try:
        # Load the latest cached bars for the symbol/timeframe using tv_cache.get_cached_bars
        # using the default "completa" indicator key
        periods, ohlc = get_cached_bars("completa", symbol, timeframe)
        annotations_json = "[]"
        if ohlc:
            annotations = get_candlestick_annotations(ohlc)
            annotations_json = json.dumps(annotations)
            print(f"[Screenshot Tool] Found {len(ohlc)} cached bars. Generated {len(annotations)} annotations.")
        else:
            print(f"[Screenshot Tool] No cached bars found for {symbol} ({timeframe}). Capturing clean screenshot.")
            
        cmd = ["node", "remoteControl.mjs", "screenshot", symbol, timeframe, name, annotations_json]
        result = subprocess.run(
            cmd,
            cwd=str(ORACLE_DIR),
            capture_output=True,
            text=True,
            check=True
        )
        
        screenshot_path = ORACLE_DIR / "out" / "screenshots" / name
        if not screenshot_path.exists():
            return f"Error: Screenshot task completed but image {screenshot_path} not found. Stdout:\n{result.stdout}\nStderr:\n{result.stderr}"
            
        # Collect detected pattern labels
        patterns = []
        if ohlc:
            patterns = list(set(ann["label"] for ann in annotations)) if annotations else []
            
        # Save JSON sidecar
        try:
            import datetime
            json_path = screenshot_path.with_suffix(".json")
            sidecar_data = {
                "symbol": symbol,
                "timeframe": timeframe,
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                "patterns": patterns
            }
            with open(json_path, "w", encoding="utf-8") as json_file:
                json.dump(sidecar_data, json_file, indent=2)
        except Exception as ex:
            print(f"[Screenshot Tool] Failed to write sidecar JSON: {ex}")

        # Parse and return structured JSON metadata
        stdout_lines = result.stdout.splitlines()
        metadata_str = None
        for line in stdout_lines:
            if line.startswith("Done! Path: {"):
                metadata_str = line.replace("Done! Path: ", "").strip()
                break
                
        if metadata_str:
            try:
                metadata = json.loads(metadata_str)
                return json.dumps({
                    "status": "success",
                    "message": f"Screenshot saved successfully to {screenshot_path}",
                    "metadata": metadata
                }, indent=2)
            except Exception:
                pass
                
        return f"Success: Screenshot saved to {screenshot_path}\nStdout:\n{result.stdout}"
    except subprocess.CalledProcessError as e:
        return f"Error running screenshot automation: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
    except Exception as e:
        return f"Error: {e}"

@mcp.tool()
def refresh_session_credentials() -> str:
    """Launch an interactive browser window to refresh TradingView session cookies.
    
    This opens a new terminal window to prompt you for authentication steps and updates the local .env.
    """
    try:
        if sys.platform == "win32":
            print("[Session Helper] Spawning interactive terminal window on Windows...")
            # We use 'start /wait' to open a new command prompt and wait for the user to complete login.
            cmd = ["cmd.exe", "/c", "start", "/wait", "node", "session_helper.mjs"]
            result = subprocess.run(
                cmd,
                cwd=str(ORACLE_DIR),
                check=True
            )
            return "Success: Session refresher finished. Check if your .env file has been updated with new TV_SESSION."
        else:
            # Fallback for non-Windows (or if user runs manually)
            cmd = ["node", "session_helper.mjs"]
            result = subprocess.run(
                cmd,
                cwd=str(ORACLE_DIR),
                capture_output=True,
                text=True,
                check=True
            )
            return f"Success: Session refresher completed.\nStdout:\n{result.stdout}"
    except subprocess.CalledProcessError as e:
        return f"Error running session helper: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
    except Exception as e:
        return f"Error: {e}"

@mcp.tool()
def run_screener(market: str = "crypto", condition: str = "top_volume", limit: int = 15) -> str:
    """Query TradingView screener API using preset configurations (23 presets available).
    
    Args:
        market: Target category: "crypto", "forex", "america", or "global".
        condition: Filter setup preset: "top_volume", "top_gainers", "oversold", "overbought", 
                   "momentum_breakout", "trend_following", "golden_cross", "death_cross", 
                   "mean_reversion", "stoch_oversold", "stoch_overbought", "cci_extreme_low", 
                   "cci_extreme_high", "whale_accumulation", "high_volatility", 
                   "low_volatility_squeeze", "unusual_volume", "strong_buy_consensus", 
                   "strong_sell_consensus", "weekly_performers", "monthly_losers", 
                   "cycle_reversal_long", "cycle_reversal_short", "divergence_scan".
        limit: Max number of assets to return (default: 15).
    """
    return exec_screener(market, condition, limit)

@mcp.tool()
def run_custom_screener(
    market: str,
    fields_json: str,
    filters_json: str,
    sort_by: str,
    sort_order: str = "desc",
    limit: int = 15
) -> str:
    """Run an arbitrary custom TradingView scanner query by specifying target fields and filters.
    
    Args:
        market: Target category: "crypto", "forex", "america", or "global".
        fields_json: JSON string list of fields to request (e.g. '["name", "close", "RSI", "MACD.macd"]').
        filters_json: JSON string list of filter dicts (e.g. '[{"left": "RSI", "op": "less", "right": 30}]').
                     Supported operators: "less", "greater", "equal", "ne", "crosses_above", "crosses_below".
        sort_by: Field/column name to sort by (e.g. "volume", "RSI", "change").
        sort_order: Sort direction "desc" or "asc" (default: "desc").
        limit: Max number of assets to return (default: 15).
    """
    from screener import run_custom_screener as exec_custom_screener
    return exec_custom_screener(market, fields_json, filters_json, sort_by, sort_order, limit)

@mcp.tool()
def detect_patterns(key: str = "completa") -> str:
    """Analyze the last 15 OHLC bars of a fetched indicator to identify classic candlestick patterns.
    
    Args:
        key: The key of the indicator file to analyze (e.g. "completa", "data_science").
    """
    out_file = ORACLE_DIR / "out" / f"{key}.json"
    return detect_from_oracle_file(str(out_file))

@mcp.tool()
def get_pine_docs(function_name: str) -> str:
    """Get offline documentation and autocompletion guide for a specific Pine Script function.
    
    Args:
        function_name: The namespace.function of the Pine function (e.g. "ta.ema", "ta.rsi", "strategy.entry").
    """
    return fetch_pine_docs(function_name)

@mcp.tool()
def validate_pine_code(code: str) -> str:
    """Analyze a block of Pine Script code for common version issues, obsolete syntax, and matching brackets.
    
    Args:
        code: The Pine Script source code as a string.
    """
    return check_pine_syntax(code)

@mcp.tool()
def transpile_pine_script(file_path: str) -> str:
    """Transpile a local Pine Script file to JavaScript offline using the safe subprocess wrapper for PineTS.
    
    Args:
        file_path: Relative or absolute path to the local .pine script file.
    """
    try:
        cmd = ["node", "pineTranspilerWrapper.mjs", file_path]
        result = subprocess.run(
            cmd,
            cwd=str(ORACLE_DIR),
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        return f"Error transpiling script: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
    except Exception as e:
        return f"Error: {e}"

@mcp.tool()
def download_public_script(script_url: str, output_name: str = "downloaded_script.pine") -> str:
    """Download the source code of an open-source TradingView public script.
    
    Args:
        script_url: The public TradingView script URL (e.g. 'https://www.tradingview.com/script/XXXX-Name/').
        output_name: The output filename to save the .pine code to.
    """
    try:
        cmd = ["node", "remoteControl.mjs", "download", script_url, output_name]
        result = subprocess.run(
            cmd,
            cwd=str(ORACLE_DIR),
            capture_output=True,
            text=True,
            check=True
        )
        dest_path = ORACLE_DIR / "out" / "downloads" / output_name
        return f"Success: Script downloaded successfully and saved to {dest_path}\nStdout:\n{result.stdout}"
    except subprocess.CalledProcessError as e:
        return f"Error downloading script: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
    except Exception as e:
        return f"Error: {e}"

@mcp.tool()
def control_chart_macro(action_type: str = "save", value: str = "", symbol: str = "", interval: str = "") -> str:
    """Execute a remote control macro on the active TradingView chart.
    
    Args:
        action_type: The macro to execute: "change_symbol", "toggle_drawings", "save", "change_timeframe", or "clear_all_drawings".
        value: The parameter value for the macro (e.g. "BINANCE:ETHUSDT" for action "change_symbol", or timeframe like "D" for "change_timeframe").
        symbol: The default chart symbol to navigate to.
        interval: The default chart timeframe.
    """
    try:
        cmd = ["node", "remoteControl.mjs", "macro", action_type, value]
        if symbol:
            cmd.append(symbol)
        if interval:
            if not symbol:
                cmd.append("") # placeholder for symbol
            cmd.append(interval)
            
        result = subprocess.run(
            cmd,
            cwd=str(ORACLE_DIR),
            capture_output=True,
            text=True,
            check=True
        )
        return f"Success: Chart macro executed.\nStdout:\n{result.stdout}"
    except subprocess.CalledProcessError as e:
        return f"Error running chart macro: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
    except Exception as e:
        return f"Error: {e}"

@mcp.tool()
def get_structured_market_data(type_val: str, symbol: str = "") -> str:
    """Extract structured market data from TradingView for Options chains, Heatmaps, or Bond Yield Curves.
    
    Args:
        type_val: The type of data to extract: "options", "heatmap", or "yield-curve".
        symbol: Optional symbol or category (e.g. "AAPL" for options, "crypto" for heatmap).
    """
    try:
        if type_val not in ["options", "heatmap", "yield-curve", "yield"]:
            return "Error: Invalid type_val. Allowed values: options, heatmap, yield-curve, yield."
            
        cmd = ["node", "remoteControl.mjs", "extract", type_val]
        if symbol:
            cmd.append(symbol)
            
        result = subprocess.run(
            cmd,
            cwd=str(ORACLE_DIR),
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        return f"Error running data extraction: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
    except Exception as e:
        return f"Error: {e}"

@mcp.tool()
def send_notification(message: str, filepath: str = None) -> str:
    """Send a notification message (with optional file attachment like chart screenshots) to configured Discord or Telegram channels.
    
    Args:
        message: The text message to send. Supports Markdown.
        filepath: Optional path to a local image or text file to send.
    """
    try:
        return dispatch_notification(message, filepath)
    except Exception as e:
        return f"Error sending notification: {e}"

@mcp.tool()
def get_economic_calendar(days_ahead: int = 7, countries: str = "US,EU,GB,JP") -> str:
    """Retrieve upcoming macroeconomic calendar events from TradingView calendar feeds.
    
    Args:
        days_ahead: Number of days ahead to scan (default: 7).
        countries: Comma-separated list of country/region codes to filter (e.g. "US,EU,JP").
    """
    events = fetch_calendar_data(days_ahead, countries)
    return format_calendar_markdown(events)

@mcp.tool()
def get_market_news(symbol: str = "BINANCE:BTCUSDT", limit: int = 5) -> str:
    """Retrieve real-time market news headlines and description summaries for a specific asset ticker.
    
    Args:
        symbol: Asset ticker format (e.g. "BINANCE:BTCUSDT", "NASDAQ:AAPL", "FX:EURUSD").
        limit: Max number of news entries to fetch (default: 5).
    """
    news_items = fetch_news_data(symbol, limit)
    return format_news_markdown(symbol, news_items)

if __name__ == "__main__":
    import os
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    if transport == "sse":
        mcp.run(transport="sse")
    else:
        mcp.run()

