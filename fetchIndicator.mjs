// Fetch a Matassa indicator's computed output from TradingView (the "oracle").
// Captures BOTH plot series (study.periods) AND chart drawings (study.graphic:
// labels/lines/boxes/tables), which is what the CSV exports were missing.
//
// Usage:  node fetchIndicator.mjs <key> [range] [waitMs]
//   key    : one of indicators.json keys (default: completa)
//   range  : number of bars to load (default: 5000)
//   waitMs : how long to stream before snapshotting (default: 20000)
import "dotenv/config";
import fs from "node:fs";
import TradingView from "@mathieuc/tradingview";

const key = process.argv[2] || "completa";
const RANGE = parseInt(process.argv[3] || "5000", 10);
const WAIT_MS = parseInt(process.argv[4] || "20000", 10);

const cfgPath = new URL("./indicators.json", import.meta.url);
const localPath = new URL("./indicators.local.json", import.meta.url);

const cfg = JSON.parse(fs.readFileSync(cfgPath));
const indMeta = cfg.indicators.find((i) => i.key === key);
if (!indMeta) {
  console.error(`Unknown key '${key}'. Available: ${cfg.indicators.map((i) => i.key).join(", ")}`);
  process.exit(1);
}

// Load secure indicator settings from local untracked file
let localCfg = {};
if (fs.existsSync(localPath)) {
  try {
    localCfg = JSON.parse(fs.readFileSync(localPath));
  } catch (err) {
    console.error("Warning: Failed to parse indicators.local.json:", err.message);
  }
}

const localData = localCfg[key] || {};
const ind = {
  ...indMeta,
  pineId: process.env[`TV_PINE_ID_${key.toUpperCase()}`] || localData.pineId,
  version: process.env[`TV_VERSION_${key.toUpperCase()}`] || localData.version || "last"
};

if (!ind.pineId) {
  console.error(`ERROR: No pineId found for indicator '${key}'.
Please define it in indicators.local.json or set the TV_PINE_ID_${key.toUpperCase()} environment variable.`);
  process.exit(1);
}

const session = (process.env.TV_SESSION || "").trim();
const signature = (process.env.TV_SESSION_SIGN || "").trim();
const symbol = (process.env.TV_SYMBOL || "BINANCE:BTCUSDT").trim();
const timeframe = (process.env.TV_TIMEFRAME || "60").trim();

if (!session) {
  console.error("ERROR: TV_SESSION empty in .env");
  process.exit(1);
}

const client = new TradingView.Client({ token: session, signature });
const chart = new client.Session.Chart();
chart.setMarket(symbol, { timeframe, range: RANGE });

let indicator;
try {
  // TV_VERSION overrides the pinned version ("last" = newest saved
  // revision; use after editing/saving the script on TradingView).
  const wantVersion = process.env.TV_VERSION || ind.version;
  indicator = await TradingView.getIndicator(ind.pineId, wantVersion, session, signature);
} catch (err) {
  console.error("getIndicator failed:", err?.message || err);
  process.exit(2);
}

// Optional input overrides: TV_INPUTS='{"in_9":false}' (e.g. Centratura off).
let inputOverrides = {};
try {
  inputOverrides = JSON.parse(process.env.TV_INPUTS || "{}");
} catch (e) {
  console.error("TV_INPUTS is not valid JSON:", e.message);
  process.exit(1);
}
for (const [k, v] of Object.entries(inputOverrides)) {
  try {
    indicator.setOption(k, v);
    console.error(`set input ${k} = ${JSON.stringify(v)}`);
  } catch (e) {
    console.error(`setOption ${k} failed:`, e?.message || e);
  }
}

const plotNames = Object.keys(indicator.plots || {});
console.error(
  `Loaded "${indicator.description}" v${indicator.pineVersion ?? ind.version} | ` +
    `inputs=${Object.keys(indicator.inputs || {}).length} | plots=${plotNames.length}`,
);

const study = new chart.Study(indicator);

let done = false;
const finish = (status) => {
  if (done) return;
  done = true;
  const periods = Array.isArray(study.periods) ? study.periods : [];
  const graphic = study.graphic || {};
  const graphicSummary = {};
  for (const [g, v] of Object.entries(graphic)) {
    graphicSummary[g] = Array.isArray(v) ? v.length : typeof v;
  }
  const out = {
    meta: {
      key,
      name: ind.name,
      pineId: ind.pineId,
      version: ind.version,
      symbol,
      timeframe,
      range: RANGE,
      inputOverrides,
      status,
      fetchedAt: new Date().toISOString(),
    },
    plots: plotNames,
    inputs: indicator.inputs,
    graphicSummary,
    periodsCount: periods.length,
    periodsSample: periods.slice(-3),
    periods,
    // Materialize table cell text: graphic.tables[].cells is a lazy function that
    // JSON.stringify drops, so cell text (the stats: Media/Mediana/Moda, durations,
    // amplitudes...) was being lost. Expand it into a static matrix here.
    graphic: {
      ...graphic,
      tables: (graphic.tables || []).map((t) => ({
        ...t,
        cells: typeof t.cells === "function" ? t.cells() : t.cells,
      })),
    },
    // For strategy() scripts (e.g. Model Entry): executed trades + performance.
    // entry/exit carry price+time+type; exit.name says why it closed (SL/TP/...).
    strategyReport: study.strategyReport || null,
    // Raw price candles TV used to compute the study (time/open/high=max/low=min/close/volume).
    // Feed these to the Python port so both sides see identical bars (zero data drift).
    chartOhlc: (Array.isArray(chart.periods) ? chart.periods : []).map((p) => ({
      time: p.time,
      open: p.open,
      high: p.max,
      low: p.min,
      close: p.close,
      volume: p.volume,
    })),
  };
  fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  const path = new URL(`./out/${key}.json`, import.meta.url);
  fs.writeFileSync(path, JSON.stringify(out, null, 2));
  console.error(
    `[${status}] wrote out/${key}.json — periods=${periods.length} plots=[${plotNames.join(", ")}] ` +
      `graphic={${Object.entries(graphicSummary).map(([k, n]) => `${k}:${n}`).join(", ")}}`,
  );
  try { client.end(); } catch { /* ignore */ }
  process.exit(0);
};

// The @mathieuc/tradingview protocol parser throws an *uncaught* error when a
// study data chunk is not a valid zip ("jszip: Can't find end of central
// directory") — this kills the process before we can snapshot. Catch it at the
// process level and snapshot whatever periods/graphic already streamed in, so a
// single bad chunk (often the strategyReport blob) doesn't lose the whole fetch.
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err?.message || err);
  finish("uncaught-recovered");
});
process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection:", err?.message || err);
  finish("unhandled-recovered");
});

study.onError((...err) => {
  console.error("study error:", ...err);
  finish("study-error");
});
chart.onError((...err) => {
  console.error("chart error:", ...err);
  finish("chart-error");
});
study.onUpdate(() => {
  /* periods accumulate on the study; we snapshot after WAIT_MS */
});

setTimeout(() => finish("timeout"), WAIT_MS);
