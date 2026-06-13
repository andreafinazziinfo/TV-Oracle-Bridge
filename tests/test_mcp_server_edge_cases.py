"""
test_mcp_server_edge_cases.py — Unit tests for FastMCP tools implementation.
"""
import json
import subprocess
from unittest.mock import patch, MagicMock

# Import tool functions directly from mcp_server
from mcp_server import (
    fetch_indicator,
    get_run_history,
    list_indicators,
    capture_screenshot,
    refresh_session_credentials,
    run_screener,
    run_custom_screener,
    detect_patterns,
    get_pine_docs,
    validate_pine_code,
    transpile_pine_script,
    download_public_script,
    control_chart_macro,
    get_structured_market_data,
    send_notification,
    get_economic_calendar,
    get_market_news,
)

@patch("mcp_server.subprocess.run")
@patch("mcp_server.get_last_cached_timestamp")
@patch("mcp_server.merge_and_update_cache")
@patch("tv_cache.record_run")
def test_fetch_indicator_success(mock_record_run, mock_merge, mock_get_last_cached_timestamp, mock_run, tmp_path):
    mock_get_last_cached_timestamp.return_value = 0
    
    # Mock subprocess success
    mock_res = MagicMock()
    mock_res.stdout = "Subprocess success"
    mock_res.stderr = ""
    mock_run.return_value = mock_res
    
    # Patch ORACLE_DIR or wrap the file opening
    with patch("mcp_server.ORACLE_DIR", tmp_path):
        tmp_out_dir = tmp_path / "out"
        tmp_out_dir.mkdir(parents=True, exist_ok=True)
        tmp_out_file = tmp_out_dir / "completa.json"
        with open(tmp_out_file, "w", encoding="utf-8") as f:
            json.dump({"test": "data"}, f)
            
        mock_merge.return_value = {"periodsCount": 100, "meta": "mock_meta"}
        
        res = fetch_indicator("completa", 5000, 20000)
        assert "mock_meta" in res
        assert mock_record_run.called
        assert mock_merge.called

# Subprocess error
@patch("mcp_server.subprocess.run")
@patch("mcp_server.get_last_cached_timestamp")
@patch("tv_cache.record_run")
def test_fetch_indicator_subprocess_error(mock_record_run, mock_get_last_cached_timestamp, mock_run):
    mock_get_last_cached_timestamp.return_value = 0
    mock_run.side_effect = subprocess.CalledProcessError(1, "node", stderr="Subprocess Failed")
    
    res = fetch_indicator("completa", 5000, 20000)
    assert "Error running fetchIndicator" in res
    assert "Subprocess Failed" in res
    assert mock_record_run.called

@patch("tv_cache.get_run_history")
def test_get_run_history_tool(mock_fetch):
    mock_fetch.return_value = [{"status": "success"}]
    res = get_run_history("completa", 10)
    assert "success" in res
    mock_fetch.assert_called_with("completa", 10)

@patch("mcp_server.subprocess.run")
def test_list_indicators_success(mock_run):
    mock_res = MagicMock()
    mock_res.stdout = "Indicator list output"
    mock_run.return_value = mock_res
    
    res = list_indicators()
    assert "Indicator list output" in res

@patch("mcp_server.subprocess.run")
@patch("mcp_server.get_cached_bars")
@patch("mcp_server.get_candlestick_annotations")
def test_capture_screenshot_success(mock_ann, mock_get_bars, mock_run, tmp_path):
    mock_get_bars.return_value = ([], [])
    mock_res = MagicMock()
    mock_res.stdout = 'Done! Path: {"filename": "mcp_capture.png"}'
    mock_run.return_value = mock_res
    
    with patch("mcp_server.ORACLE_DIR", tmp_path):
        tmp_screenshots_dir = tmp_path / "out" / "screenshots"
        tmp_screenshots_dir.mkdir(parents=True, exist_ok=True)
        screenshot_file = tmp_screenshots_dir / "mcp_capture.png"
        screenshot_file.write_text("fake_png")
        
        res = capture_screenshot("BTCUSD", "60", "mcp_capture.png")
        assert "success" in res
        assert "mcp_capture.png" in res

@patch("mcp_server.subprocess.run")
def test_refresh_session_credentials_win32(mock_run):
    with patch("mcp_server.sys.platform", "win32"):
        mock_run.return_value = MagicMock()
        res = refresh_session_credentials()
        assert "Success: Session refresher finished" in res
        
    with patch("mcp_server.sys.platform", "linux"):
        mock_res = MagicMock()
        mock_res.stdout = "Linux complete"
        mock_run.return_value = mock_res
        res = refresh_session_credentials()
        assert "Linux complete" in res

@patch("mcp_server.exec_screener")
def test_run_screener_tool(mock_exec):
    mock_exec.return_value = "Screener results"
    res = run_screener("crypto", "oversold", 5)
    assert res == "Screener results"
    mock_exec.assert_called_with("crypto", "oversold", 5)

@patch("screener.run_custom_screener")
def test_run_custom_screener_tool(mock_exec):
    mock_exec.return_value = "Custom results"
    res = run_custom_screener("crypto", "[]", "[]", "volume")
    assert res == "Custom results"
    mock_exec.assert_called_with("crypto", "[]", "[]", "volume", "desc", 15)

@patch("mcp_server.detect_from_oracle_file")
def test_detect_patterns_tool(mock_detect, tmp_path):
    mock_detect.return_value = "Patterns: Doji"
    with patch("mcp_server.ORACLE_DIR", tmp_path):
        res = detect_patterns("completa")
        assert res == "Patterns: Doji"
        expected_path = str(tmp_path / "out" / "completa.json")
        mock_detect.assert_called_with(expected_path)

@patch("mcp_server.fetch_pine_docs")
def test_get_pine_docs_tool(mock_fetch):
    mock_fetch.return_value = "ta.ema docs"
    res = get_pine_docs("ta.ema")
    assert res == "ta.ema docs"
    mock_fetch.assert_called_with("ta.ema")

@patch("mcp_server.check_pine_syntax")
def test_validate_pine_code_tool(mock_check):
    mock_check.return_value = "Syntax OK"
    res = validate_pine_code("//@version=5")
    assert res == "Syntax OK"
    mock_check.assert_called_with("//@version=5")

@patch("mcp_server.subprocess.run")
def test_transpile_pine_script_tool(mock_run):
    mock_res = MagicMock()
    mock_res.stdout = "Transpiled JS code"
    mock_run.return_value = mock_res
    res = transpile_pine_script("test.pine")
    assert "Transpiled JS code" in res

@patch("mcp_server.subprocess.run")
def test_download_public_script_tool(mock_run, tmp_path):
    mock_res = MagicMock()
    mock_res.stdout = "Download OK"
    mock_run.return_value = mock_res
    
    with patch("mcp_server.ORACLE_DIR", tmp_path):
        res = download_public_script("https://tradingview.com/script/xyz/", "my.pine")
        assert "Success: Script downloaded successfully" in res

@patch("mcp_server.subprocess.run")
def test_control_chart_macro_tool(mock_run):
    mock_res = MagicMock()
    mock_res.stdout = "Macro executed"
    mock_run.return_value = mock_res
    res = control_chart_macro("save")
    assert "Success: Chart macro executed" in res

@patch("mcp_server.subprocess.run")
def test_get_structured_market_data_tool(mock_run):
    res_err = get_structured_market_data("invalid_type")
    assert "Error: Invalid type_val" in res_err
    
    mock_res = MagicMock()
    mock_res.stdout = "Options data"
    mock_run.return_value = mock_res
    res = get_structured_market_data("options", "AAPL")
    assert res == "Options data"

@patch("mcp_server.dispatch_notification")
def test_send_notification_tool(mock_dispatch):
    mock_dispatch.return_value = "Sent successfully"
    res = send_notification("hello", "file.png")
    assert res == "Sent successfully"
    mock_dispatch.assert_called_with("hello", "file.png")

@patch("mcp_server.fetch_calendar_data")
@patch("mcp_server.format_calendar_markdown")
def test_get_economic_calendar_tool(mock_format, mock_fetch):
    mock_fetch.return_value = ["event"]
    mock_format.return_value = "Markdown Calendar"
    res = get_economic_calendar(5, "US")
    assert res == "Markdown Calendar"
    mock_fetch.assert_called_with(5, "US")
    mock_format.assert_called_with(["event"])

@patch("mcp_server.fetch_news_data")
@patch("mcp_server.format_news_markdown")
def test_get_market_news_tool(mock_format, mock_fetch):
    mock_fetch.return_value = ["news"]
    mock_format.return_value = "Markdown News"
    res = get_market_news("AAPL", 5)
    assert res == "Markdown News"
    mock_fetch.assert_called_with("AAPL", 5)
    mock_format.assert_called_with("AAPL", ["news"])
