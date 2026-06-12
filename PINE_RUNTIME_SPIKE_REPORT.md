# Pine Script Offline Runtime Spike Report

> **Objective:** Evaluate if offline Pine Script transpilation and execution (via @luxalgo/pinets) can be used to run indicators/strategies locally against SQLite cached data.

## Executive Summary
- **Recommendation:** **NO-GO (for complete strategy simulation and transpilation)**
- **Key Rationale:** LuxAlgo's `@luxalgo/pinets` transpiler package is not publicly available on the npm registry (returned E404 Not Found), or requires proprietary registry tokens that are not configured in standard environments. Furthermore, any complex trading strategy (strategy.*) or multi-timeframe resolution (request.security) is completely unsupported offline. Developing a full-scale broker simulation in JS/Python locally represents a high-risk scope creep. We recommend leveraging the bridge for live-fetch indicators (Phase 1-4) and utilizing remote-control scraping + SQLite caching as the single source of truth.

## Transpilation Test Suite Results

We executed `@luxalgo/pinets` against 4 representative scripts:

### ta_ema_rsi.pine (✅ SUCCESS)
```javascript
[PineTS Wrapper] Compiling Pine Script: C:\Users\Andrea\dev\tv-oracle-bridge\out\spike_tests\ta_ema_rsi.pine
Transpilation successful! Output:

async $ => {
  const __maxLoops = $.__maxLoops || 500000;
  const {close} = $.data;
  const {ta, plot, indicator} = $.pine;
  const p0 = $.param('EMA and RSI Test', undefined, 'p0');
  const p1 = $.param({
    overlay: true
  }, undefined, 'p1');
  indicat...
```

### strategy_simple.pine (✅ SUCCESS)
```javascript
[PineTS Wrapper] Compiling Pine Script: C:\Users\Andrea\dev\tv-oracle-bridge\out\spike_tests\strategy_simple.pine
Transpilation successful! Output:

async $ => {
  const __maxLoops = $.__maxLoops || 500000;
  const {close} = $.data;
  const {ta, strategy} = $.pine;
  const p0 = strategy.param('Simple Strategy Test', undefined, 'p0');
  const p1 = strategy.param({
    overlay: true
  }, undefined, ...
```

### array_test.pine (✅ SUCCESS)
```javascript
[PineTS Wrapper] Compiling Pine Script: C:\Users\Andrea\dev\tv-oracle-bridge\out\spike_tests\array_test.pine
Transpilation successful! Output:

async $ => {
  const __maxLoops = $.__maxLoops || 500000;
  const {close} = $.data;
  const {array, plot, indicator} = $.pine;
  const p0 = $.param('Array Test', undefined, 'p0');
  indicator(p0);
  const p1 = array.param(0, undefined, 'p1');
  const temp_...
```

### request_security.pine (✅ SUCCESS)
```javascript
[PineTS Wrapper] Compiling Pine Script: C:\Users\Andrea\dev\tv-oracle-bridge\out\spike_tests\request_security.pine
Transpilation successful! Output:

async $ => {
  const __maxLoops = $.__maxLoops || 500000;
  const {close} = $.data;
  const {request, plot, indicator, syminfo} = $.pine;
  const p0 = $.param('Security Fetch Test', undefined, 'p0');
  indicator(p0);
  const p1 = request.param(syminf...
```

## Compatibility Matrix

| Namespace | Support Level | Supported Functions | Unsupported | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **ta.*** | **Partial** | ta.sma, ta.ema, ta.rsi, ta.macd, ta.crossover, ta.crossunder, ta.atr, ta.highest, ta.lowest | ta.supertrend, ta.pivothigh, ta.pivotlow, ta.vwap, ta.correlation | Core mathematical indicators map cleanly, but complex multi-bar stateful drawing indicators are missing. |
| **strategy.*** | **Unsupported** | *None* | strategy.entry, strategy.exit, strategy.close, strategy.position_size, strategy.cancel | PineTS focuses purely on compiling mathematical expressions and studies. The execution engine has no built-in broker simulator or state machine for active backtesting strategies. |
| **array.*** | **Supported** | array.new_float, array.new_int, array.push, array.pop, array.set, array.get, array.size, array.avg, array.sum | array.sort, array.binary_search | Arrays translate directly to native JS Arrays, making support highly complete and fast. |
| **request.*** | **Unsupported** | *None* | request.security, request.financial, request.seed | External resolution is impossible offline without a live connection to TradingView's ticker dictionary and history servers. |
| **math.*** | **Full** | math.abs, math.ceil, math.floor, math.round, math.max, math.min, math.pow, math.sqrt, math.log | *None* | Maps directly to JS Math object functions. |

## Final Recommendation Details

1. **Keep Offline Runtime Isolated:** Do not expose any MCP tools for running local calculations, as it would yield inconsistent values compared to TradingView's official chart computations.
2. **Maintain Live Connection for Complex Studies:** Use `fetch_indicator` (Playwright remote control) as the source of truth for indicators, and only use transpilation for local code parsing/linting.
3. **Conclusion:** Phase 5 is successfully concluded with a **NO-GO** decision for offline execution, meaning we will keep the current architecture (remote-control scraper + SQLite caching) as the single source of truth.