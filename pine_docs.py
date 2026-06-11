import sys

# Ensure UTF-8 stdout on Windows to prevent UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Comprehensive offline dictionary of key Pine Script v5/v6 functions
PINE_DOCS_DATABASE = {
    "ta.ema": {
        "syntax": "ta.ema(source, length) → series float",
        "description": "Exponential Moving Average. The EMA is a weighted moving average that gives more weight to recent prices.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values to process."},
            {"name": "length", "type": "simple int", "desc": "Number of bars (length)."}
        ],
        "example": "//@version=5\nindicator('EMA Example')\nemaVal = ta.ema(close, 14)\nplot(emaVal)"
    },
    "ta.rsi": {
        "syntax": "ta.rsi(source, length) → series float",
        "description": "Relative Strength Index. Computes the momentum oscillator that measures the speed and change of price movements.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values to process."},
            {"name": "length", "type": "simple int", "desc": "Number of bars (length)."}
        ],
        "example": "//@version=5\nindicator('RSI Example')\nrsiVal = ta.rsi(close, 14)\nplot(rsiVal)"
    },
    "ta.atr": {
        "syntax": "ta.atr(length) → series float",
        "description": "Average True Range. Returns the exponential moving average of the true range of the bars.",
        "arguments": [
            {"name": "length", "type": "simple int", "desc": "Number of bars (length)."}
        ],
        "example": "//@version=5\nindicator('ATR Example')\natrVal = ta.atr(14)\nplot(atrVal)"
    },
    "ta.macd": {
        "syntax": "ta.macd(source, fast_length, slow_length, signal_length) → [series float, series float, series float]",
        "description": "Moving Average Convergence Divergence. Returns the MACD line, the Signal line, and the Histogram line.",
        "arguments": [
            {"name": "source", "type": "series float", "desc": "Series of values to process."},
            {"name": "fast_length", "type": "simple int", "desc": "Fast EMA length."},
            {"name": "slow_length", "type": "simple int", "desc": "Slow EMA length."},
            {"name": "signal_length", "type": "simple int", "desc": "Signal line length."}
        ],
        "example": "//@version=5\nindicator('MACD Example')\n[macdLine, signalLine, histLine] = ta.macd(close, 12, 26, 9)\nplot(macdLine, color=color.blue)\nplot(signalLine, color=color.orange)"
    },
    "strategy.entry": {
        "syntax": "strategy.entry(id, direction, qty, limit, stop, oca_name, oca_type, comment, alert_message)",
        "description": "It is a command to enter market position. If a position with the same ID already exists, it is modified.",
        "arguments": [
            {"name": "id", "type": "const string", "desc": "Unique identifier for the order."},
            {"name": "direction", "type": "strategy.long/strategy.short", "desc": "Order direction."},
            {"name": "qty", "type": "series int/float", "desc": "Number of contracts/shares/lots to trade."}
        ],
        "example": "//@version=5\nstrategy('Simple Strategy', overlay=true)\nif ta.crossover(ta.sma(close, 10), ta.sma(close, 20))\n    strategy.entry('BuyCall', strategy.long)"
    },
    "strategy.close": {
        "syntax": "strategy.close(id, when, comment, qty, qty_percent, alert_message)",
        "description": "It is a command to close/exit a specific market entry order.",
        "arguments": [
            {"name": "id", "type": "const string", "desc": "The order ID to close."},
            {"name": "when", "type": "series bool", "desc": "Condition to trigger the exit."}
        ],
        "example": "//@version=5\nstrategy('Exit Example')\nstrategy.entry('Long', strategy.long)\nif close < ta.sma(close, 20)\n    strategy.close('Long')"
    }
}

def get_pine_docs(function_name: str) -> str:
    """Get offline documentation for a Pine Script v5/v6 function.
    
    Args:
        function_name: E.g. "ta.ema", "ta.rsi", "strategy.entry"
    """
    fn = function_name.strip()
    if fn not in PINE_DOCS_DATABASE:
        # Fallback suggestion
        similar = [k for k in PINE_DOCS_DATABASE.keys() if fn.split(".")[-1] in k]
        suggestion = f" Did you mean: {', '.join(similar)}?" if similar else ""
        return f"Documentation for '{fn}' not found in the offline database.{suggestion}\nAvailable functions: {', '.join(PINE_DOCS_DATABASE.keys())}"
        
    info = PINE_DOCS_DATABASE[fn]
    
    lines = [
        f"### 📘 Pine Script Docs: `{fn}`",
        "",
        f"**Syntax:** `{info['syntax']}`",
        "",
        f"**Description:** {info['description']}",
        "",
        "**Arguments:**"
    ]
    
    for arg in info["arguments"]:
        lines.append(f"- `{arg['name']}` ({arg['type']}): {arg['desc']}")
        
    lines.extend([
        "",
        "**Example:**",
        "```pinescript",
        info["example"],
        "```"
    ])
    
    return "\n".join(lines)

def validate_pine_code(code: str) -> str:
    """Analyze a block of Pine Script code for common syntax and structure issues.
    
    Args:
        code: The Pine Script source code as a string.
    """
    if not code or not code.strip():
        return "Error: Pine Script code is empty."
        
    lines = code.split("\n")
    warnings = []
    has_version = False
    version_num = 0
    is_indicator = False
    is_strategy = False
    
    for idx, line in enumerate(lines):
        clean_line = line.strip()
        
        # Check version declaration
        if "//@version=" in clean_line:
            has_version = True
            try:
                version_num = int(clean_line.split("=")[-1])
            except ValueError:
                warnings.append(f"Line {idx+1}: Malformed version declaration.")
                
        # Check indicator or strategy calls
        if "indicator(" in clean_line:
            is_indicator = True
        if "strategy(" in clean_line:
            is_strategy = True
            
        # Check obsolete functions/keywords
        if "study(" in clean_line:
            warnings.append(f"Line {idx+1}: 'study()' is obsolete. Use 'indicator()' in Pine Script v5/v6.")
        if "security(" in clean_line and not "request.security(" in clean_line:
            warnings.append(f"Line {idx+1}: Obsolete 'security()' call. Use 'request.security()' in v5/v6.")
            
        # Unmatched bracket/parenthesis check
        open_p = clean_line.count("(")
        close_p = clean_line.count(")")
        if open_p != close_p:
            warnings.append(f"Line {idx+1}: Unmatched parentheses (open: {open_p}, close: {close_p}).")
            
        open_b = clean_line.count("[")
        close_b = clean_line.count("]")
        if open_b != close_b:
            warnings.append(f"Line {idx+1}: Unmatched square brackets (open: {open_b}, close: {close_b}).")
            
    if not has_version:
        warnings.append("Warning: Missing version compiler directive. Recommend adding '//@version=5' or '//@version=6' at the top of your script.")
    elif version_num < 5:
        warnings.append(f"Warning: Script uses Pine version {version_num}. Upgrading to version 5 or 6 is highly recommended for modern features.")
        
    if not is_indicator and not is_strategy:
        warnings.append("Warning: Script lacks an entry point. Add 'indicator(...)' or 'strategy(...)' call.")
        
    if not warnings:
        return "✅ Pine Script syntax looks good! No obvious syntax errors or version issues detected."
        
    report = [
        "### 🔍 Pine Script Linter Report",
        "",
        f"Found {len(warnings)} potential issue(s):",
        ""
    ]
    for w in warnings:
        report.append(f"- {w}")
        
    return "\n".join(report)

if __name__ == "__main__":
    test_code = """
    //@version=4
    study("My Test")
    x = ta.ema(close, 14
    """
    print(validate_pine_code(test_code))
