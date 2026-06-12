"""
test_pine_docs.py — Unit tests for Pine docs search engine and syntax validator.
"""

import os
import pytest
from pine_docs import get_pine_docs, validate_pine_code

def test_get_pine_docs():
    # Valid common function
    res = get_pine_docs("ta.rsi")
    assert "ta.rsi" in res
    assert "Syntax" in res
    assert "Example" in res

    # Unknown function should suggest matches
    res_fuzzy = get_pine_docs("ta.rsj")
    assert "Did you mean:" in res_fuzzy
    assert "ta.rsi" in res_fuzzy

def test_validate_pine_code():
    # Valid script syntax
    valid_code = """//@version=5
indicator("EMA Test")
x = ta.ema(close, 14)
plot(x)
"""
    val_res = validate_pine_code(valid_code)
    assert "syntax looks good" in val_res.lower()
    assert "obvious syntax errors" in val_res

    # Obsolete v4 functions checks
    obsolete_code = """//@version=5
indicator("Obsolete Test")
x = rsi(close, 14)  // rsi instead of ta.rsi
plot(x)
"""
    obs_res = validate_pine_code(obsolete_code)
    assert "warning" in obs_res.lower()
    assert "namespace" in obs_res.lower()
