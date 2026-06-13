"""
test_bridge_utils.py — Unit tests for centralized bridge utilities.
"""

import pytest
from bridge_utils import sanitize_path, sanitize_url, init_io

def test_sanitize_path():
    # Valid paths should remain unchanged or resolve cleanly
    path_res = sanitize_path("out/completa.json").replace('\\', '/')
    assert "out/completa.json" in path_res
    
    # Path traversal and injection attempts should raise ValueError
    with pytest.raises(ValueError, match="directory traversal"):
        sanitize_path("out/../../.env")
        
    with pytest.raises(ValueError, match="directory traversal|outside project directory"):
        sanitize_path("/etc/passwd")

def test_sanitize_url():
    # Valid TradingView URLs
    valid_url = "https://www.tradingview.com/script/v995o65g-Squeeze-Momentum-Indicator-LazyBear/"
    assert sanitize_url(valid_url) == valid_url
    
    # Invalid URLs
    with pytest.raises(ValueError, match="not allowed"):
        sanitize_url("ftp://malicious-site.com")
        
    with pytest.raises(ValueError, match="allowed list"):
        sanitize_url("https://malicious-site.com/script")

def test_init_io():
    # Should run without error
    init_io()
