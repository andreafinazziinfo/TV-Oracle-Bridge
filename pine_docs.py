import sys
import json
import subprocess
from pathlib import Path
import difflib
import re

# Ensure UTF-8 stdout on Windows to prevent UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ORACLE_DIR = Path(__file__).parent.resolve()
DB_PATH = ORACLE_DIR / "pine_docs_db.json"

def bootstrap_database():
    """Run the JavaScript builder to crawl and generate the documentation DB if missing."""
    if not DB_PATH.exists():
        print("[Pine Docs] Documentation DB not found. Bootstrapping via build_pine_docs.mjs...")
        try:
            cmd = ["node", "build_pine_docs.mjs"]
            subprocess.run(cmd, cwd=str(ORACLE_DIR), check=True, capture_output=True, text=True)
            print("[Pine Docs] Bootstrapping completed successfully.")
        except Exception as e:
            print(f"[Warning] Failed to bootstrap documentation database: {e}")

# Bootstrap DB if needed
bootstrap_database()

# Load the compiled JSON database
PINE_DOCS_DATABASE = {}
if DB_PATH.exists():
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            PINE_DOCS_DATABASE = json.load(f)
    except Exception as e:
        print(f"[Warning] Failed to load documentation DB: {e}")


def get_pine_docs(function_name: str) -> str:
    """Get offline documentation for a Pine Script v5/v6 function with typo suggestions.
    
    Args:
        function_name: E.g. "ta.ema", "ta.rsi", "strategy.entry"
    """
    fn = function_name.strip()
    if fn not in PINE_DOCS_DATABASE:
        # Typo suggestion helper using difflib
        matches = difflib.get_close_matches(fn, PINE_DOCS_DATABASE.keys(), n=3, cutoff=0.5)
        suggestion = ""
        if matches:
            suggestion = f" Did you mean: {', '.join(f'`{m}`' for m in matches)}?"
        else:
            # Fallback to simple namespace check
            parts = fn.split(".")
            if len(parts) > 1:
                ns = parts[0]
                similar = [k for k in PINE_DOCS_DATABASE.keys() if k.startswith(ns)]
                if similar:
                    suggestion = f" Available functions in `{ns}.*`: {', '.join(similar[:5])}"
            
        return f"Documentation for '{fn}' not found in the offline database.{suggestion}\nAvailable functions: {', '.join(sorted(list(PINE_DOCS_DATABASE.keys())[:15]))}..."
        
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
    
    for arg in info.get("arguments", []):
        lines.append(f"- `{arg['name']}` ({arg['type']}): {arg['desc']}")
        
    lines.extend([
        "",
        "**Example:**",
        "```pinescript",
        info.get("example", ""),
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
    
    # Common language keywords to ignore when checking function definitions
    builtins_to_ignore = {
        "if", "for", "while", "switch", "var", "varip", "array", "matrix", "map", 
        "return", "int", "float", "bool", "color", "string", "line", "label", 
        "box", "table", "polyline", "iff"
    }
    
    for idx, line in enumerate(lines):
        clean_line = line.strip()
        
        # Skip comment lines
        if clean_line.startswith("//"):
            # Check version declaration
            if "//@version=" in clean_line:
                has_version = True
                try:
                    version_num = int(clean_line.split("=")[-1])
                except ValueError:
                    warnings.append(f"Line {idx+1}: Malformed version declaration.")
            continue
            
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
            
        # Advanced check: Parse function calls
        # Matches words like 'ta.ema(' or 'plot('
        matches = re.findall(r'\b([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)\s*\(', clean_line)
        for fn_call in matches:
            if fn_call in builtins_to_ignore:
                continue
                
            # If function belongs to a namespace or matches key plotting/input builtins
            is_namespaced = "." in fn_call
            is_builtin_func = fn_call in {"plot", "plotshape", "plotchar", "plotbar", "plotcandle", "hline", "fill", "alert", "alertcondition", "indicator", "strategy", "library", "input"}
            
            if is_namespaced or is_builtin_func:
                # Check directly, or with parentheses appended (since crawler registers some as ta.rsi())
                if fn_call not in PINE_DOCS_DATABASE and f"{fn_call}()" not in PINE_DOCS_DATABASE:
                    # Suggest similar names
                    similar = difflib.get_close_matches(fn_call, PINE_DOCS_DATABASE.keys(), n=2, cutoff=0.55)
                    sug_str = f". Did you mean: {', '.join(f'`{s}`' for s in similar)}?" if similar else ""
                    warnings.append(f"Line {idx+1}: Unknown or typo in function call '{fn_call}'{sug_str}")
            
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
    # Test doc lookup
    print(get_pine_docs("ta.em"))  # Should suggest ta.ema, ta.wma, etc.
    print("\n---")
    print(get_pine_docs("ta.hma"))
