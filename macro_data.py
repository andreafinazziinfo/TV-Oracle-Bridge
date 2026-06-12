"""
macro_data.py — Macroeconomic Calendar and Real-Time News Feed Extractor.
Fetches economic events and news headlines for AI model consumption.
"""

import urllib.request
import json
import xml.etree.ElementTree as ET
import datetime
from typing import List, Dict, Any
from bridge_utils import init_io

# Ensure UTF-8 stdout on Windows
init_io()

def clean_ticker_for_yahoo(ticker: str) -> str:
    ticker = ticker.upper().strip()
    if ":" in ticker:
        parts = ticker.split(":")
        ticker = parts[1]
    
    # Common crypto symbols
    if ticker.endswith("USDT") or ticker.endswith("USD"):
        base = ticker.replace("USDT", "").replace("USD", "")
        # If it seems like a coin
        if len(base) >= 2 and len(base) <= 5:
            return f"{base}-USD"
            
    # Forex pairs
    if len(ticker) == 6 and any(ticker.startswith(p) for p in ["EUR", "GBP", "USD", "JPY", "AUD", "CAD", "CHF", "NZD"]):
        return f"{ticker}=X"
        
    return ticker

def get_economic_calendar(days_ahead: int = 7, countries: str = None) -> List[Dict[str, Any]]:
    """Fetch the TradingView economic calendar events."""
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        from_str = now.strftime("%Y-%m-%dT00:00:00.000Z")
        to_str = (now + datetime.timedelta(days=days_ahead)).strftime("%Y-%m-%dT23:59:59.999Z")
        
        url = f"https://economic-calendar.tradingview.com/events?from={from_str}&to={to_str}"
        if countries:
            # clean countries string e.g. "US, EU" -> "US,EU"
            countries_cleaned = ",".join([c.strip().upper() for c in countries.split(",") if c.strip()])
            url += f"&countries={countries_cleaned}"
            
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://www.tradingview.com',
            'Referer': 'https://www.tradingview.com/'
        })
        
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get("status") == "ok":
                return data.get("result", [])
    except Exception as e:
        print(f"[Error] Failed to fetch economic calendar: {e}")
    return []

def format_calendar_markdown(events: List[Dict[str, Any]]) -> str:
    """Format economic calendar events as a readable markdown table."""
    if not events:
        return "No upcoming economic events found for the specified criteria."
        
    # Sort events by date
    events_sorted = sorted(events, key=lambda x: x.get("date", ""))
    
    lines = [
        "### Upcoming Economic Calendar Events",
        "",
        "| Time (UTC) | Country | Event Title | Importance | Previous | Forecast | Actual |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
    ]
    
    importance_map = {
        -1: "⚪ Low",
        0: "🟡 Medium",
        1: "🔴 High"
    }
    
    for ev in events_sorted:
        date_str = ev.get("date", "")
        # Clean timestamp to readable UTC format
        try:
            dt = datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            time_formatted = dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            time_formatted = date_str
            
        country = ev.get("country", "Global")
        title = ev.get("title", "Unknown Event")
        imp_val = ev.get("importance", -1)
        importance = importance_map.get(imp_val, "⚪ Low")
        
        prev = ev.get("previous", "-")
        fore = ev.get("forecast", "-")
        act = ev.get("actual", "-")
        
        # Format None values
        prev_str = f"{prev}{ev.get('unit', '')}" if prev is not None else "-"
        fore_str = f"{fore}{ev.get('unit', '')}" if fore is not None else "-"
        act_str = f"{act}{ev.get('unit', '')}" if act is not None else "-"
        
        lines.append(f"| {time_formatted} | **{country}** | {title} | {importance} | {prev_str} | {fore_str} | {act_str} |")
        
    return "\n".join(lines)

def get_symbol_news(symbol: str, limit: int = 5) -> List[Dict[str, str]]:
    """Fetch symbol news headlines via Yahoo Finance RSS feed."""
    yahoo_symbol = clean_ticker_for_yahoo(symbol)
    url = f"http://feeds.finance.yahoo.com/rss/2.0/headline?s={yahoo_symbol}&region=US&lang=en-US"
    
    news = []
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            root = ET.fromstring(xml_data)
            
            for item in root.findall('.//item')[:limit]:
                title = item.find('title').text if item.find('title') is not None else "No Title"
                link = item.find('link').text if item.find('link') is not None else "#"
                pub_date = item.find('pubDate').text if item.find('pubDate') is not None else "-"
                desc = item.find('description').text if item.find('description') is not None else ""
                
                news.append({
                    "title": title,
                    "link": link,
                    "pubDate": pub_date,
                    "description": desc
                })
    except Exception as e:
        print(f"[Error] Failed to fetch news for {symbol} ({yahoo_symbol}): {e}")
        
    return news

def format_news_markdown(symbol: str, news: List[Dict[str, str]]) -> str:
    """Format news headlines as readable markdown."""
    yahoo_symbol = clean_ticker_for_yahoo(symbol)
    if not news:
        return f"No news headlines found for symbol '{symbol}' (mapped to Yahoo: '{yahoo_symbol}')."
        
    lines = [
        f"### Latest News Headlines for {symbol} (Yahoo Ticker: {yahoo_symbol})",
        ""
    ]
    
    for i, item in enumerate(news, 1):
        lines.append(f"{i}. **[{item['title']}]({item['link']})**")
        lines.append(f"   *Published: {item['pubDate']}*")
        if item['description']:
            # Strip HTML tags from description if present
            clean_desc = item['description'].replace("<p>", "").replace("</p>", "").strip()
            # truncate description if too long
            if len(clean_desc) > 200:
                clean_desc = clean_desc[:200] + "..."
            lines.append(f"   _{clean_desc}_")
        lines.append("")
        
    return "\n".join(lines)

if __name__ == "__main__":
    # Test economic calendar
    print(format_calendar_markdown(get_economic_calendar(2, "US,EU")))
    print("\n" + "="*50 + "\n")
    # Test news
    print(format_news_markdown("BINANCE:BTCUSDT", get_symbol_news("BINANCE:BTCUSDT", 3)))
