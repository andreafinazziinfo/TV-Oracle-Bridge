"""
screener_core.py — Core TradingView Scanner API client.

Constructs and executes arbitrary scanner queries and formats results.
"""

import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Tuple

def get_scan_market(market: str) -> str:
    """Map user market parameter to TradingView scanner market name."""
    market_map = {
        "crypto": "crypto",
        "forex": "forex",
        "america": "global",
        "global": "global"
    }
    return market_map.get(market.lower(), "crypto")

def build_query(
    market: str,
    fields: List[str],
    filters: List[Dict[str, Any]],
    sort_by: str,
    sort_order: str = "desc",
    limit: int = 50
) -> Dict[str, Any]:
    """Constructs a raw TradingView scanner JSON payload."""
    scan_market = get_scan_market(market)
    
    # Ensure "name" is always the first column for symbol identification
    columns = list(fields)
    if "name" not in columns:
        columns.insert(0, "name")
        
    return {
        "filter": filters,
        "options": {"lang": "en"},
        "markets": [market],
        "symbols": {"query": {"types": []}, "tickers": []},
        "columns": columns,
        "sort": {"sortBy": sort_by, "sortOrder": sort_order},
        "range": [0, limit]
    }

def execute_query(market: str, query: Dict[str, Any], timeout: int = 15) -> List[Dict[str, Any]]:
    """Sends POST request to TradingView Scanner API and returns list of mapped dictionaries."""
    scan_market = get_scan_market(market)
    url = f"https://scanner.tradingview.com/{scan_market}/scan"
    
    req = urllib.request.Request(
        url,
        data=json.dumps(query).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            res_data = json.load(response)
    except urllib.error.URLError as e:
        raise RuntimeError(f"Error connecting to TradingView Screener API: {e.reason}")
    except Exception as e:
        raise RuntimeError(f"Error executing scanner query: {str(e)}")
        
    raw_data = res_data.get("data", [])
    columns = query.get("columns", [])
    
    mapped_rows = []
    for row in raw_data:
        ticker = row.get("s", "")
        d_values = row.get("d", [])
        
        # Map indices to column names
        row_dict = {"_ticker": ticker}
        for idx, col in enumerate(columns):
            if idx < len(d_values):
                row_dict[col] = d_values[idx]
            else:
                row_dict[col] = None
        mapped_rows.append(row_dict)
        
    return mapped_rows

def format_value(val: Any, col_name: str) -> str:
    """Format individual scanner value into a user-friendly string."""
    if val is None:
        return "N/A"
        
    # Percentage format
    if col_name in ["change", "Perf.W", "Perf.1M", "Perf.3M", "Volatility.D"]:
        if isinstance(val, (int, float)):
            return f"{val:.2f}%"
        return str(val)
        
    # Close price / SMA / BB lines format
    if col_name in ["close", "SMA20", "SMA50", "SMA200", "EMA50", "EMA200", "BB.lower", "BB.upper"]:
        if isinstance(val, (int, float)):
            if val < 0.0001:
                return f"{val:.8f}"
            elif val < 1.0:
                return f"{val:.6f}"
            elif val < 100:
                return f"{val:.4f}"
            else:
                return f"{val:.2f}"
        return str(val)
        
    # Volume format
    if col_name in ["volume", "average_volume_30d_calc"]:
        if isinstance(val, (int, float)):
            if val >= 1_000_000_000:
                return f"{val / 1_000_000_000:.2f}B"
            elif val >= 1_000_000:
                return f"{val / 1_000_000:.2f}M"
            elif val >= 1_000:
                return f"{val / 1_000:.1f}K"
            else:
                return str(val)
        return str(val)
        
    # Recommendations formatting
    if col_name in ["recommendation", "Recommend.All", "Recommend.MA", "Recommend.Other"]:
        if isinstance(val, (int, float)):
            if val > 0.5:
                return f"🟢 Strong Buy ({val:.2f})"
            elif val > 0.1:
                return f"🟢 Buy ({val:.2f})"
            elif val < -0.5:
                return f"🔴 Strong Sell ({val:.2f})"
            elif val < -0.1:
                return f"🔴 Sell ({val:.2f})"
            else:
                return f"⚪ Neutral ({val:.2f})"
        return str(val)
        
    # Technical oscillators (RSI, Stochastic, ADX, ATR, CCI)
    if col_name in ["RSI", "Stoch.RSI.K", "Stoch.K", "Stoch.D", "ADX", "ATR", "CCI20", "MACD.macd", "MACD.signal"]:
        if isinstance(val, (int, float)):
            return f"{val:.2f}"
        return str(val)
        
    return str(val)

def format_markdown(rows: List[Dict[str, Any]], columns: List[str], title: str = "TradingView Scan") -> str:
    """Formats a list of mapped rows into a markdown table."""
    if not rows:
        return f"### {title}\n\nNo records found matching criteria."
        
    # Pretty column headers mapping
    header_map = {
        "name": "Asset",
        "close": "Price",
        "change": "Change",
        "volume": "Volume",
        "average_volume_30d_calc": "Avg Vol (30d)",
        "RSI": "RSI (14)",
        "Stoch.RSI.K": "Stoch RSI K",
        "Recommend.All": "Recommend",
        "recommendation": "Recommend",
        "Recommend.MA": "Rec MA",
        "Recommend.Other": "Rec Other",
        "Perf.W": "Perf Weekly",
        "Perf.1M": "Perf Monthly",
        "Perf.3M": "Perf 3M",
        "SMA20": "SMA 20",
        "SMA50": "SMA 50",
        "SMA200": "SMA 200",
        "EMA50": "EMA 50",
        "EMA200": "EMA 200",
        "BB.lower": "BB Lower",
        "BB.upper": "BB Upper",
        "MACD.macd": "MACD",
        "MACD.signal": "Signal",
        "Stoch.K": "Stoch K",
        "Stoch.D": "Stoch D",
        "ADX": "ADX",
        "ATR": "ATR",
        "CCI20": "CCI (20)",
        "Volatility.D": "Volatility"
    }
    
    headers = [header_map.get(col, col) for col in columns]
    alignments = []
    for col in columns:
        if col == "name":
            alignments.append(":---")
        else:
            alignments.append("---:")
            
    lines = [
        f"### {title}",
        "",
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(alignments) + " |"
    ]
    
    for row in rows:
        formatted_cells = []
        for col in columns:
            val = row.get(col)
            if col == "name" and val:
                # Strip exchange prefix (e.g. BINANCE:BTCUSDT -> BTCUSDT)
                val_parts = val.split(":")
                val = val_parts[1] if len(val_parts) > 1 else val_parts[0]
                formatted_cells.append(f"**{val}**")
            else:
                formatted_cells.append(format_value(val, col))
        lines.append("| " + " | ".join(formatted_cells) + " |")
        
    return "\n".join(lines)
