import subprocess
import os
import sys
import json
from pathlib import Path
from mcp.server.fastmcp import FastMCP

# Ensure UTF-8 stdout on Windows to prevent UnicodeEncodeError with emojis
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Initialize FastMCP server
mcp = FastMCP("TV Oracle Bridge")

ORACLE_DIR = Path(__file__).parent.resolve()

# Add local path to sys.path to ensure correct imports
sys.path.append(str(ORACLE_DIR))
from screener import run_screener as exec_screener
from pattern_detector import detect_from_oracle_file

@mcp.tool()
def fetch_indicator(key: str = "completa", range_val: int = 5000, wait_ms: int = 20000) -> str:
    """Fetch an indicator's computed output from TradingView.
    
    Args:
        key: The indicator key from indicators.json (e.g. "completa", "model_entry", "pattern_matching").
        range_val: Number of bars to load (default: 5000).
        wait_ms: Streaming wait time in milliseconds before snapshotting (default: 20000).
    """
    try:
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
            return f"Error: Indicator fetched but output file {out_file} not found. Stdout:\n{result.stdout}\nStderr:\n{result.stderr}"
            
        # Read file and return summarized version to prevent token explosion
        with open(out_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        summary = {
            "meta": data.get("meta"),
            "plots": data.get("plots"),
            "graphicSummary": data.get("graphicSummary"),
            "periodsCount": data.get("periodsCount"),
            "strategyReport": data.get("strategyReport"),
            "periodsSample": data.get("periodsSample", [])[-3:], # last 3 periods
            "output_path": str(out_file)
        }
        return json.dumps(summary, indent=2)
        
    except subprocess.CalledProcessError as e:
        return f"Error running fetchIndicator: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
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
        cmd = ["node", "remoteControl.mjs", "screenshot", symbol, timeframe, name]
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
            
        return f"Success: Screenshot saved to {screenshot_path}\nStdout:\n{result.stdout}"
    except subprocess.CalledProcessError as e:
        return f"Error running screenshot automation: {e}\nStdout:\n{e.stdout}\nStderr:\n{e.stderr}"
    except Exception as e:
        return f"Error: {e}"

@mcp.tool()
def run_screener(market: str = "crypto", condition: str = "top_volume", limit: int = 15) -> str:
    """Query TradingView screener API to scan for technical market setups in real-time.
    
    Args:
        market: Target category: "crypto", "forex", or "america" (for US stocks).
        condition: Filter setup: "top_volume", "top_gainers", "oversold" (RSI < 30), or "overbought" (RSI > 70).
        limit: Max number of assets to return (default: 15).
    """
    return exec_screener(market, condition, limit)

@mcp.tool()
def detect_patterns(key: str = "completa") -> str:
    """Analyze the last 15 OHLC bars of a fetched indicator to identify classic candlestick patterns.
    
    Args:
        key: The key of the indicator file to analyze (e.g. "completa", "data_science").
    """
    out_file = ORACLE_DIR / "out" / f"{key}.json"
    return detect_from_oracle_file(str(out_file))

if __name__ == "__main__":
    mcp.run()

