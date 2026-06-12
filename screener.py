"""
screener.py — User-facing Screener interface for TV-Oracle-Bridge.

Delegates presets to screener_presets.py and exposes arbitrary query capability
via run_custom_screener.
"""

import json
import sys
from typing import List, Dict, Any, Union
from bridge_utils import init_io
import screener_core
import screener_presets

init_io()

def run_screener(market: str = "crypto", condition: str = "top_volume", limit: int = 15) -> str:
    """Query the official TradingView scan endpoint using preset configurations.
    
    Args:
        market: E.g. "crypto", "forex", "america", "global".
        condition: E.g. "top_volume", "top_gainers", "oversold", "momentum_breakout", etc.
        limit: Max number of rows to return (default: 15).
    """
    preset_name = condition.lower()
    if preset_name not in screener_presets.PRESETS:
        return f"Error: Unknown screener preset '{condition}'. Supported presets: {', '.join(screener_presets.PRESETS.keys())}"
        
    preset = screener_presets.PRESETS[preset_name]
    fields = preset["fields"]
    filters = preset["filters"]
    sort_by = preset["sort_by"]
    sort_order = preset.get("sort_order", "desc")
    local_filter = preset.get("local_filter")
    title = f"TradingView Preset Scan ({market.upper()} - {preset['title']})"
    
    try:
        # If there's a local filter, query more rows from the API to allow filtering down to requested limit
        query_limit = limit * 4 if local_filter else limit
        if query_limit > 100:
            query_limit = 100
            
        query = screener_core.build_query(
            market=market,
            fields=fields,
            filters=filters,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=query_limit
        )
        
        rows = screener_core.execute_query(market, query)
        
        # Apply local Python filter if specified
        if local_filter:
            filtered_rows = []
            for r in rows:
                try:
                    if local_filter(r):
                        filtered_rows.append(r)
                except Exception:
                    pass
            rows = filtered_rows[:limit]
        else:
            rows = rows[:limit]
            
        return screener_core.format_markdown(rows, fields, title)
        
    except Exception as e:
        return f"Error executing scan: {str(e)}"

def run_custom_screener(
    market: str,
    fields: Union[str, List[str]],
    filters: Union[str, List[Dict[str, Any]]],
    sort_by: str,
    sort_order: str = "desc",
    limit: int = 15
) -> str:
    """Run an arbitrary custom TradingView scanner query.
    
    Args:
        market: E.g. "crypto", "forex", "america", "global".
        fields: List of fields or JSON string list (e.g. '["name", "close", "RSI"]').
        filters: List of filters or JSON string list (e.g. '[{"left": "RSI", "op": "less", "right": 30}]').
                 Filters support operators: "less", "greater", "equal", "ne", "crosses_above", "crosses_below".
        sort_by: Field to sort by (e.g. "volume").
        sort_order: "desc" or "asc".
        limit: Max rows to return.
    """
    try:
        # Parse fields if JSON string
        if isinstance(fields, str):
            try:
                fields = json.loads(fields)
            except json.JSONDecodeError:
                return f"Error parsing fields JSON: {fields}"
                
        # Parse filters if JSON string
        if isinstance(filters, str):
            try:
                filters = json.loads(filters)
            except json.JSONDecodeError:
                return f"Error parsing filters JSON: {filters}"
                
        if not isinstance(fields, list):
            return f"Error: fields must be a list. Got: {type(fields)}"
        if not isinstance(filters, list):
            return f"Error: filters must be a list. Got: {type(filters)}"
            
        # Map filter operators if they are short version (e.g. "less" -> "less", "op" -> "operation")
        normalized_filters = []
        for filt in filters:
            norm = {}
            if "left" in filt:
                norm["left"] = filt["left"]
            else:
                continue
                
            op = filt.get("operation") or filt.get("op") or "equal"
            # Map operator abbreviations
            op_map = {
                "less": "less",
                "greater": "greater",
                "equal": "equal",
                "ne": "ne",
                "crosses_above": "crosses_above",
                "crosses_below": "crosses_below",
                "<": "less",
                ">": "greater",
                "=": "equal",
                "!=": "ne"
            }
            norm["operation"] = op_map.get(op.lower(), op)
            
            if "right" in filt:
                norm["right"] = filt["right"]
            normalized_filters.append(norm)
            
        # Normalize fields to include 'name' if not present
        if "name" not in fields:
            fields_for_query = ["name"] + fields
        else:
            fields_for_query = list(fields)
            
        query = screener_core.build_query(
            market=market,
            fields=fields_for_query,
            filters=normalized_filters,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit
        )
        
        rows = screener_core.execute_query(market, query)
        
        title = f"TradingView Custom Scan ({market.upper()} - sorted by {sort_by})"
        return screener_core.format_markdown(rows, fields_for_query, title)
        
    except Exception as e:
        return f"Error executing custom scan: {str(e)}"

# Self-run for testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 2:
        mkt = sys.argv[1]
        cond = sys.argv[2]
        lim = int(sys.argv[3]) if len(sys.argv) > 3 else 15
        print(run_screener(mkt, cond, lim))
    else:
        print("Usage: python screener.py <market> <condition/preset> [limit]")
        print("Example: python screener.py crypto oversold 10")
