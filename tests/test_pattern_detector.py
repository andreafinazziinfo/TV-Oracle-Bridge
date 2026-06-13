"""
test_pattern_detector.py — Unit tests for candlestick pattern detection (Hammer, Doji, Engulfing).
"""

from pattern_detector import analyze_ohlc_patterns, get_candlestick_annotations, _detect_patterns

def test_insufficient_data():
    assert "Insufficient OHLC data" in analyze_ohlc_patterns([])
    assert get_candlestick_annotations([]) == []

def test_doji_detection():
    # Construct 15 bars, last one is a Doji (very small body, close almost equal to open)
    bars = []
    for i in range(14):
        bars.append({"time": i, "open": 100.0, "high": 102.0, "low": 98.0, "close": 101.0, "volume": 1000})
    # Last bar has open=100, close=100.01 (Doji)
    bars.append({"time": 14, "open": 100.0, "high": 102.0, "low": 98.0, "close": 100.01, "volume": 1000})
    
    detected = _detect_patterns(bars)
    assert len(detected) >= 1
    assert any(d["pattern_type"] == "doji" for d in detected)
    
    # Test annotations format
    anns = get_candlestick_annotations(bars)
    assert len(anns) >= 1
    assert any(a["label"] == "Doji" for a in anns)

def test_engulfing_detection():
    bars = []
    for i in range(13):
        bars.append({"time": i, "open": 100.0, "high": 102.0, "low": 98.0, "close": 101.0, "volume": 1000})
        
    # Bearish bar
    bars.append({"time": 13, "open": 105.0, "high": 106.0, "low": 99.0, "close": 100.0, "volume": 1000})
    # Bullish engulfing bar (open <= 100, close >= 105, body larger)
    bars.append({"time": 14, "open": 99.5, "high": 107.0, "low": 98.0, "close": 106.0, "volume": 1000})
    
    detected = _detect_patterns(bars)
    assert any(d["pattern_type"] == "bullish_engulfing" for d in detected)
