"""
test_mcp_server.py — Integration smoke tests to verify FastMCP tool registrations.
"""

from mcp_server import mcp

def test_mcp_tools_registration():
    # Enumerate all registered tools in the FastMCP instance
    tools = list(mcp._tool_manager._tools.values())
    assert len(tools) > 0
    
    # Check that core tools are present
    tool_names = [t.name for t in tools]
    
    assert "fetch_indicator" in tool_names
    assert "list_indicators" in tool_names
    assert "capture_screenshot" in tool_names
    assert "run_screener" in tool_names
    assert "run_custom_screener" in tool_names
    assert "get_run_history" in tool_names
    assert "detect_patterns" in tool_names
    assert "get_pine_docs" in tool_names
    assert "validate_pine_code" in tool_names
    assert "transpile_pine_script" in tool_names
    assert "download_public_script" in tool_names
    assert "control_chart_macro" in tool_names
    assert "send_notification" in tool_names

def test_screener_tool_arguments():
    tools = list(mcp._tool_manager._tools.values())
    screener_tool = next(t for t in tools if t.name == "run_custom_screener")
    
    # Check tool arguments mapping
    args = screener_tool.parameters.get("properties", {})
    assert "market" in args
    assert "fields_json" in args
    assert "filters_json" in args
