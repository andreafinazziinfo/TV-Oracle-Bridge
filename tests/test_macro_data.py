"""
test_macro_data.py — Unit tests for macroeconomic calendar and Yahoo News RSS feed extraction.
"""
import pytest
from unittest.mock import patch, MagicMock
from macro_data import (
    clean_ticker_for_yahoo,
    get_economic_calendar,
    format_calendar_markdown,
    get_symbol_news,
    format_news_markdown,
)

def test_clean_ticker_for_yahoo():
    # Crypto tickers
    assert clean_ticker_for_yahoo("BINANCE:BTCUSDT") == "BTC-USD"
    assert clean_ticker_for_yahoo("BTCUSD") == "BTC-USD"
    assert clean_ticker_for_yahoo("ETHUSD") == "ETH-USD"
    
    # Forex tickers (Note: USD-ending pairs match the crypto USD suffix block, returning EUR-USD, while others go to =X)
    assert clean_ticker_for_yahoo("FX:EURUSD") == "EUR-USD"
    assert clean_ticker_for_yahoo("EURUSD") == "EUR-USD"
    assert clean_ticker_for_yahoo("FX:EURGBP") == "EURGBP=X"
    assert clean_ticker_for_yahoo("EURGBP") == "EURGBP=X"
    
    # Stock tickers
    assert clean_ticker_for_yahoo("NASDAQ:AAPL") == "AAPL"
    assert clean_ticker_for_yahoo("AAPL") == "AAPL"

@patch("urllib.request.urlopen")
def test_get_economic_calendar_success(mock_urlopen):
    # Mock response
    mock_response = MagicMock()
    mock_response.read.return_value = b'{"status": "ok", "result": [{"date": "2026-06-12T10:00:00Z", "country": "US", "title": "Fed Interest Rate Decision", "importance": 1, "previous": 5.25, "forecast": 5.25, "actual": 5.25, "unit": "%"}]}'
    mock_urlopen.return_value.__enter__.return_value = mock_response
    
    events = get_economic_calendar(7, "US, EU")
    assert len(events) == 1
    assert events[0]["title"] == "Fed Interest Rate Decision"
    assert events[0]["country"] == "US"

@patch("urllib.request.urlopen")
def test_get_economic_calendar_error(mock_urlopen):
    # Mock connection error
    mock_urlopen.side_effect = Exception("Connection Timeout")
    events = get_economic_calendar(7)
    assert events == []

def test_format_calendar_markdown():
    # Empty calendar
    assert "No upcoming economic events" in format_calendar_markdown([])
    
    events = [{
        "date": "2026-06-12T10:00:00Z",
        "country": "US",
        "title": "NFP",
        "importance": 1,
        "previous": 150000,
        "forecast": 175000,
        "actual": 200000,
        "unit": ""
    }]
    
    md = format_calendar_markdown(events)
    assert "### Upcoming Economic Calendar Events" in md
    assert "NFP" in md
    assert "🔴 High" in md
    assert "200000" in md

@patch("urllib.request.urlopen")
def test_get_symbol_news_success(mock_urlopen):
    # Mock Yahoo RSS XML
    xml_data = b"""<?xml version="1.0" encoding="utf-8"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Bitcoin hits new high</title>
          <link>https://finance.yahoo.com/news/btc-high</link>
          <pubDate>Fri, 12 Jun 2026 10:00:00 GMT</pubDate>
          <description>&lt;p&gt;Bitcoin reached a new record price today.&lt;/p&gt;</description>
        </item>
      </channel>
    </rss>
    """
    mock_response = MagicMock()
    mock_response.read.return_value = xml_data
    mock_urlopen.return_value.__enter__.return_value = mock_response
    
    news = get_symbol_news("BINANCE:BTCUSDT", 1)
    assert len(news) == 1
    assert news[0]["title"] == "Bitcoin hits new high"
    assert "btc-high" in news[0]["link"]
    assert "Bitcoin reached a new record" in news[0]["description"]

@patch("urllib.request.urlopen")
def test_get_symbol_news_error(mock_urlopen):
    mock_urlopen.side_effect = Exception("HTTP 500 Internal Error")
    news = get_symbol_news("AAPL")
    assert news == []

def test_format_news_markdown():
    # Empty news
    assert "No news headlines found" in format_news_markdown("AAPL", [])
    
    news = [{
        "title": "Apple launches new device",
        "link": "https://finance.yahoo.com/news/apple-device",
        "pubDate": "Fri, 12 Jun 2026 12:00:00 GMT",
        "description": "Apple announced their latest hardware line today."
    }]
    
    md = format_news_markdown("AAPL", news)
    assert "Latest News Headlines for AAPL" in md
    assert "apple-device" in md
    assert "Apple announced their latest" in md
