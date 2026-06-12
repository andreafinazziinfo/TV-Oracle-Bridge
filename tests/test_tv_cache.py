"""
test_tv_cache.py — Unit tests for SQLite caching and run telemetry database.
"""

import os
import time
import pytest
from unittest.mock import patch
from tv_cache import (
    init_db, get_connection, save_bars_to_cache, get_cached_bars,
    cleanup_old_bars, record_run, get_run_history, get_cache_stats, DB_PATH
)

def test_db_init_and_wal_mode():
    init_db()
    assert DB_PATH.exists()
    
    # Verify WAL journal mode
    conn = get_connection()
    cursor = conn.execute("PRAGMA journal_mode;")
    mode = cursor.fetchone()[0]
    conn.close()
    assert mode.lower() == "wal"

def test_cache_save_and_retrieve():
    init_db()
    indicator_key = "test_indicator"
    symbol = "BTCUSD"
    timeframe = "60"
    
    periods = [{"time": 1000, "plot1": 1.23}]
    ohlc = [{"time": 1000, "open": 10.0, "high": 11.0, "low": 9.0, "close": 10.5, "volume": 100.0}]
    
    save_bars_to_cache(indicator_key, symbol, timeframe, periods, ohlc)
    
    cached_periods, cached_ohlc = get_cached_bars(indicator_key, symbol, timeframe)
    
    assert len(cached_ohlc) == 1
    assert cached_ohlc[0]["time"] == 1000
    assert cached_ohlc[0]["close"] == 10.5
    
    assert len(cached_periods) == 1
    assert cached_periods[0]["plot1"] == 1.23

def test_record_and_retrieve_runs():
    init_db()
    started = "2026-06-12T10:00:00Z"
    finished = "2026-06-12T10:01:00Z"
    
    record_run("completa", "BTCUSD", "60", started, finished, "success", 100, 100, True)
    
    history = get_run_history("completa", 5)
    assert len(history) >= 1
    assert history[0]["status"] == "success"
    assert history[0]["started_at"] == started

def test_cache_stats():
    init_db()
    stats = get_cache_stats()
    assert "total_rows" in stats
    assert "db_size_bytes" in stats
    assert isinstance(stats["details"], list)

def test_cleanup_old_bars():
    init_db()
    # Ensure it executes successfully
    deleted = cleanup_old_bars(90)
    assert isinstance(deleted, int)
