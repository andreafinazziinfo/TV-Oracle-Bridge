import json
import sys
import urllib.request
import urllib.error

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_screener(market: str = "crypto", condition: str = "top_volume", limit: int = 15) -> str:
    """Query the official TradingView scan endpoint for real-time market data and indicators.
    
    Args:
        market: E.g. "crypto", "forex", "america" (US stocks).
        condition: E.g. "top_volume", "top_gainers", "oversold" (RSI < 30), "overbought" (RSI > 70).
        limit: Max number of rows to return (default: 15).
    """
    # Map market parameter to TradingView scanner endpoint
    market_map = {
        "crypto": "crypto",
        "forex": "forex",
        "america": "global",
        "global": "global"
    }
    
    scan_market = market_map.get(market.lower(), "crypto")
    url = f"https://scanner.tradingview.com/{scan_market}/scan"
    
    # Configure filters and columns based on selected condition
    filters = []
    sort_by = "volume"
    sort_order = "desc"
    
    if condition == "oversold":
        filters.append({"left": "RSI", "operation": "less", "right": 30})
        sort_by = "RSI"
        sort_order = "asc"
    elif condition == "overbought":
        filters.append({"left": "RSI", "operation": "greater", "right": 70})
        sort_by = "RSI"
        sort_order = "desc"
    elif condition == "top_gainers":
        sort_by = "change"
        sort_order = "desc"
    elif condition == "top_volume":
        sort_by = "volume"
        sort_order = "desc"

    # Define request columns
    columns = ["name", "close", "change", "volume", "RSI", "recommendation"]
    
    # Prepare POST payload
    payload = {
        "filter": filters,
        "options": {"lang": "en"},
        "markets": [market],
        "symbols": {"query": {"types": []}, "tickers": []},
        "columns": columns,
        "sort": {"sortBy": sort_by, "sortOrder": sort_order},
        "range": [0, limit]
    }
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = json.load(response)
            
        data = res_data.get("data", [])
        
        # Format output as markdown table
        lines = [
            f"### TradingView Technical Scan ({market.upper()} - {condition.upper()})",
            "",
            "| Asset | Price | Change % | Volume | RSI (14) | Recommendation |",
            "| :--- | :--- | :--- | :--- | :--- | :--- |"
        ]
        
        for row in data:
            name = row.get("d", [None])[0] or row.get("s", "UNKNOWN")
            # Remove exchange prefix if present in name
            name_parts = name.split(":")
            short_name = name_parts[1] if len(name_parts) > 1 else name_parts[0]
            
            d_values = row.get("d", [])
            close = d_values[1] if len(d_values) > 1 else "N/A"
            change = d_values[2] if len(d_values) > 2 else "N/A"
            volume = d_values[3] if len(d_values) > 3 else "N/A"
            rsi = d_values[4] if len(d_values) > 4 else "N/A"
            rec = d_values[5] if len(d_values) > 5 else "N/A"
            
            # Format decimals for cleaner presentation
            fmt_close = f"{close:.4f}" if isinstance(close, (int, float)) else str(close)
            fmt_change = f"{change:.2f}%" if isinstance(change, (int, float)) else str(change)
            fmt_rsi = f"{rsi:.2f}" if isinstance(rsi, (int, float)) else str(rsi)
            
            # Format volume to human readable suffix (e.g. 1.2M, 50K)
            if isinstance(volume, (int, float)):
                if volume >= 1_000_000:
                    fmt_vol = f"{volume / 1_000_000:.2f}M"
                elif volume >= 1_000:
                    fmt_vol = f"{volume / 1_000:.1f}K"
                else:
                    fmt_vol = str(volume)
            else:
                fmt_vol = str(volume)
                
            # Map recommendation values
            rec_map = {
                1: "🟢 Strong Buy",
                0.5: "🟢 Buy",
                0: "⚪ Neutral",
                -0.5: "🔴 Sell",
                -1: "🔴 Strong Sell"
            }
            fmt_rec = rec_map.get(rec, str(rec)) if isinstance(rec, (int, float)) else str(rec)
            
            lines.append(f"| **{short_name}** | {fmt_close} | {fmt_change} | {fmt_vol} | {fmt_rsi} | {fmt_rec} |")
            
        return "\n".join(lines)
        
    except urllib.error.URLError as e:
        return f"Error connecting to TradingView Screener API: {e.reason}"
    except Exception as e:
        return f"Error executing scan: {str(e)}"

# Self-run for testing
if __name__ == "__main__":
    import sys
    mkt = sys.argv[1] if len(sys.argv) > 1 else "crypto"
    cond = sys.argv[2] if len(sys.argv) > 2 else "top_volume"
    print(run_screener(mkt, cond, 10))
