"""
test_bridge_utils_edge_cases.py — Extended edge-case tests for bridge_utils
sanitization helpers: sanitize_key, sanitize_path, sanitize_url.
"""

import pytest
from bridge_utils import sanitize_key, sanitize_path, sanitize_url, ORACLE_DIR


# ── sanitize_key ─────────────────────────────────────────────────────────────

class TestSanitizeKey:
    def test_valid_alphanumeric(self):
        assert sanitize_key("completa") == "completa"

    def test_valid_with_underscore(self):
        assert sanitize_key("model_entry") == "model_entry"

    def test_valid_with_hyphen(self):
        assert sanitize_key("data-science") == "data-science"

    def test_valid_mixed_case(self):
        assert sanitize_key("MyIndicator_v2") == "MyIndicator_v2"

    def test_valid_numeric_only(self):
        assert sanitize_key("12345") == "12345"

    def test_strips_whitespace(self):
        assert sanitize_key("  completa  ") == "completa"

    def test_rejects_empty_string(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            sanitize_key("")

    def test_rejects_whitespace_only(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            sanitize_key("   ")

    def test_rejects_path_traversal_dots(self):
        with pytest.raises(ValueError, match="path traversal"):
            sanitize_key("../etc")

    def test_rejects_forward_slash(self):
        with pytest.raises(ValueError, match="path traversal"):
            sanitize_key("foo/bar")

    def test_rejects_backslash(self):
        with pytest.raises(ValueError, match="path traversal"):
            sanitize_key("foo\\bar")

    def test_rejects_dollar_sign(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_key("key$val")

    def test_rejects_dot(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_key("file.json")

    def test_rejects_space_in_middle(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_key("my key")

    def test_rejects_semicolon(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_key("key;drop")

    def test_rejects_unicode_characters(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_key("指标")

    def test_rejects_angle_brackets(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_key("<script>")

    def test_rejects_pipe(self):
        with pytest.raises(ValueError, match="invalid characters"):
            sanitize_key("key|value")

    def test_rejects_none(self):
        with pytest.raises((ValueError, TypeError, AttributeError)):
            sanitize_key(None)


# ── sanitize_path ────────────────────────────────────────────────────────────

class TestSanitizePath:
    def test_rejects_empty(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            sanitize_path("")

    def test_rejects_whitespace_only(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            sanitize_path("   ")

    def test_rejects_double_dot_traversal(self):
        with pytest.raises(ValueError, match="directory traversal"):
            sanitize_path("out/../../../etc/passwd")

    def test_rejects_encoded_traversal(self):
        with pytest.raises(ValueError, match="directory traversal"):
            sanitize_path("out/..\\..\\etc\\passwd")

    def test_valid_relative_path(self):
        result = sanitize_path("out/completa.json")
        assert "completa.json" in result

    def test_strips_whitespace(self):
        result = sanitize_path("  out/completa.json  ")
        assert "completa.json" in result


# ── sanitize_url ─────────────────────────────────────────────────────────────

class TestSanitizeUrl:
    def test_valid_tradingview_url(self):
        url = "https://www.tradingview.com/script/abc-MyScript/"
        assert sanitize_url(url) == url

    def test_valid_scanner_url(self):
        url = "https://scanner.tradingview.com/crypto/scan"
        assert sanitize_url(url) == url

    def test_valid_http_tradingview(self):
        url = "http://tradingview.com/chart/"
        assert sanitize_url(url) == url

    def test_rejects_empty(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            sanitize_url("")

    def test_rejects_whitespace_only(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            sanitize_url("   ")

    def test_rejects_ftp_scheme(self):
        with pytest.raises(ValueError, match="not allowed"):
            sanitize_url("ftp://www.tradingview.com")

    def test_rejects_javascript_scheme(self):
        with pytest.raises(ValueError, match="not allowed"):
            sanitize_url("javascript:alert(1)")

    def test_rejects_data_scheme(self):
        with pytest.raises(ValueError, match="not allowed"):
            sanitize_url("data:text/html,<h1>hello</h1>")

    def test_rejects_file_scheme(self):
        with pytest.raises(ValueError, match="not allowed"):
            sanitize_url("file:///etc/passwd")

    def test_rejects_non_tradingview_domain(self):
        with pytest.raises(ValueError, match="allowed list"):
            sanitize_url("https://evil.com/tradingview")

    def test_rejects_subdomain_impersonation(self):
        # tradingview.com.evil.com should NOT be allowed
        with pytest.raises(ValueError, match="allowed list"):
            sanitize_url("https://tradingview.com.evil.com/script")

    def test_rejects_no_scheme(self):
        with pytest.raises(ValueError, match="not allowed"):
            sanitize_url("www.tradingview.com")

    def test_strips_whitespace(self):
        url = "  https://www.tradingview.com/script/  "
        result = sanitize_url(url)
        assert result == url.strip()
