import json
import sys
from pathlib import Path
from typing import List, Dict, Any

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def analyze_ohlc_patterns(ohlc: List[Dict[str, Any]]) -> str:
    """Analyze historical OHLC bars and detect key candlestick patterns.
    
    Args:
        ohlc: List of bars, where each bar is a dict with {"time": int, "open": float, "high": float, "low": float, "close": float, "volume": float}
    """
    if not ohlc or len(ohlc) < 3:
        return "Error: Insufficient OHLC data to analyze patterns (minimum 3 bars required)."
        
    # Analyze the last 15 bars for pattern occurrences
    bars_to_analyze = ohlc[-15:]
    detected = []
    
    for i in range(1, len(bars_to_analyze)):
        curr = bars_to_analyze[i]
        prev = bars_to_analyze[i-1]
        
        # Helper metrics
        body = abs(curr["close"] - curr["open"])
        candle_range = curr["high"] - curr["low"]
        if candle_range == 0:
            continue
            
        body_pct = body / candle_range
        upper_shadow = curr["high"] - max(curr["close"], curr["open"])
        lower_shadow = min(curr["close"], curr["open"]) - curr["low"]
        
        is_bullish = curr["close"] > curr["open"]
        is_bearish = curr["close"] < curr["open"]
        
        prev_body = abs(prev["close"] - prev["open"])
        
        # 1. Doji (Very small body relative to overall range)
        if body_pct < 0.10:
            detected.append({
                "bar_index": i,
                "time": curr["time"],
                "pattern": "⚖️ Doji",
                "type": "Neutral / Indecision",
                "description": f"Open ({curr['open']}) and Close ({curr['close']}) are virtually equal. Indicates market indecision."
            })
            
        # 2. Hammer (Small body at top of range, long lower shadow, minimal upper shadow)
        elif lower_shadow > (2 * body) and upper_shadow < (0.2 * body) and body_pct > 0.10 and body_pct < 0.40:
            detected.append({
                "bar_index": i,
                "time": curr["time"],
                "pattern": "🔨 Hammer" if is_bullish else "🔨 Hanging Man",
                "type": "Bullish Reversal (if downtrend)" if is_bullish else "Bearish Reversal (if uptrend)",
                "description": f"Long lower shadow ({lower_shadow:.2f}) indicates strong rejection of lower prices by buyers."
            })
            
        # 3. Shooting Star (Small body at bottom of range, long upper shadow, minimal lower shadow)
        elif upper_shadow > (2 * body) and lower_shadow < (0.2 * body) and body_pct > 0.10 and body_pct < 0.40:
            detected.append({
                "bar_index": i,
                "time": curr["time"],
                "pattern": "🌠 Shooting Star" if is_bearish else "🌠 Inverted Hammer",
                "type": "Bearish Reversal (if uptrend)" if is_bearish else "Bullish Reversal (if downtrend)",
                "description": f"Long upper shadow ({upper_shadow:.2f}) indicates strong rejection of higher prices by sellers."
            })
            
        # 4. Bullish Engulfing (Current bullish body completely engulfs previous bearish body)
        elif is_bullish and prev["close"] < prev["open"] and curr["open"] <= prev["close"] and curr["close"] >= prev["open"] and body > prev_body:
            detected.append({
                "bar_index": i,
                "time": curr["time"],
                "pattern": "🟢 Bullish Engulfing",
                "type": "Bullish Reversal",
                "description": f"Bullish body ({curr['open']} -> {curr['close']}) completely engulfs previous bearish candle. Strong buy signal."
            })
            
        # 5. Bearish Engulfing (Current bearish body completely engulfs previous bullish body)
        elif is_bearish and prev["close"] > prev["open"] and curr["open"] >= prev["close"] and curr["close"] <= prev["open"] and body > prev_body:
            detected.append({
                "bar_index": i,
                "time": curr["time"],
                "pattern": "🔴 Bearish Engulfing",
                "type": "Bearish Reversal",
                "description": f"Bearish body ({curr['open']} -> {curr['close']}) completely engulfs previous bullish candle. Strong sell signal."
            })

    if not detected:
        return "No clear candlestick patterns (Doji, Hammer, Engulfing, etc.) detected in the analyzed range."

    # Format into markdown table
    lines = [
        "### Candlestick Pattern Report (Last 15 Bars)",
        "",
        "| Time (Raw) | Pattern | Signal Type | Description |",
        "| :--- | :--- | :--- | :--- |"
    ]
    for d in detected:
        lines.append(f"| {d['time']} | **{d['pattern']}** | {d['type']} | {d['description']} |")
        
    return "\n".join(lines)

def detect_from_oracle_file(file_path: str) -> str:
    """Read the chartOhlc data from a saved TV Oracle JSON output and run pattern detection."""
    p = Path(file_path)
    if not p.exists():
        return f"Error: Oracle JSON file not found at {file_path}. Please run fetch_indicator first."
        
    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        ohlc = data.get("chartOhlc", [])
        if not ohlc:
            return f"Error: No 'chartOhlc' data found in file {file_path}."
            
        return analyze_ohlc_patterns(ohlc)
    except Exception as e:
        return f"Error parsing oracle file: {str(e)}"

if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "out/completa.json"
    print(detect_from_oracle_file(path))

