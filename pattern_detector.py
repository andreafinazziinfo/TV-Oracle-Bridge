"""
pattern_detector.py — Candlestick pattern detection module.

Identifies patterns (Doji, Hammer, Engulfing, etc.) and provides markdown reports
and visual chart annotations.
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Any
from bridge_utils import init_io

# Ensure UTF-8 stdout
init_io()

def _detect_patterns(ohlc: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Private shared helper containing the logic for detecting candlestick patterns."""
    if not ohlc or len(ohlc) < 3:
        return []
        
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
        
        pattern_type = None
        label = ""
        sig_type = ""
        desc = ""
        color = ""
        border_color = ""
        
        # Color palettes for overlays
        c_green = "rgba(16, 185, 129, 0.15)"
        b_green = "rgb(16, 185, 129)"
        c_red = "rgba(239, 68, 68, 0.15)"
        b_red = "rgb(239, 68, 68)"
        c_yellow = "rgba(245, 158, 11, 0.15)"
        b_yellow = "rgb(245, 158, 11)"
        
        # 1. Doji (Very small body relative to overall range)
        if body_pct < 0.10:
            pattern_type = "doji"
            label = "Doji"
            sig_type = "Neutral / Indecision"
            desc = f"Open ({curr['open']}) and Close ({curr['close']}) are virtually equal. Indicates market indecision."
            color = c_yellow
            border_color = b_yellow
            
        # 2. Hammer / Hanging Man (Small body at top, long lower shadow, minimal upper shadow)
        elif lower_shadow > (2 * body) and upper_shadow < (0.2 * body) and body_pct > 0.10 and body_pct < 0.40:
            pattern_type = "hammer"
            label = "Hammer" if is_bullish else "Hanging Man"
            sig_type = "Bullish Reversal (if downtrend)" if is_bullish else "Bearish Reversal (if uptrend)"
            desc = f"Long lower shadow ({lower_shadow:.2f}) indicates strong rejection of lower prices by buyers."
            color = c_green if is_bullish else c_red
            border_color = b_green if is_bullish else b_red
            
        # 3. Shooting Star / Inverted Hammer (Small body at bottom, long upper shadow, minimal lower shadow)
        elif upper_shadow > (2 * body) and lower_shadow < (0.2 * body) and body_pct > 0.10 and body_pct < 0.40:
            pattern_type = "shooting_star"
            label = "Shooting Star" if is_bearish else "Inverted Hammer"
            sig_type = "Bearish Reversal (if uptrend)" if is_bearish else "Bullish Reversal (if downtrend)"
            desc = f"Long upper shadow ({upper_shadow:.2f}) indicates strong rejection of higher prices by sellers."
            color = c_red if is_bearish else c_green
            border_color = b_red if is_bearish else b_green
            
        # 4. Bullish Engulfing (Current bullish body completely engulfs previous bearish body)
        elif is_bullish and prev["close"] < prev["open"] and curr["open"] <= prev["close"] and curr["close"] >= prev["open"] and body > prev_body:
            pattern_type = "bullish_engulfing"
            label = "Bullish Engulfing"
            sig_type = "Bullish Reversal"
            desc = f"Bullish body ({curr['open']} -> {curr['close']}) completely engulfs previous bearish candle. Strong buy signal."
            color = c_green
            border_color = b_green
            
        # 5. Bearish Engulfing (Current bearish body completely engulfs previous bullish body)
        elif is_bearish and prev["close"] > prev["open"] and curr["open"] >= prev["close"] and curr["close"] <= prev["open"] and body > prev_body:
            pattern_type = "bearish_engulfing"
            label = "Bearish Engulfing"
            sig_type = "Bearish Reversal"
            desc = f"Bearish body ({curr['open']} -> {curr['close']}) completely engulfs previous bullish candle. Strong sell signal."
            color = c_red
            border_color = b_red
            
        if pattern_type:
            detected.append({
                "bar_index": i,
                "time": curr["time"],
                "pattern_type": pattern_type,
                "label": label,
                "sig_type": sig_type,
                "description": desc,
                "color": color,
                "border_color": border_color,
                "bar_index_from_right": len(bars_to_analyze) - 1 - i
            })
            
    return detected

def analyze_ohlc_patterns(ohlc: List[Dict[str, Any]]) -> str:
    """Analyze historical OHLC bars and detect key candlestick patterns, returning a markdown table."""
    if not ohlc or len(ohlc) < 3:
        return "Error: Insufficient OHLC data to analyze patterns (minimum 3 bars required)."
        
    detected = _detect_patterns(ohlc)
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
        # Match original emoji formatting
        emoji_map = {
            "doji": "⚖️ Doji",
            "hammer": "🔨 Hammer" if "Hammer" in d["label"] else "🔨 Hanging Man",
            "shooting_star": "🌠 Shooting Star" if "Shooting Star" in d["label"] else "🌠 Inverted Hammer",
            "bullish_engulfing": "🟢 Bullish Engulfing",
            "bearish_engulfing": "🔴 Bearish Engulfing"
        }
        pat_name = emoji_map.get(d["pattern_type"], d["label"])
        lines.append(f"| {d['time']} | **{pat_name}** | {d['sig_type']} | {d['description']} |")
        
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

def get_candlestick_annotations(ohlc: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Detect key patterns on the last 15 bars and return Playwright-compatible annotation objects."""
    detected = _detect_patterns(ohlc)
    annotations = []
    for d in detected:
        annotations.append({
            "barIndexFromRight": d["bar_index_from_right"],
            "color": d["color"],
            "borderColor": d["border_color"],
            "label": d["label"]
        })
    return annotations

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "out/completa.json"
    print(detect_from_oracle_file(path))
