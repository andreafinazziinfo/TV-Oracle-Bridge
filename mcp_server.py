import subprocess
import os
import sys
import json
from pathlib import Path
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("TV Oracle Bridge")

ORACLE_DIR = Path(__file__).parent.resolve()

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

if __name__ == "__main__":
    mcp.run()
