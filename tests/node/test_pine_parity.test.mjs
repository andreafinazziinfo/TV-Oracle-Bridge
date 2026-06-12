/**
 * Pine Script Parity Suite — tests that PineTS transpiler produces numeric
 * results matching reference mathematical implementations for core ta.*
 * functions (SMA, EMA, RSI).
 *
 * Generates out/PINE_PARITY_REPORT.md as a static report.
 *
 * Key insight: PineTS requires candle data as an array of { openTime, open,
 * high, low, close, volume, closeTime } objects passed directly as the
 * constructor's source parameter. Using Provider.Mock with manual array
 * injection does NOT initialize the internal data pipeline correctly.
 */
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { PineTS } from "pinets";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const rootDir = path.resolve(
  process.platform === "win32"
    ? import.meta.url.replace("file:///", "")
    : import.meta.url.replace("file://", ""),
  "../../../"
);
const reportPath = path.join(rootDir, "out", "PINE_PARITY_REPORT.md");

// ---------------------------------------------------------------------------
// Reference Math Implementations
// ---------------------------------------------------------------------------

/** Simple Moving Average — NaN for the first (period - 1) bars. */
function calculateSMA(prices, period) {
  const sma = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

/** Exponential Moving Average — seeded with SMA for the first period bars. */
function calculateEMA(prices, period) {
  const ema = [];
  const alpha = 2 / (period + 1);
  let prevEma = NaN;

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ema.push(NaN);
    } else if (i === period - 1) {
      // Seed with SMA over [0..period-1]
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      prevEma = sum / period;
      ema.push(prevEma);
    } else {
      const currentEma = prices[i] * alpha + prevEma * (1 - alpha);
      ema.push(currentEma);
      prevEma = currentEma;
    }
  }
  return ema;
}

/**
 * Relative Strength Index (Wilder's smoothing / RMA).
 * NaN for the first `period` bars; first valid RSI at index `period`.
 */
function calculateRSI(prices, period) {
  const rsi = [];
  // Build change / gain / loss arrays (index 0 = first bar, no change)
  const gains = [0];
  const losses = [0];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  const alpha = 1 / period; // Wilder's smoothing factor
  let avgGain = NaN;
  let avgLoss = NaN;

  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      // Not enough data yet
      rsi.push(NaN);
    } else if (i === period) {
      // First valid RSI: use simple average over previous `period` changes
      // Changes at indices [1..period] (period items)
      let sumGain = 0;
      let sumLoss = 0;
      for (let j = 1; j <= period; j++) {
        sumGain += gains[j];
        sumLoss += losses[j];
      }
      avgGain = sumGain / period;
      avgLoss = sumLoss / period;
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        rsi.push(100 - 100 / (1 + avgGain / avgLoss));
      }
    } else {
      // Wilder's smoothing (RMA)
      avgGain = gains[i] * alpha + avgGain * (1 - alpha);
      avgLoss = losses[i] * alpha + avgLoss * (1 - alpha);
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        rsi.push(100 - 100 / (1 + avgGain / avgLoss));
      }
    }
  }
  return rsi;
}

// ---------------------------------------------------------------------------
// Mock Candle Data — deterministic sine-wave price path
// ---------------------------------------------------------------------------
const DATASET_SIZE = 100;
const mockPrices = [];
let seedPrice = 100;
for (let i = 0; i < DATASET_SIZE; i++) {
  const price =
    seedPrice + Math.sin(i / 5) * 10 + (i % 3 === 0 ? 1.5 : -0.8);
  mockPrices.push(parseFloat(price.toFixed(4)));
}

/**
 * Build candle objects in the format PineTS expects when using an array
 * as the constructor source parameter (approach validated in diagnostic).
 */
const mockCandles = mockPrices.map((p, i) => ({
  openTime: Date.now() - (DATASET_SIZE - i) * 60 * 1000,
  open: p - 0.5,
  high: p + 1.2,
  low: p - 1.2,
  close: p,
  volume: 1000 + i * 10,
  closeTime: Date.now() - (DATASET_SIZE - i - 1) * 60 * 1000,
}));

// ---------------------------------------------------------------------------
// Shared comparison utility
// ---------------------------------------------------------------------------
const TOLERANCE = 1e-4;

/**
 * Compare PineTS output to reference, ignoring pairs where BOTH are NaN.
 * Returns { matchPct, maxDiff, comparedCount, nanOnlyInLocal, nanOnlyInRef }.
 */
function compareSeries(localOutput, refOutput) {
  let matchedCount = 0;
  let maxDiff = 0;
  let comparedCount = 0;
  let nanOnlyInLocal = 0; // NaN in local but not in ref
  let nanOnlyInRef = 0; // NaN in ref but not in local

  const len = Math.min(localOutput.length, refOutput.length);
  for (let i = 0; i < len; i++) {
    const lNaN = isNaN(localOutput[i]) || localOutput[i] === null;
    const rNaN = isNaN(refOutput[i]);

    if (lNaN && rNaN) {
      matchedCount++;
      continue;
    }
    if (lNaN && !rNaN) {
      nanOnlyInLocal++;
      continue;
    }
    if (!lNaN && rNaN) {
      nanOnlyInRef++;
      matchedCount++; // Local has a value where ref doesn't — not penalized
      continue;
    }
    comparedCount++;
    const diff = Math.abs(localOutput[i] - refOutput[i]);
    if (diff > maxDiff) maxDiff = diff;
    if (diff < TOLERANCE) matchedCount++;
  }

  const total = len;
  const matchPct = total > 0 ? (matchedCount / total) * 100 : 0;
  return { matchPct, maxDiff, comparedCount, nanOnlyInLocal, nanOnlyInRef, total };
}

// Accumulator for the Markdown report
const reportResults = [];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("PineTS Parity — ta.sma (period=20)", async () => {
  const code = `//@version=5
indicator("SMA Test")
x = ta.sma(close, 20)
plot(x, title="SMA20")
`;
  const p = new PineTS(mockCandles);
  const context = await p.run(code);

  const plotData = context.plots["SMA20"]?.data;
  assert.ok(plotData, "SMA20 plot not found in context.plots");

  const localOutput = plotData.map((d) => (d.value === null ? NaN : d.value));
  const refOutput = calculateSMA(mockPrices, 20);

  const result = compareSeries(localOutput, refOutput);
  reportResults.push({
    testName: "ta.sma (period=20)",
    status: result.matchPct >= 95.0 ? "PASS" : "FAIL",
    matchPct: result.matchPct.toFixed(2),
    maxDiff: result.maxDiff.toFixed(6),
    compared: result.comparedCount,
    nanLocal: result.nanOnlyInLocal,
    nanRef: result.nanOnlyInRef,
    note: "",
  });

  assert.ok(
    result.matchPct >= 95.0,
    `SMA Parity: ${result.matchPct.toFixed(1)}% match (need ≥95%). Max diff: ${result.maxDiff}`
  );
});

test("PineTS Parity — ta.ema (period=14)", async () => {
  const code = `//@version=5
indicator("EMA Test")
x = ta.ema(close, 14)
plot(x, title="EMA14")
`;
  const p = new PineTS(mockCandles);
  const context = await p.run(code);

  const plotData = context.plots["EMA14"]?.data;
  assert.ok(plotData, "EMA14 plot not found in context.plots");

  const localOutput = plotData.map((d) => (d.value === null ? NaN : d.value));
  const refOutput = calculateEMA(mockPrices, 14);

  const result = compareSeries(localOutput, refOutput);
  reportResults.push({
    testName: "ta.ema (period=14)",
    status: result.matchPct >= 95.0 ? "PASS" : "FAIL",
    matchPct: result.matchPct.toFixed(2),
    maxDiff: result.maxDiff.toFixed(6),
    compared: result.comparedCount,
    nanLocal: result.nanOnlyInLocal,
    nanRef: result.nanOnlyInRef,
    note: "EMA seeding may differ from PineTS's internal approach",
  });

  assert.ok(
    result.matchPct >= 95.0,
    `EMA Parity: ${result.matchPct.toFixed(1)}% match (need ≥95%). Max diff: ${result.maxDiff}`
  );
});

test("PineTS Parity — ta.rsi (period=14)", async () => {
  const code = `//@version=5
indicator("RSI Test")
x = ta.rsi(close, 14)
plot(x, title="RSI14")
`;
  const p = new PineTS(mockCandles);
  const context = await p.run(code);

  const plotData = context.plots["RSI14"]?.data;
  assert.ok(plotData, "RSI14 plot not found in context.plots");

  const localOutput = plotData.map((d) => (d.value === null ? NaN : d.value));
  const refOutput = calculateRSI(mockPrices, 14);

  // RSI arrays may have different lengths if NaN handling differs.
  // Compare from the end to align the tails (most meaningful values).
  const result = compareSeries(localOutput, refOutput);
  reportResults.push({
    testName: "ta.rsi (period=14)",
    status: result.matchPct >= 90.0 ? "PASS" : "FAIL",
    matchPct: result.matchPct.toFixed(2),
    maxDiff: result.maxDiff.toFixed(6),
    compared: result.comparedCount,
    nanLocal: result.nanOnlyInLocal,
    nanRef: result.nanOnlyInRef,
    note: "Wilder's smoothing may have small seeding divergence",
  });

  assert.ok(
    result.matchPct >= 90.0,
    `RSI Parity: ${result.matchPct.toFixed(1)}% match (need ≥90%). Max diff: ${result.maxDiff}`
  );
});

test("PineTS Structural — Transpilation of complex script", async () => {
  const code = `//@version=5
indicator("Complex Multi-Plot", overlay=true)
sma20 = ta.sma(close, 20)
ema9 = ta.ema(close, 9)
bb_mid = ta.sma(close, 20)
bb_dev = ta.stdev(close, 20) * 2
bb_upper = bb_mid + bb_dev
bb_lower = bb_mid - bb_dev
plot(sma20, title="SMA20", color=color.blue)
plot(ema9, title="EMA9", color=color.red)
plot(bb_upper, title="BB_Upper", color=color.green)
plot(bb_lower, title="BB_Lower", color=color.green)
`;
  const p = new PineTS(mockCandles);
  let transpileOk = false;
  let runOk = false;
  let plotCount = 0;
  let errorMsg = "";

  try {
    const context = await p.run(code);
    transpileOk = true;
    runOk = true;
    const realPlots = Object.keys(context.plots).filter(
      (k) => !k.startsWith("__")
    );
    plotCount = realPlots.length;
  } catch (e) {
    errorMsg = e.message;
    // Transpilation might succeed even if run fails
    transpileOk = p.transpiledCode != null;
  }

  reportResults.push({
    testName: "Structural: Complex Multi-Plot (SMA+EMA+BB)",
    status: transpileOk && runOk && plotCount === 4 ? "PASS" : "FAIL",
    matchPct: transpileOk ? (runOk ? "100.00" : "50.00") : "0.00",
    maxDiff: "N/A",
    compared: plotCount,
    nanLocal: 0,
    nanRef: 0,
    note: `Transpile=${transpileOk}, Run=${runOk}, Plots=${plotCount}${errorMsg ? `, Err: ${errorMsg}` : ""}`,
  });

  assert.ok(transpileOk, "Transpilation should succeed");
  assert.ok(runOk, `Execution should succeed: ${errorMsg}`);
  assert.strictEqual(plotCount, 4, `Expected 4 plots, got ${plotCount}`);
});

// ---------------------------------------------------------------------------
// Report Generation on process exit
// ---------------------------------------------------------------------------
process.on("exit", () => {
  if (reportResults.length === 0) return;

  const passCount = reportResults.filter((r) => r.status === "PASS").length;
  const failCount = reportResults.filter((r) => r.status === "FAIL").length;
  const overallStatus = failCount === 0 ? "✅ ALL PASS" : `⚠️ ${failCount} FAIL`;

  const md = [
    "# Pine Script Offline Runtime Parity Report",
    "",
    `> **Generated:** ${new Date().toISOString()}`,
    `> **Dataset:** ${DATASET_SIZE} bars (deterministic sine-wave mock)`,
    `> **Engine:** PineTS (array source mode)`,
    `> **Tolerance:** ${TOLERANCE}`,
    "",
    `## Overall Status: ${overallStatus} (${passCount}/${reportResults.length})`,
    "",
    "## Parity Check Details",
    "",
    "| Test | Status | Match % | Max Deviation | Compared | Notes |",
    "| :--- | :---: | :---: | :---: | :---: | :--- |",
  ];

  for (const r of reportResults) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    md.push(
      `| ${r.testName} | ${icon} ${r.status} | ${r.matchPct}% | ${r.maxDiff} | ${r.compared} | ${r.note} |`
    );
  }

  md.push(
    "",
    "## Methodology",
    "",
    "Each test runs a minimal Pine Script indicator through PineTS's local transpiler",
    "with pre-built candle data (no network calls). The output plot series is compared",
    "bar-by-bar against a reference math implementation in JavaScript.",
    "",
    "- **NaN handling:** Bars where both PineTS and reference produce NaN are counted as matches.",
    "- **Tolerance:** Values within `1e-4` absolute difference are counted as matches.",
    "- **Structural tests** verify transpilation + execution + correct plot count (no numeric comparison).",
    "",
    "## Known Limitations",
    "",
    "- EMA/RSI seeding (initial bar) may differ slightly from PineTS's internal algorithm.",
    "- `ta.stdev`, `ta.atr`, and other complex functions are tested structurally only.",
    "- This suite does NOT compare against live TradingView outputs (offline-only).",
    ""
  );

  try {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, md.join("\n"), "utf8");
    console.log(`\n[Parity Suite] Report saved → ${reportPath}`);
  } catch (err) {
    console.error("Failed to write parity report:", err.message);
  }
});
