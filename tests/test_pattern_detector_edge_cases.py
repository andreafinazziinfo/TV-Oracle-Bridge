"""
test_pattern_detector_edge_cases.py — Extended edge-case tests for candlestick
pattern detection covering all pattern types and boundary conditions.
"""

from pattern_detector import (
    analyze_ohlc_patterns,
    get_candlestick_annotations,
    _detect_patterns,
    detect_from_oracle_file,
)


class TestInsufficientData:
    def test_none_input(self):
        assert "Insufficient" in analyze_ohlc_patterns(None)

    def test_empty_list(self):
        assert "Insufficient" in analyze_ohlc_patterns([])
        assert _detect_patterns([]) == []

    def test_single_bar(self):
        bars = [{"time": 1, "open": 100, "high": 102, "low": 98, "close": 101}]
        assert "Insufficient" in analyze_ohlc_patterns(bars)
        assert _detect_patterns(bars) == []

    def test_two_bars(self):
        bars = [
            {"time": 1, "open": 100, "high": 102, "low": 98, "close": 101},
            {"time": 2, "open": 101, "high": 103, "low": 99, "close": 102},
        ]
        assert "Insufficient" in analyze_ohlc_patterns(bars)

    def test_exactly_three_bars_minimum(self):
        bars = [
            {"time": 1, "open": 100, "high": 102, "low": 98, "close": 101},
            {"time": 2, "open": 101, "high": 103, "low": 99, "close": 102},
            {"time": 3, "open": 102, "high": 104, "low": 100, "close": 103},
        ]
        # Should not raise, should return some result (even if "No clear patterns")
        result = analyze_ohlc_patterns(bars)
        assert isinstance(result, str)
        assert "Insufficient" not in result


class TestZeroRangeCandle:
    """Candles where high == low (zero range) should be skipped without errors."""

    def test_zero_range_skipped(self):
        bars = []
        for i in range(14):
            bars.append({"time": i, "open": 100, "high": 102, "low": 98, "close": 101})
        # Last bar: zero range (high == low), should be skipped safely
        bars.append({"time": 14, "open": 100, "high": 100, "low": 100, "close": 100})
        detected = _detect_patterns(bars)
        # Verify the zero-range bar wasn't detected as any pattern
        zero_range_patterns = [d for d in detected if d["time"] == 14]
        assert len(zero_range_patterns) == 0


class TestHammerPattern:
    def test_bullish_hammer(self):
        """Small body at top, long lower shadow, almost no upper shadow."""
        bars = []
        for i in range(14):
            bars.append({"time": i, "open": 100, "high": 102, "low": 98, "close": 101})
        # Hammer: body at top, long lower shadow
        # body = |102 - 101| = 1, lower_shadow = 101 - 95 = 6, upper_shadow = 103 - 102 = 1
        # body_pct = 1 / (103-95) = 0.125 (between 0.10 and 0.40)
        # lower_shadow (6) > 2*body (2): YES
        # upper_shadow (1) < 0.2*body (0.2): NO -> fails
        # Let's adjust for stricter requirements:
        # body = |100.5 - 100| = 0.5, range = 103 - 97 = 6, body_pct = 0.083 -> doji (<0.10)
        # Need body_pct > 0.10 and < 0.40, lower > 2*body, upper < 0.2*body
        # body=1.0, range=8, body_pct=0.125
        # lower_shadow = min(open,close) - low = 100 - 93 = 7 > 2*1 = 2 ✓
        # upper_shadow = high - max(open,close) = 101.1 - 101 = 0.1 < 0.2*1 = 0.2 ✓
        bars.append({
            "time": 14, "open": 100.0, "high": 101.1, "low": 93.0, "close": 101.0
        })
        detected = _detect_patterns(bars)
        hammer_found = [d for d in detected if d["pattern_type"] == "hammer"]
        assert len(hammer_found) >= 1
        assert hammer_found[0]["label"] == "Hammer"

    def test_hanging_man(self):
        """Same shape as hammer but bearish (close < open)."""
        bars = []
        for i in range(14):
            bars.append({"time": i, "open": 100, "high": 102, "low": 98, "close": 101})
        # Bearish: close < open
        # body = |101 - 100| = 1, lower_shadow = 100 - 93 = 7 > 2, upper_shadow = 101.1 - 101 = 0.1 < 0.2
        bars.append({
            "time": 14, "open": 101.0, "high": 101.1, "low": 93.0, "close": 100.0
        })
        detected = _detect_patterns(bars)
        hammer_found = [d for d in detected if d["pattern_type"] == "hammer"]
        assert len(hammer_found) >= 1
        assert hammer_found[0]["label"] == "Hanging Man"


class TestShootingStarPattern:
    def test_shooting_star_bearish(self):
        """Small body at bottom, long upper shadow, almost no lower shadow."""
        bars = []
        for i in range(14):
            bars.append({"time": i, "open": 100, "high": 102, "low": 98, "close": 101})
        # Shooting star: body at bottom, long upper shadow
        # body = |100 - 101| = 1, upper_shadow = 108 - 101 = 7 > 2
        # lower_shadow = 100 - 99.9 = 0.1 < 0.2
        bars.append({
            "time": 14, "open": 101.0, "high": 108.0, "low": 99.9, "close": 100.0
        })
        detected = _detect_patterns(bars)
        ss_found = [d for d in detected if d["pattern_type"] == "shooting_star"]
        assert len(ss_found) >= 1
        assert ss_found[0]["label"] == "Shooting Star"

    def test_inverted_hammer(self):
        """Same shape as shooting star but bullish."""
        bars = []
        for i in range(14):
            bars.append({"time": i, "open": 100, "high": 102, "low": 98, "close": 101})
        # Bullish: close > open
        bars.append({
            "time": 14, "open": 100.0, "high": 108.0, "low": 99.9, "close": 101.0
        })
        detected = _detect_patterns(bars)
        ss_found = [d for d in detected if d["pattern_type"] == "shooting_star"]
        assert len(ss_found) >= 1
        assert ss_found[0]["label"] == "Inverted Hammer"


class TestEngulfingPatterns:
    def test_bullish_engulfing(self):
        bars = []
        for i in range(13):
            bars.append({"time": i, "open": 100, "high": 102, "low": 98, "close": 101})
        # Bearish prev: open > close
        bars.append({"time": 13, "open": 105.0, "high": 106.0, "low": 99.0, "close": 100.0})
        # Bullish engulfing: open <= prev_close, close >= prev_open, body > prev_body
        bars.append({"time": 14, "open": 99.5, "high": 107.0, "low": 98.0, "close": 106.0})
        detected = _detect_patterns(bars)
        assert any(d["pattern_type"] == "bullish_engulfing" for d in detected)

    def test_bearish_engulfing(self):
        bars = []
        for i in range(13):
            bars.append({"time": i, "open": 100, "high": 102, "low": 98, "close": 101})
        # Bullish prev: close > open
        bars.append({"time": 13, "open": 100.0, "high": 106.0, "low": 99.0, "close": 105.0})
        # Bearish engulfing: open >= prev_close, close <= prev_open, body > prev_body
        bars.append({"time": 14, "open": 106.0, "high": 107.0, "low": 98.0, "close": 99.0})
        detected = _detect_patterns(bars)
        assert any(d["pattern_type"] == "bearish_engulfing" for d in detected)


class TestNoPatterns:
    def test_flat_bars_no_patterns(self):
        """All bars identical except for a small body — only doji should be detected."""
        bars = []
        for i in range(15):
            bars.append({"time": i, "open": 100.0, "high": 102.0, "low": 98.0, "close": 100.01})
        detected = _detect_patterns(bars)
        # All have body_pct < 0.10, so all should be doji
        for d in detected:
            assert d["pattern_type"] == "doji"


class TestAnnotationsFormat:
    def test_annotation_keys(self):
        bars = []
        for i in range(14):
            bars.append({"time": i, "open": 100, "high": 102, "low": 98, "close": 101})
        bars.append({"time": 14, "open": 100, "high": 102, "low": 98, "close": 100.01})
        
        anns = get_candlestick_annotations(bars)
        assert len(anns) >= 1
        for a in anns:
            assert "barIndexFromRight" in a
            assert "color" in a
            assert "borderColor" in a
            assert "label" in a
            assert isinstance(a["barIndexFromRight"], int)


class TestMarkdownReport:
    def test_report_has_table_headers(self):
        bars = []
        for i in range(14):
            bars.append({"time": i, "open": 100, "high": 102, "low": 98, "close": 101})
        bars.append({"time": 14, "open": 100, "high": 102, "low": 98, "close": 100.01})
        
        result = analyze_ohlc_patterns(bars)
        assert "### Candlestick Pattern Report" in result
        assert "| Time (Raw) |" in result
        assert "Doji" in result


class TestDetectFromFile:
    def test_nonexistent_file(self):
        result = detect_from_oracle_file("/nonexistent/path/file.json")
        assert "not found" in result.lower()

    def test_missing_chart_ohlc_key(self, tmp_path):
        """File exists but has no chartOhlc key."""
        import json
        test_file = tmp_path / "empty_oracle.json"
        test_file.write_text(json.dumps({"meta": {}, "periods": []}))
        result = detect_from_oracle_file(str(test_file))
        assert "No 'chartOhlc' data found" in result

    def test_valid_oracle_file_with_patterns(self, tmp_path):
        """File with valid chartOhlc containing a doji."""
        import json
        bars = []
        for i in range(15):
            bars.append({"time": i, "open": 100.0, "high": 102.0, "low": 98.0, "close": 100.01})
        test_file = tmp_path / "test_oracle.json"
        test_file.write_text(json.dumps({"chartOhlc": bars}))
        result = detect_from_oracle_file(str(test_file))
        assert "Doji" in result
