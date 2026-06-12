#!/usr/bin/env python3
import sys
import json
import ctypes
import argparse
from pathlib import Path

# --- ctypes mirrors of PineForge C structures ---

class BarC(ctypes.Structure):
    _fields_ = [
        ("open", ctypes.c_double),
        ("high", ctypes.c_double),
        ("low", ctypes.c_double),
        ("close", ctypes.c_double),
        ("volume", ctypes.c_double),
        ("timestamp", ctypes.c_int64),
    ]

class TradeC(ctypes.Structure):
    _fields_ = [
        ("entry_time", ctypes.c_int64),
        ("exit_time", ctypes.c_int64),
        ("entry_price", ctypes.c_double),
        ("exit_price", ctypes.c_double),
        ("pnl", ctypes.c_double),
        ("pnl_pct", ctypes.c_double),
        ("is_long", ctypes.c_int),
        ("max_runup", ctypes.c_double),
        ("max_drawdown", ctypes.c_double),
        ("qty", ctypes.c_double),
        ("commission", ctypes.c_double),
        ("entry_bar_index", ctypes.c_int32),
        ("exit_bar_index", ctypes.c_int32),
    ]

class TradeStatsC(ctypes.Structure):
    _fields_ = [
        ("num_trades", ctypes.c_int32),
        ("num_wins", ctypes.c_int32),
        ("num_losses", ctypes.c_int32),
        ("num_even", ctypes.c_int32),
        ("percent_profitable", ctypes.c_double),
        ("net_profit", ctypes.c_double),
        ("net_profit_pct", ctypes.c_double),
        ("gross_profit", ctypes.c_double),
        ("gross_profit_pct", ctypes.c_double),
        ("gross_loss", ctypes.c_double),
        ("gross_loss_pct", ctypes.c_double),
        ("profit_factor", ctypes.c_double),
        ("avg_trade", ctypes.c_double),
        ("avg_trade_pct", ctypes.c_double),
        ("avg_win", ctypes.c_double),
        ("avg_win_pct", ctypes.c_double),
        ("avg_loss", ctypes.c_double),
        ("avg_loss_pct", ctypes.c_double),
        ("ratio_avg_win_avg_loss", ctypes.c_double),
        ("largest_win", ctypes.c_double),
        ("largest_win_pct", ctypes.c_double),
        ("largest_loss", ctypes.c_double),
        ("largest_loss_pct", ctypes.c_double),
        ("commission_paid", ctypes.c_double),
        ("expectancy", ctypes.c_double),
        ("max_consecutive_wins", ctypes.c_int32),
        ("max_consecutive_losses", ctypes.c_int32),
        ("avg_bars_in_trade", ctypes.c_double),
        ("avg_bars_in_wins", ctypes.c_double),
        ("avg_bars_in_losses", ctypes.c_double),
    ]

class EquityStatsC(ctypes.Structure):
    _fields_ = [
        ("max_equity_drawdown", ctypes.c_double),
        ("max_equity_drawdown_pct", ctypes.c_double),
        ("max_equity_runup", ctypes.c_double),
        ("max_equity_runup_pct", ctypes.c_double),
        ("buy_hold_return", ctypes.c_double),
        ("buy_hold_return_pct", ctypes.c_double),
        ("sharpe_tv", ctypes.c_double),
        ("sortino_tv", ctypes.c_double),
        ("sharpe_bar", ctypes.c_double),
        ("sortino_bar", ctypes.c_double),
        ("cagr", ctypes.c_double),
        ("calmar", ctypes.c_double),
        ("recovery_factor", ctypes.c_double),
        ("time_in_market_pct", ctypes.c_double),
        ("open_pl", ctypes.c_double),
    ]

class MetricsC(ctypes.Structure):
    _fields_ = [
        ("all", TradeStatsC),
        ("longs", TradeStatsC),
        ("shorts", TradeStatsC),
        ("equity", EquityStatsC)
    ]

class EquityPointC(ctypes.Structure):
    _fields_ = [
        ("time_ms", ctypes.c_int64),
        ("equity", ctypes.c_double),
        ("open_profit", ctypes.c_double)
    ]

class SecurityDiagC(ctypes.Structure):
    _fields_ = [
        ("sec_id", ctypes.c_int),
        ("feed_count", ctypes.c_int64),
        ("eval_complete_count", ctypes.c_int64),
        ("eval_partial_count", ctypes.c_int64),
    ]

class TraceEntryC(ctypes.Structure):
    _fields_ = [
        ("timestamp", ctypes.c_int64),
        ("bar_index", ctypes.c_int32),
        ("name_id", ctypes.c_int32),
        ("value", ctypes.c_double),
    ]

class ReportC(ctypes.Structure):
    _fields_ = [
        ("total_trades", ctypes.c_int),
        ("trades", ctypes.POINTER(TradeC)),
        ("trades_len", ctypes.c_int),
        ("net_profit", ctypes.c_double),
        ("input_bars_processed", ctypes.c_int64),
        ("script_bars_processed", ctypes.c_int64),
        ("security_feeds_total", ctypes.c_int64),
        ("security_eval_complete_total", ctypes.c_int64),
        ("security_eval_partial_total", ctypes.c_int64),
        ("magnifier_sub_bars_total", ctypes.c_int64),
        ("magnifier_sample_ticks_total", ctypes.c_int64),
        ("input_tf_seconds", ctypes.c_int),
        ("script_tf_seconds", ctypes.c_int),
        ("script_tf_ratio", ctypes.c_int),
        ("needs_aggregation", ctypes.c_int),
        ("bar_magnifier_enabled", ctypes.c_int),
        ("security_diag", ctypes.POINTER(SecurityDiagC)),
        ("security_diag_len", ctypes.c_int),
        ("trace", ctypes.POINTER(TraceEntryC)),
        ("trace_len", ctypes.c_int),
        ("trace_names", ctypes.POINTER(ctypes.c_char_p)),
        ("trace_names_len", ctypes.c_int),
        ("metrics", MetricsC),
        ("equity_curve", ctypes.POINTER(EquityPointC)),
        ("equity_curve_len", ctypes.c_int64),
    ]

def parse_ohlcv_json(file_path: Path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Check if data is array of candles
    # Format can be: [{open, high, low, close, volume, timestamp}] or [[timestamp, open, high, low, close, volume]]
    bars = []
    for item in data:
        if isinstance(item, dict):
            bars.append(BarC(
                open=float(item.get("open", 0)),
                high=float(item.get("high", 0)),
                low=float(item.get("low", 0)),
                close=float(item.get("close", 0)),
                volume=float(item.get("volume", 0)),
                timestamp=int(item.get("timestamp", 0))
            ))
        elif isinstance(item, list) and len(item) >= 6:
            bars.append(BarC(
                timestamp=int(item[0]),
                open=float(item[1]),
                high=float(item[2]),
                low=float(item[3]),
                close=float(item[4]),
                volume=float(item[5])
            ))
    return bars

def stats_to_dict(stats: TradeStatsC):
    return {
        "num_trades": stats.num_trades,
        "num_wins": stats.num_wins,
        "num_losses": stats.num_losses,
        "num_even": stats.num_even,
        "percent_profitable": stats.percent_profitable,
        "net_profit": stats.net_profit,
        "net_profit_pct": stats.net_profit_pct,
        "gross_profit": stats.gross_profit,
        "gross_profit_pct": stats.gross_profit_pct,
        "gross_loss": stats.gross_loss,
        "gross_loss_pct": stats.gross_loss_pct,
        "profit_factor": stats.profit_factor,
        "avg_trade": stats.avg_trade,
        "avg_trade_pct": stats.avg_trade_pct,
        "avg_win": stats.avg_win,
        "avg_win_pct": stats.avg_win_pct,
        "avg_loss": stats.avg_loss,
        "avg_loss_pct": stats.avg_loss_pct,
        "ratio_avg_win_avg_loss": stats.ratio_avg_win_avg_loss,
        "largest_win": stats.largest_win,
        "largest_win_pct": stats.largest_win_pct,
        "largest_loss": stats.largest_loss,
        "largest_loss_pct": stats.largest_loss_pct,
        "commission_paid": stats.commission_paid,
        "expectancy": stats.expectancy,
        "max_consecutive_wins": stats.max_consecutive_wins,
        "max_consecutive_losses": stats.max_consecutive_losses,
        "avg_bars_in_trade": stats.avg_bars_in_trade,
    }

def main():
    parser = argparse.ArgumentParser(description="PineForge Strategy C FFI Runner")
    parser.add_argument("--strategy-path", required=True, help="Path to compiled strategy shared library (.so or .dll)")
    parser.add_argument("--ohlcv-json", required=True, help="Path to OHLCV data JSON file")
    args = parser.parse_args()

    lib_path = Path(args.strategy_path).resolve()
    ohlcv_path = Path(args.ohlcv_json).resolve()

    if not lib_path.exists():
        print(json.dumps({"success": False, "error": f"Strategy library not found at: {lib_path}"}))
        sys.exit(1)

    if not ohlcv_path.exists():
        print(json.dumps({"success": False, "error": f"OHLCV data file not found at: {ohlcv_path}"}))
        sys.exit(1)

    try:
        # Load the dynamic library
        # Use WinDLL on Windows if necessary, otherwise CDLL
        if sys.platform == "win32":
            lib = ctypes.windll.LoadLibrary(str(lib_path))
        else:
            lib = ctypes.CDLL(str(lib_path))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Failed to load library: {str(e)}"}))
        sys.exit(1)

    # Validate ABI Version
    try:
        lib.pf_abi_version.restype = ctypes.c_int
        abi_ver = lib.pf_abi_version()
        if abi_ver != 2:
            print(json.dumps({"success": False, "error": f"ABI version mismatch: Library has {abi_ver}, expected 2"}))
            sys.exit(1)
    except AttributeError:
        # Fallback if pf_abi_version is missing (ABI v1)
        pass

    # Load OHLCV bars
    try:
        bars = parse_ohlcv_json(ohlcv_path)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Failed to parse OHLCV JSON: {str(e)}"}))
        sys.exit(1)

    if not bars:
        print(json.dumps({"success": False, "error": "No bars loaded from JSON file."}))
        sys.exit(1)

    # Set up function signatures
    lib.strategy_create.restype = ctypes.c_void_p
    lib.strategy_create.argtypes = [ctypes.c_void_p]

    lib.run_backtest.restype = ctypes.c_int
    lib.run_backtest.argtypes = [
        ctypes.c_void_p,                                # pf_strategy_t
        ctypes.POINTER(BarC),                           # pf_bar_t*
        ctypes.c_int,                                   # size
        ctypes.POINTER(ReportC)                         # pf_report_t*
    ]

    lib.report_free.restype = None
    lib.report_free.argtypes = [ctypes.POINTER(ReportC)]

    lib.strategy_free.restype = None
    lib.strategy_free.argtypes = [ctypes.c_void_p]

    # Run backtest
    strategy_handle = None
    try:
        strategy_handle = lib.strategy_create(None)
        if not strategy_handle:
            raise RuntimeError("strategy_create returned null handle")

        # Create ctypes array of bars
        bar_array_type = BarC * len(bars)
        bar_array = bar_array_type(*bars)

        report = ReportC()
        ctypes.memset(ctypes.byref(report), 0, ctypes.sizeof(report))

        ret_val = lib.run_backtest(
            strategy_handle,
            bar_array,
            len(bars),
            ctypes.byref(report)
        )

        if ret_val != 0:
            raise RuntimeError(f"run_backtest returned error code: {ret_val}")

        # Parse trades
        trades = []
        for i in range(report.trades_len):
            t = report.trades[i]
            trades.append({
                "entry_time": t.entry_time,
                "exit_time": t.exit_time,
                "entry_price": t.entry_price,
                "exit_price": t.exit_price,
                "pnl": t.pnl,
                "pnl_pct": t.pnl_pct,
                "is_long": bool(t.is_long),
                "max_runup": t.max_runup,
                "max_drawdown": t.max_drawdown,
                "qty": t.qty,
                "commission": t.commission,
                "entry_bar_index": t.entry_bar_index,
                "exit_bar_index": t.exit_bar_index,
            })

        # Parse equity curve
        equity_curve = []
        if report.equity_curve and report.equity_curve_len > 0:
            for i in range(report.equity_curve_len):
                ep = report.equity_curve[i]
                equity_curve.append({
                    "time_ms": ep.time_ms,
                    "equity": ep.equity,
                    "open_profit": ep.open_profit
                })

        output = {
            "success": True,
            "total_trades": report.total_trades,
            "net_profit": report.net_profit,
            "input_bars_processed": report.input_bars_processed,
            "script_bars_processed": report.script_bars_processed,
            "trades": trades,
            "equity_curve": equity_curve,
            "metrics": {
                "all": stats_to_dict(report.metrics.all),
                "longs": stats_to_dict(report.metrics.longs),
                "shorts": stats_to_dict(report.metrics.shorts),
                "equity": {
                    "max_drawdown": report.metrics.equity.max_equity_drawdown,
                    "max_drawdown_pct": report.metrics.equity.max_equity_drawdown_pct,
                    "max_runup": report.metrics.equity.max_equity_runup,
                    "max_runup_pct": report.metrics.equity.max_equity_runup_pct,
                    "buy_hold_return": report.metrics.equity.buy_hold_return,
                    "buy_hold_return_pct": report.metrics.equity.buy_hold_return_pct,
                    "sharpe_tv": report.metrics.equity.sharpe_tv,
                    "sortino_tv": report.metrics.equity.sortino_tv,
                    "sharpe_bar": report.metrics.equity.sharpe_bar,
                    "sortino_bar": report.metrics.equity.sortino_bar,
                    "cagr": report.metrics.equity.cagr,
                    "calmar": report.metrics.equity.calmar,
                    "recovery_factor": report.metrics.equity.recovery_factor,
                    "time_in_market_pct": report.metrics.equity.time_in_market_pct,
                    "open_pl": report.metrics.equity.open_pl,
                }
            }
        }

        # Free report memory
        lib.report_free(ctypes.byref(report))
        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"success": False, "error": f"Exception during execution: {str(e)}"}))
        sys.exit(1)
    finally:
        if strategy_handle and lib:
            lib.strategy_free(strategy_handle)

if __name__ == "__main__":
    main()
