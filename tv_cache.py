"""
tv_cache.py — SQLite caching layer for historical bar data and run metrics.

Provides WAL mode for concurrency, historical period merging, run telemetry, 
and cache eviction policies.
"""

import sqlite3
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple
from bridge_utils import init_io

# Ensure UTF-8 stdout
init_io()

CACHE_DIR = Path(__file__).parent.resolve() / "out"
DB_PATH = CACHE_DIR / "tv_oracle_cache.db"

def get_connection() -> sqlite3.Connection:
    """Establish thread-safe connection to the SQLite database with WAL mode enabled."""
    conn = sqlite3.connect(str(DB_PATH), timeout=15.0)
    # Enable WAL mode and normal synchronization for thread concurrency and speed
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn

def init_db():
    """Initialize the SQLite database and create cache and run tables if they don't exist."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    conn = get_connection()
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
    
    # Create table for execution run telemetry (Phase 3 addition)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        indicator_key TEXT,
        symbol TEXT,
        timeframe TEXT,
        started_at TEXT,
        finished_at TEXT,
        status TEXT,
        bars_fetched INTEGER,
        bars_merged INTEGER,
        delta_sync BOOLEAN,
        error_message TEXT
    )
    """)
    
    conn.commit()
    conn.close()

def get_last_cached_timestamp(indicator_key: str, symbol: str, timeframe: str) -> int:
    """Retrieve the maximum timestamp cached for a given indicator/symbol/timeframe."""
    init_db()
    conn = get_connection()
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
    conn = get_connection()
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
    conn = get_connection()
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

def record_run(
    indicator_key: str,
    symbol: str,
    timeframe: str,
    started_at: str,
    finished_at: str,
    status: str,
    bars_fetched: int,
    bars_merged: int,
    delta_sync: bool,
    error_message: str = None
):
    """Write run metrics and status report into the execution telemetry runs table."""
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO runs (indicator_key, symbol, timeframe, started_at, finished_at, status, bars_fetched, bars_merged, delta_sync, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (indicator_key, symbol, timeframe, started_at, finished_at, status, bars_fetched, bars_merged, delta_sync, error_message))
    
    conn.commit()
    conn.close()
    print(f"[SQLite RunLog] Logged run for '{indicator_key}' status={status} fetched={bars_fetched} merged={bars_merged}.")

def get_run_history(indicator_key: str = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve run execution history logs for telemetric monitoring."""
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    
    if indicator_key:
        cursor.execute("""
            SELECT id, indicator_key, symbol, timeframe, started_at, finished_at, status, bars_fetched, bars_merged, delta_sync, error_message
            FROM runs WHERE indicator_key = ? ORDER BY id DESC LIMIT ?
        """, (indicator_key, limit))
    else:
        cursor.execute("""
            SELECT id, indicator_key, symbol, timeframe, started_at, finished_at, status, bars_fetched, bars_merged, delta_sync, error_message
            FROM runs ORDER BY id DESC LIMIT ?
        """, (limit,))
        
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for r in rows:
        history.append({
            "id": r[0],
            "indicator_key": r[1],
            "symbol": r[2],
            "timeframe": r[3],
            "started_at": r[4],
            "finished_at": r[5],
            "status": r[6],
            "bars_fetched": r[7],
            "bars_merged": r[8],
            "delta_sync": bool(r[9]),
            "error_message": r[10]
        })
    return history

def cleanup_old_bars(max_age_days: int = 90) -> int:
    """Evict historical bars older than max_age_days to manage disk space."""
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    
    max_age_seconds = max_age_days * 24 * 60 * 60
    cutoff_time = int(time.time()) - max_age_seconds
    
    cursor.execute("DELETE FROM bars WHERE time < ?", (cutoff_time,))
    deleted_rows = cursor.rowcount
    conn.commit()
    conn.close()
    print(f"[SQLite Cache] Evicted {deleted_rows} bars older than {max_age_days} days.")
    return deleted_rows

def get_cache_stats() -> Dict[str, Any]:
    """Retrieve database disk stats and row counts."""
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get total row count
    cursor.execute("SELECT COUNT(*) FROM bars")
    total_rows = cursor.fetchone()[0] or 0
    
    # Get details per indicator/symbol/timeframe
    cursor.execute("""
        SELECT indicator_key, symbol, timeframe, COUNT(*), MIN(time), MAX(time)
        FROM bars
        GROUP BY indicator_key, symbol, timeframe
    """)
    rows = cursor.fetchall()
    conn.close()
    
    db_size = 0
    if DB_PATH.exists():
        db_size = DB_PATH.stat().st_size
        
    details = []
    for r in rows:
        details.append({
            "indicator_key": r[0],
            "symbol": r[1],
            "timeframe": r[2],
            "count": r[3],
            "oldest": r[4],
            "newest": r[5]
        })
        
    return {
        "db_size_bytes": db_size,
        "total_rows": total_rows,
        "details": details
    }
