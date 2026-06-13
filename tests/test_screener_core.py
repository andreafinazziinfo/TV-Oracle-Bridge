"""
test_screener_core.py — Unit tests for TradingView query builder and markdown formatter.
"""

from unittest.mock import patch, MagicMock
from screener_core import build_query, execute_query, format_markdown, format_value

def test_build_query():
    fields = ["close", "RSI"]
    filters = [{"left": "RSI", "operation": "less", "right": 30}]
    
    query = build_query("crypto", fields, filters, "RSI", "asc", 10)
    
    assert query["markets"] == ["crypto"]
    assert "name" in query["columns"]  # name is prepended automatically
    assert query["filter"] == filters
    assert query["sort"] == {"sortBy": "RSI", "sortOrder": "asc"}
    assert query["range"] == [0, 10]

def test_format_value():
    assert format_value(None, "close") == "N/A"
    assert format_value(55.235, "RSI") == "55.23"
    assert format_value(-0.55, "Recommend.All") == "🔴 Strong Sell (-0.55)"
    assert format_value(1500000, "volume") == "1.50M"
    assert format_value(1.234567, "close") == "1.2346"

def test_format_markdown():
    rows = [
        {"name": "BINANCE:BTCUSDT", "close": 65000.0, "RSI": 45.5},
        {"name": "BINANCE:ETHUSDT", "close": 3500.0, "RSI": 38.2}
    ]
    cols = ["name", "close", "RSI"]
    
    md = format_markdown(rows, cols, "Test Scan")
    
    assert "### Test Scan" in md
    assert "Asset" in md
    assert "Price" in md
    assert "BTCUSDT" in md
    assert "ETHUSDT" in md

@patch("urllib.request.urlopen")
def test_execute_query_mock(mock_urlopen):
    # Mock return JSON
    mock_response = MagicMock()
    mock_response.read.return_value = b'{"data": [{"s": "BINANCE:BTCUSDT", "d": ["BINANCE:BTCUSDT", 65000.0, 45.5]}]}'
    mock_urlopen.return_value.__enter__.return_value = mock_response
    
    query = build_query("crypto", ["name", "close", "RSI"], [], "volume", "desc", 1)
    rows = execute_query("crypto", query)
    
    assert len(rows) == 1
    assert rows[0]["_ticker"] == "BINANCE:BTCUSDT"
    assert rows[0]["close"] == 65000.0
