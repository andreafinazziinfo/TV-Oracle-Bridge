"""
screener_presets.py — Presets configuration and filtering for the Advanced Screener Layer.
"""

from typing import List, Dict, Any, Callable

# Helper to check if a value is a float/int
def _is_num(v) -> bool:
    return isinstance(v, (int, float))

# Define local filters for complex conditions that the raw TradingView API cannot compute
def local_whale_accumulation(row: Dict[str, Any]) -> bool:
    vol = row.get("volume")
    avg_vol = row.get("average_volume_30d_calc")
    return _is_num(vol) and _is_num(avg_vol) and avg_vol > 0 and vol > 3 * avg_vol

def local_low_volatility_squeeze(row: Dict[str, Any]) -> bool:
    upper = row.get("BB.upper")
    lower = row.get("BB.lower")
    close = row.get("close")
    return (
        _is_num(upper) and _is_num(lower) and _is_num(close) and close > 0 
        and (upper - lower) / close < 0.02
    )

def local_unusual_volume(row: Dict[str, Any]) -> bool:
    vol = row.get("volume")
    avg_vol = row.get("average_volume_30d_calc")
    change = row.get("change")
    return (
        _is_num(vol) and _is_num(avg_vol) and avg_vol > 0 and vol > 2 * avg_vol 
        and _is_num(change) and abs(change) > 2.0
    )

def local_mean_reversion(row: Dict[str, Any]) -> bool:
    close = row.get("close")
    lower = row.get("BB.lower")
    return _is_num(close) and _is_num(lower) and close < lower

def local_cycle_reversal_long(row: Dict[str, Any]) -> bool:
    macd = row.get("MACD.macd")
    signal = row.get("MACD.signal")
    close = row.get("close")
    lower = row.get("BB.lower")
    macd_ok = macd > signal if (_is_num(macd) and _is_num(signal)) else True
    bb_ok = close <= lower * 1.02 if (_is_num(close) and _is_num(lower)) else True
    return macd_ok and bb_ok

def local_cycle_reversal_short(row: Dict[str, Any]) -> bool:
    macd = row.get("MACD.macd")
    signal = row.get("MACD.signal")
    close = row.get("close")
    upper = row.get("BB.upper")
    macd_ok = macd < signal if (_is_num(macd) and _is_num(signal)) else True
    bb_ok = close >= upper * 0.98 if (_is_num(close) and _is_num(upper)) else True
    return macd_ok and bb_ok

def local_divergence_scan(row: Dict[str, Any]) -> bool:
    rsi = row.get("RSI")
    rsi_prev = row.get("RSI[1]")
    close = row.get("close")
    close_prev = row.get("close[1]")
    
    # Check if we have prev bar data
    if _is_num(rsi) and _is_num(rsi_prev) and _is_num(close) and _is_num(close_prev):
        bullish_div = rsi > rsi_prev and close < close_prev
        bearish_div = rsi < rsi_prev and close > close_prev
        return bullish_div or bearish_div
        
    # Fallback to daily change vs recommendation if no prev bar data
    change = row.get("change")
    rec = row.get("Recommend.All")
    if _is_num(change) and _is_num(rec):
        return (change < -1.0 and rec > 0.2) or (change > 1.0 and rec < -0.2)
        
    return False

# Preset definitions registry
PRESETS: Dict[str, Dict[str, Any]] = {
    # --- LEGACY / BACKWARD-COMPATIBLE PRESETS ---
    "top_volume": {
        "title": "Top Volume Assets",
        "fields": ["name", "close", "change", "volume", "RSI", "Recommend.All"],
        "filters": [],
        "sort_by": "volume",
        "sort_order": "desc"
    },
    "top_gainers": {
        "title": "Top Gainers Assets",
        "fields": ["name", "close", "change", "volume", "RSI", "Recommend.All"],
        "filters": [],
        "sort_by": "change",
        "sort_order": "desc"
    },
    "oversold": {
        "title": "Oversold Assets (RSI < 30)",
        "fields": ["name", "close", "change", "volume", "RSI", "Stoch.RSI.K", "Recommend.All"],
        "filters": [{"left": "RSI", "operation": "less", "right": 30}],
        "sort_by": "RSI",
        "sort_order": "asc"
    },
    "overbought": {
        "title": "Overbought Assets (RSI > 70)",
        "fields": ["name", "close", "change", "volume", "RSI", "Stoch.RSI.K", "Recommend.All"],
        "filters": [{"left": "RSI", "operation": "greater", "right": 70}],
        "sort_by": "RSI",
        "sort_order": "desc"
    },

    # --- MOMENTUM & TREND ---
    "momentum_breakout": {
        "title": "Momentum Breakout (RSI > 55, ADX > 25, MACD > 0)",
        "fields": ["name", "close", "change", "volume", "RSI", "MACD.macd", "ADX", "ATR"],
        "filters": [
            {"left": "RSI", "operation": "greater", "right": 55},
            {"left": "ADX", "operation": "greater", "right": 25},
            {"left": "MACD.macd", "operation": "greater", "right": 0}
        ],
        "sort_by": "change",
        "sort_order": "desc"
    },
    "trend_following": {
        "title": "Trend Following (SMA20 > SMA50)",
        "fields": ["name", "close", "SMA20", "SMA50", "EMA50", "EMA200", "Recommend.MA"],
        "filters": [{"left": "SMA20", "operation": "greater", "right": "SMA50"}],
        "sort_by": "Recommend.MA",
        "sort_order": "desc"
    },
    "golden_cross": {
        "title": "Golden Cross (SMA50 crosses above SMA200)",
        "fields": ["name", "close", "SMA50", "SMA200", "volume", "change"],
        "filters": [{"left": "SMA50", "operation": "crosses_above", "right": "SMA200"}],
        "sort_by": "volume",
        "sort_order": "desc"
    },
    "death_cross": {
        "title": "Death Cross (SMA50 crosses below SMA200)",
        "fields": ["name", "close", "SMA50", "SMA200", "volume", "change"],
        "filters": [{"left": "SMA50", "operation": "crosses_below", "right": "SMA200"}],
        "sort_by": "volume",
        "sort_order": "desc"
    },

    # --- MEAN REVERSION & OSCILLATORS ---
    "mean_reversion": {
        "title": "Mean Reversion (RSI < 35 & Close < BB Lower)",
        "fields": ["name", "close", "RSI", "BB.lower", "BB.upper", "Stoch.RSI.K", "change"],
        "filters": [{"left": "RSI", "operation": "less", "right": 35}],
        "local_filter": local_mean_reversion,
        "sort_by": "RSI",
        "sort_order": "asc"
    },
    "stoch_oversold": {
        "title": "Stochastic Oversold (Stoch K < 20)",
        "fields": ["name", "close", "Stoch.K", "Stoch.D", "Stoch.RSI.K", "volume"],
        "filters": [{"left": "Stoch.K", "operation": "less", "right": 20}],
        "sort_by": "Stoch.K",
        "sort_order": "asc"
    },
    "stoch_overbought": {
        "title": "Stochastic Overbought (Stoch K > 80)",
        "fields": ["name", "close", "Stoch.K", "Stoch.D", "Stoch.RSI.K", "volume"],
        "filters": [{"left": "Stoch.K", "operation": "greater", "right": 80}],
        "sort_by": "Stoch.K",
        "sort_order": "desc"
    },
    "cci_extreme_low": {
        "title": "CCI Extreme Low (CCI < -100)",
        "fields": ["name", "close", "CCI20", "RSI", "change"],
        "filters": [{"left": "CCI20", "operation": "less", "right": -100}],
        "sort_by": "CCI20",
        "sort_order": "asc"
    },
    "cci_extreme_high": {
        "title": "CCI Extreme High (CCI > 100)",
        "fields": ["name", "close", "CCI20", "RSI", "change"],
        "filters": [{"left": "CCI20", "operation": "greater", "right": 100}],
        "sort_by": "CCI20",
        "sort_order": "desc"
    },

    # --- VOLUME & ACCUMULATION ---
    "whale_accumulation": {
        "title": "Whale Accumulation (Volume > 3x Avg Vol)",
        "fields": ["name", "close", "volume", "average_volume_30d_calc", "change", "RSI"],
        "filters": [{"left": "volume", "operation": "greater", "right": "average_volume_30d_calc"}],
        "local_filter": local_whale_accumulation,
        "sort_by": "volume",
        "sort_order": "desc"
    },
    "high_volatility": {
        "title": "High Volatility (Ranked by Daily Volatility)",
        "fields": ["name", "close", "ATR", "Volatility.D", "change", "volume"],
        "filters": [],
        "sort_by": "Volatility.D",
        "sort_order": "desc"
    },
    "low_volatility_squeeze": {
        "title": "Low Volatility Squeeze ((BB Upper - Lower) / Close < 2%)",
        "fields": ["name", "close", "ATR", "BB.upper", "BB.lower", "volume"],
        "filters": [],
        "local_filter": local_low_volatility_squeeze,
        "sort_by": "ATR",
        "sort_order": "asc"
    },
    "unusual_volume": {
        "title": "Unusual Volume (Vol > 2x Avg & Change > 2%)",
        "fields": ["name", "close", "volume", "average_volume_30d_calc", "change"],
        "filters": [{"left": "volume", "operation": "greater", "right": "average_volume_30d_calc"}],
        "local_filter": local_unusual_volume,
        "sort_by": "volume",
        "sort_order": "desc"
    },

    # --- RECOMMENDATIONS & PERFORMANCE ---
    "strong_buy_consensus": {
        "title": "Strong Buy Consensus (Recommend.All > 0.5)",
        "fields": ["name", "close", "Recommend.All", "Recommend.MA", "Recommend.Other", "change"],
        "filters": [{"left": "Recommend.All", "operation": "greater", "right": 0.5}],
        "sort_by": "Recommend.All",
        "sort_order": "desc"
    },
    "strong_sell_consensus": {
        "title": "Strong Sell Consensus (Recommend.All < -0.5)",
        "fields": ["name", "close", "Recommend.All", "Recommend.MA", "Recommend.Other", "change"],
        "filters": [{"left": "Recommend.All", "operation": "less", "right": -0.5}],
        "sort_by": "Recommend.All",
        "sort_order": "asc"
    },
    "weekly_performers": {
        "title": "Top Weekly Performers (Perf.W > 5%)",
        "fields": ["name", "close", "Perf.W", "Perf.1M", "volume", "RSI"],
        "filters": [{"left": "Perf.W", "operation": "greater", "right": 5}],
        "sort_by": "Perf.W",
        "sort_order": "desc"
    },
    "monthly_losers": {
        "title": "Top Monthly Losers (Perf.1M < -10%)",
        "fields": ["name", "close", "Perf.1M", "Perf.3M", "volume", "RSI"],
        "filters": [{"left": "Perf.1M", "operation": "less", "right": -10}],
        "sort_by": "Perf.1M",
        "sort_order": "asc"
    },

    # --- QUANT-OPTIMIZED COMBOS ---
    "cycle_reversal_long": {
        "title": "Cycle Reversal Long (RSI < 35, MACD Bullish & BB Lower)",
        "fields": ["name", "close", "RSI", "MACD.macd", "MACD.signal", "Stoch.RSI.K", "BB.lower", "BB.upper", "volume"],
        "filters": [{"left": "RSI", "operation": "less", "right": 35}],
        "local_filter": local_cycle_reversal_long,
        "sort_by": "RSI",
        "sort_order": "asc"
    },
    "cycle_reversal_short": {
        "title": "Cycle Reversal Short (RSI > 65, MACD Bearish & BB Upper)",
        "fields": ["name", "close", "RSI", "MACD.macd", "MACD.signal", "Stoch.RSI.K", "BB.upper", "BB.lower", "volume"],
        "filters": [{"left": "RSI", "operation": "greater", "right": 65}],
        "local_filter": local_cycle_reversal_short,
        "sort_by": "RSI",
        "sort_order": "desc"
    },
    "divergence_scan": {
        "title": "Divergence Scan (Price and RSI Diverging)",
        "fields": ["name", "close", "RSI", "MACD.macd", "change", "Perf.W", "volume", "RSI[1]", "close[1]"],
        "filters": [],
        "local_filter": local_divergence_scan,
        "sort_by": "volume",
        "sort_order": "desc"
    }
}

# Load local presets if they exist and merge them
import json
from pathlib import Path

LOCAL_PRESETS_PATH = Path(__file__).parent / "screener_presets.local.json"
if LOCAL_PRESETS_PATH.exists():
    try:
        with open(LOCAL_PRESETS_PATH, "r", encoding="utf-8") as f:
            local_data = json.load(f)
            if isinstance(local_data, dict):
                for k, v in local_data.items():
                    key_lower = k.lower()
                    PRESETS[key_lower] = {
                        "title": v.get("title", k),
                        "fields": v.get("fields", ["name", "close", "change", "volume"]),
                        "filters": v.get("filters", []),
                        "sort_by": v.get("sort_by", "volume"),
                        "sort_order": v.get("sort_order", "desc")
                    }
    except Exception as e:
        print(f"[Warning] Failed to load local presets: {e}")

