"""
test_screener.py — Smoke tests for presets and custom queries execution.
"""

from unittest.mock import patch
from screener import run_screener, run_custom_screener

@patch("screener_core.execute_query")
def test_run_screener_presets(mock_exec):
    # Mock row data matching columns for oversold
    mock_exec.return_value = [
        {"name": "BINANCE:BTCUSDT", "close": 65000.0, "change": 1.5, "volume": 1000000, "RSI": 25.0, "Stoch.RSI.K": 10.0, "Recommend.All": -0.2}
    ]
    
    # Test oversold preset
    res = run_screener("crypto", "oversold", 5)
    assert "Oversold Assets" in res
    assert "BTCUSDT" in res
    assert "25.00" in res

@patch("screener_core.execute_query")
def test_run_custom_screener(mock_exec):
    mock_exec.return_value = [
        {"name": "BINANCE:ETHUSDT", "close": 3500.0, "RSI": 28.5}
    ]
    
    # Custom query with fields and filters as JSON strings
    res = run_custom_screener(
        market="crypto",
        fields='["name", "close", "RSI"]',
        filters='[{"left": "RSI", "op": "less", "right": 30}]',
        sort_by="RSI",
        sort_order="asc",
        limit=2
    )
    
    assert "Custom Scan" in res
    assert "ETHUSDT" in res
    assert "28.50" in res

def test_run_screener_unknown_preset():
    res = run_screener("crypto", "completely_unknown_preset_val")
    assert "Error: Unknown screener preset" in res
