import sqlite3
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple

# Ensure UTF-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

CACHE_DIR = Path(__file__).parent.resolve() / "out"
DB_PATH = CACHE_DIR / "tv_oracle_cache.db"

def init_db():
    """Initialize the SQLite database and create cache tables if they don't exist."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Create table for historical bar data (OHLCV + plots)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bars (
        indicator_key TEXT,
        symbol TEXT,
        timeframe TEXT,
        time INTEGER,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume REAL,
        plots TEXT, -- JSON string of plots dict
        PRIMARY KEY (indicator_key, symbol, timeframe, time)
    )
    """)
    conn.commit()
    conn.close()

def get_last_cached_timestamp(indicator_key: str, symbol: str, timeframe: str) -> int:
    """Retrieve the maximum timestamp cached for a given indicator/symbol/timeframe."""
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT MAX(time) FROM bars 
        WHERE indicator_key = ? AND symbol = ? AND timeframe = ?
    """, (indicator_key, symbol, timeframe))
    
    row = cursor.fetchone()
    conn.close()
    
    if row and row[0] is not None:
        return int(row[0])
    return 0

def save_bars_to_cache(indicator_key: str, symbol: str, timeframe: str, periods: List[Dict[str, Any]], ohlc: List[Dict[str, Any]]):
    """Save/update fetched periods and OHLC bars to the SQLite database."""
    if not ohlc:
        return
        
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Map periods by time for easy matching
    periods_by_time = {p["time"]: p for p in periods if "time" in p}
    
    # Insert or replace bars
    insert_data = []
    for bar in ohlc:
        t = bar.get("time")
        if t is None:
            continue
            
        # Extract plot data corresponding to this bar's time
        p_data = periods_by_time.get(t, {})
        # Remove time from plots dict to save space since it's a column
        plots_only = {k: v for k, v in p_data.items() if k != "time"}
        plots_json = json.dumps(plots_only)
        
        insert_data.append((
            indicator_key,
            symbol,
            timeframe,
            int(t),
            bar.get("open"),
            bar.get("high"),
            bar.get("low"),
            bar.get("close"),
            bar.get("volume"),
            plots_json
        ))
        
    cursor.executemany("""
        INSERT OR REPLACE INTO bars (indicator_key, symbol, timeframe, time, open, high, low, close, volume, plots)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, insert_data)
    
    conn.commit()
    conn.close()
    print(f"[SQLite Cache] Saved/Updated {len(insert_data)} bars for {symbol} ({timeframe}) in cache.")

def get_cached_bars(indicator_key: str, symbol: str, timeframe: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Retrieve all cached periods and OHLC bars from the SQLite database sorted by time."""
    init_db()
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT time, open, high, low, close, volume, plots FROM bars
        WHERE indicator_key = ? AND symbol = ? AND timeframe = ?
        ORDER BY time ASC
    """, (indicator_key, symbol, timeframe))
    
    rows = cursor.fetchall()
    conn.close()
    
    periods = []
    ohlc = []
    
    for r in rows:
        t = r[0]
        # Construct OHLC
        ohlc.append({
            "time": t,
            "open": r[1],
            "high": r[2],
            "low": r[3],
            "close": r[4],
            "volume": r[5]
        })
        
        # Construct periods
        plots_dict = {}
        if r[6]:
            try:
                plots_dict = json.loads(r[6])
            except Exception:
                pass
        plots_dict["time"] = t
        periods.append(plots_dict)
        
    return periods, ohlc

def merge_and_update_cache(indicator_key: str, symbol: str, timeframe: str, fresh_data: Dict[str, Any]) -> Dict[str, Any]:
    """Insert fresh fetched data into the cache, then return the full historical merged dataset."""
    fresh_periods = fresh_data.get("periods", [])
    fresh_ohlc = fresh_data.get("chartOhlc", [])
    
    # Save the new bars to SQLite
    save_bars_to_cache(indicator_key, symbol, timeframe, fresh_periods, fresh_ohlc)
    
    # Load all historical bars from database cache
    all_periods, all_ohlc = get_cached_bars(indicator_key, symbol, timeframe)
    
    # Merge into the fresh data structure
    merged_data = {
        "meta": fresh_data.get("meta", {}),
        "plots": fresh_data.get("plots", []),
        "inputs": fresh_data.get("inputs", {}),
        "graphicSummary": fresh_data.get("graphicSummary", {}),
        "periodsCount": len(all_periods),
        "periodsSample": all_periods[-3:] if all_periods else [],
        "periods": all_periods,
        "graphic": fresh_data.get("graphic", {}),
        "strategyReport": fresh_data.get("strategyReport"),
        "chartOhlc": all_ohlc
    }
    
    # Save the merged JSON to out/<key>.json
    out_file = CACHE_DIR / f"{indicator_key}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(merged_data, f, indent=2)
        
    return merged_data
