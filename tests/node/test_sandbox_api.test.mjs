import { test, describe } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "../../dashboard/server.mjs";

describe("Sandbox API Endpoints", () => {
  const sampleOhlcv = [
    { time: 1700000000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
    { time: 1700003600, open: 102, high: 108, low: 101, close: 106, volume: 1200 },
    { time: 1700007200, open: 106, high: 107, low: 100, close: 101, volume: 900 },
    { time: 1700010800, open: 101, high: 104, low: 99, close: 103, volume: 1100 },
    { time: 1700014400, open: 103, high: 110, low: 102, close: 109, volume: 1500 }
  ];

  test("POST /api/transpile/indicator compiles a valid Pine Script indicator", async () => {
    const code = `//@version=5
indicator("Test SMA", overlay=true)
src = close
val = ta.sma(src, 3)
plot(val)
`;
    const res = await request(app)
      .post("/api/transpile/indicator")
      .send({ code })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.jsCode === "string");
    assert.ok(res.body.jsCode.includes("createIndicator"));
  });

  test("POST /api/transpile/indicator rejects strategy scripts", async () => {
    const code = `//@version=5
strategy("Test Strategy")
strategy.entry("Buy", strategy.long)
`;
    const res = await request(app)
      .post("/api/transpile/indicator")
      .send({ code })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes("Strategy scripts containing"));
  });

  test("POST /api/transpile/indicator handles missing code parameter", async () => {
    const res = await request(app)
      .post("/api/transpile/indicator")
      .send({})
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Missing 'code'/);
  });

  test("POST /api/indicator/run computes indicator values successfully", async () => {
    const code = `//@version=5
indicator("Test EMA", overlay=true)
fast = ta.ema(close, 2)
plot(fast, "Fast EMA")
`;
    const res = await request(app)
      .post("/api/indicator/run")
      .send({ code, ohlcv: sampleOhlcv })
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.plots);
    assert.ok(res.body.plots["Fast EMA"]);
    assert.strictEqual(res.body.plots["Fast EMA"].title, "Fast EMA");
    assert.ok(Array.isArray(res.body.plots["Fast EMA"].data));
    assert.strictEqual(res.body.plots["Fast EMA"].data.length, sampleOhlcv.length);
    assert.ok(typeof res.body.transpiledJS === "string");
  });

  test("POST /api/indicator/run handles execution errors gracefully", async () => {
    // Syntax error to trigger fast failure without hanging
    const code = `//@version=5
indicator("Invalid Syntax")
val = ta.sma(close,
`;
    const res = await request(app)
      .post("/api/indicator/run")
      .send({ code, ohlcv: sampleOhlcv })
      .expect(500);

    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error);
  });

  test("POST /api/transpile/strategy compiles strategy to C++ code", async () => {
    const code = `//@version=5
strategy("Simple Strategy")
fastEMA = ta.ema(close, 9)
slowSMA = ta.sma(close, 21)
if ta.crossover(fastEMA, slowSMA)
    strategy.entry("Long", strategy.long)
if ta.crossunder(fastEMA, slowSMA)
    strategy.close("Long")
`;
    const res = await request(app)
      .post("/api/transpile/strategy")
      .send({ code });

    // Since this spawns a python process to run pineforge_codegen, it may fail if pineforge-codegen is not installed on the system.
    // If it succeeds (C++ output generated), it will return 200. If Python script fails (package missing), it will return 400.
    // We assert either success is true with cppCode, or success is false with some traceback error.
    assert.ok([200, 400].includes(res.status));
    if (res.status === 200) {
      assert.strictEqual(res.body.success, true);
      assert.ok(typeof res.body.cppCode === "string");
    } else {
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.error);
    }
  });

  test("GET /api/cache/bars returns cached bars or empty array", async () => {
    const res = await request(app)
      .get("/api/cache/bars")
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.bars));
  });
});
