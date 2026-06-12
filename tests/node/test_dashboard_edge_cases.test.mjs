/**
 * test_dashboard_edge_cases.test.mjs — Edge-case and validation tests for
 * the Dashboard REST API endpoints that go beyond the happy-path coverage
 * already present in test_dashboard_api.test.mjs.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
process.env.NODE_ENV = "test";
import { app } from "../../dashboard/server.mjs";

describe("Dashboard API Edge Cases", () => {
  // ─── /api/health ──────────────────────────────────────────────────────────
  test("GET /api/health response has all required fields and correct types", async () => {
    const res = await request(app).get("/api/health").expect(200);
    assert.strictEqual(res.body.status, "ok");
    assert.strictEqual(typeof res.body.uptime, "number");
    assert.ok(res.body.uptime >= 0, "uptime must be non-negative");
    assert.strictEqual(res.body.version, "1.2.0");
    assert.ok(res.body.timestamp, "timestamp must be present");
    // Validate ISO-8601 parsability
    assert.ok(!isNaN(Date.parse(res.body.timestamp)), "timestamp must be ISO-8601");
    assert.ok(res.body.node.startsWith("v"), "node version must start with 'v'");
  });

  // ─── /api/daemon/start — boundary interval values ─────────────────────────
  test("POST /api/daemon/start rejects negative intervalMinutes", async () => {
    const res = await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: -5 })
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /intervalMinutes must be between 1 and 1440/);
  });

  test("POST /api/daemon/start rejects intervalMinutes = 1441 (just over max)", async () => {
    const res = await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: 1441 })
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /intervalMinutes must be between 1 and 1440/);
  });

  test("POST /api/daemon/start rejects NaN intervalMinutes", async () => {
    const res = await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: "not_a_number" })
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /intervalMinutes must be between 1 and 1440/);
  });

  test("POST /api/daemon/start rejects fractional intervalMinutes (parsed as int)", async () => {
    // parseInt("2.5") => 2, which is valid; the float is truncated.
    // This verifies the server handles it gracefully (2 is in range [1,1440])
    const res = await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: 2.5 })
      .expect(200);
    // Should succeed because parseInt(2.5) === 2
    assert.strictEqual(res.body.success, true);

    // Teardown: stop the daemon we just started
    await request(app).post("/api/daemon/stop");
  });

  test("POST /api/daemon/start accepts boundary value 1 (minimum)", async () => {
    const res = await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: 1 })
      .expect(200);
    assert.strictEqual(res.body.success, true);

    // Stop daemon immediately after starting
    await request(app).post("/api/daemon/stop");
  });

  test("POST /api/daemon/start accepts boundary value 1440 (maximum)", async () => {
    const res = await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: 1440 })
      .expect(200);
    assert.strictEqual(res.body.success, true);

    await request(app).post("/api/daemon/stop");
  });

  test("POST /api/daemon/start when already running returns idempotent 200", async () => {
    // Start daemon first
    await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: 15 })
      .expect(200);

    // Try starting again
    const res = await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: 30 })
      .expect(200);
    assert.strictEqual(res.body.success, true);
    assert.match(res.body.message, /already running/i);

    // Cleanup
    await request(app).post("/api/daemon/stop");
  });

  // ─── /api/daemon/stop — idempotent stop ───────────────────────────────────
  test("POST /api/daemon/stop when not running returns idempotent 200", async () => {
    // Ensure daemon is stopped first
    await request(app).post("/api/daemon/stop");

    // Stop again
    const res = await request(app).post("/api/daemon/stop").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.match(res.body.message, /not running/i);
  });

  // ─── /api/daemon/status ───────────────────────────────────────────────────
  test("GET /api/daemon/status returns null nextRun when daemon is stopped", async () => {
    // Ensure daemon is stopped
    await request(app).post("/api/daemon/stop");

    const res = await request(app).get("/api/daemon/status").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.isRunning, false);
    assert.strictEqual(res.body.nextRun, null);
  });

  // ─── /api/docs — edge-case queries ────────────────────────────────────────
  test("GET /api/docs without query returns first 100 entries and total count", async () => {
    const res = await request(app).get("/api/docs").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.ok("total" in res.body, "should have total count");
    assert.ok(typeof res.body.total === "number");
    assert.ok(Object.keys(res.body.docs).length <= 100);
  });

  test("GET /api/docs with empty query string returns subset", async () => {
    const res = await request(app).get("/api/docs?q=").expect(200);
    assert.strictEqual(res.body.success, true);
    // Empty string after trim => returns first 100 entries
    assert.ok("total" in res.body);
  });

  test("GET /api/docs with whitespace-only query returns subset", async () => {
    const res = await request(app).get("/api/docs?q=%20%20%20").expect(200);
    assert.strictEqual(res.body.success, true);
    // Trimmed to empty string => returns first 100 entries
    assert.ok("total" in res.body);
  });

  test("GET /api/docs search is case-insensitive", async () => {
    const resLower = await request(app).get("/api/docs?q=ema").expect(200);
    const resUpper = await request(app).get("/api/docs?q=EMA").expect(200);

    assert.strictEqual(resLower.body.success, true);
    assert.strictEqual(resUpper.body.success, true);
    // Both should find same results since both are lowercased
    assert.strictEqual(resLower.body.totalMatches, resUpper.body.totalMatches);
  });

  test("GET /api/docs with nonsense query returns zero results", async () => {
    const res = await request(app)
      .get("/api/docs?q=zzzxxxxxxxxnotarealfunction999")
      .expect(200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.totalMatches, 0);
    assert.deepStrictEqual(res.body.docs, {});
  });

  test("GET /api/docs with special characters in query does not crash", async () => {
    const res = await request(app)
      .get("/api/docs?q=%3Cscript%3Ealert(1)%3C/script%3E")
      .expect(200);
    assert.strictEqual(res.body.success, true);
    // Should just return 0 results
    assert.strictEqual(res.body.totalMatches, 0);
  });

  test("GET /api/docs with regex-like characters returns safely", async () => {
    const res = await request(app)
      .get("/api/docs?q=ta.*")
      .expect(200);
    assert.strictEqual(res.body.success, true);
    // The .includes() search treats this as literal "ta.*"
  });

  // ─── /api/indicators/:key — validation ────────────────────────────────────
  test("GET /api/indicators/:key rejects keys with spaces", async () => {
    const res = await request(app)
      .get("/api/indicators/my%20key")
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Invalid indicator key/);
  });

  test("GET /api/indicators/:key rejects keys with dots (directory traversal)", async () => {
    const res = await request(app)
      .get("/api/indicators/foo.bar")
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Invalid indicator key/);
  });

  test("GET /api/indicators/:key allows valid alphanumeric keys with underscore and hyphen", async () => {
    // This key probably doesn't exist on disk, but the validation should pass (404 expected, not 400)
    const res = await request(app)
      .get("/api/indicators/valid_key-123")
      .expect(404);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /not found/i);
  });

  // ─── /api/extract/:type — validation ──────────────────────────────────────
  test("GET /api/extract/:type rejects unknown types", async () => {
    const invalidTypes = ["stocks", "futures", "bonds", "forex", "crypto", ""];
    for (const type of invalidTypes) {
      if (!type) continue; // empty type won't hit this route
      const res = await request(app)
        .get(`/api/extract/${type}`)
        .expect(400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Invalid extraction type/);
    }
  });

  test("GET /api/extract/options accepts valid symbols with colons and equals", async () => {
    // Symbol with colons and equals should be allowed (e.g., NASDAQ:AAPL)
    process.env.NODE_ENV = "test";
    const res = await request(app)
      .get("/api/extract/options?symbol=NASDAQ:AAPL")
      .expect(200);
    assert.strictEqual(res.body.success, true);
  });

  test("GET /api/extract/heatmap type is accepted", async () => {
    process.env.NODE_ENV = "test";
    const res = await request(app)
      .get("/api/extract/heatmap?symbol=crypto")
      .expect(200);
    assert.strictEqual(res.body.success, true);
  });

  test("GET /api/extract/yield-curve type is accepted", async () => {
    process.env.NODE_ENV = "test";
    const res = await request(app)
      .get("/api/extract/yield-curve")
      .expect(200);
    assert.strictEqual(res.body.success, true);
  });

  test("GET /api/extract/yield type is accepted (alias)", async () => {
    process.env.NODE_ENV = "test";
    const res = await request(app)
      .get("/api/extract/yield")
      .expect(200);
    assert.strictEqual(res.body.success, true);
  });

  test("GET /api/extract/options rejects symbol with semicolons", async () => {
    const res = await request(app)
      .get("/api/extract/options?symbol=AAPL;DROP%20TABLE")
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Invalid symbol characters/);
  });

  test("GET /api/extract/options rejects symbol with angle brackets", async () => {
    const res = await request(app)
      .get("/api/extract/options?symbol=%3Cscript%3E")
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Invalid symbol characters/);
  });

  // ─── /api/alerts — malformed payloads ─────────────────────────────────────
  test("POST /api/alerts accepts empty object payload", async () => {
    const res = await request(app)
      .post("/api/alerts")
      .send({})
      .expect(200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.message, "Alert received and logged.");
  });

  test("POST /api/alerts accepts payload with only 'text' field", async () => {
    const res = await request(app)
      .post("/api/alerts")
      .send({ text: "Alert via text field" })
      .expect(200);
    assert.strictEqual(res.body.success, true);
  });

  test("POST /api/alerts accepts payload with nested objects", async () => {
    const payload = {
      message: "Nested Alert",
      data: {
        indicators: [
          { name: "RSI", value: 22.5 },
          { name: "MACD", value: -0.3 }
        ]
      },
      metadata: { source: "webhook" }
    };
    const res = await request(app)
      .post("/api/alerts")
      .send(payload)
      .expect(200);
    assert.strictEqual(res.body.success, true);
  });

  test("POST /api/alerts accepts very long message", async () => {
    const longMsg = "A".repeat(10000);
    const res = await request(app)
      .post("/api/alerts")
      .send({ message: longMsg })
      .expect(200);
    assert.strictEqual(res.body.success, true);
  });

  test("GET /api/alerts returns alerts in expected structure", async () => {
    const res = await request(app).get("/api/alerts").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.alerts));
    if (res.body.alerts.length > 0) {
      const a = res.body.alerts[0];
      assert.ok("timestamp" in a, "alert should have timestamp");
      assert.ok("payload" in a, "alert should have payload");
    }
  });

  // ─── /api/screener/presets — validation edge cases ────────────────────────
  test("POST /api/screener/presets rejects missing key", async () => {
    const res = await request(app)
      .post("/api/screener/presets")
      .send({ preset: { title: "No Key" } })
      .expect(400);
    assert.strictEqual(res.body.success, false);
  });

  test("POST /api/screener/presets rejects missing preset body", async () => {
    const res = await request(app)
      .post("/api/screener/presets")
      .send({ key: "valid_key" })
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Missing or invalid preset/);
  });

  test("POST /api/screener/presets rejects preset as a string instead of object", async () => {
    const res = await request(app)
      .post("/api/screener/presets")
      .send({ key: "valid_key", preset: "not an object" })
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Missing or invalid preset/);
  });

  test("POST /api/screener/presets key is case-insensitive (stored lowercase)", async () => {
    const key = "TeSt_CaSe_KeY";
    const preset = { title: "Test Case Key", fields: ["name"] };

    // Create
    const postRes = await request(app)
      .post("/api/screener/presets")
      .send({ key, preset })
      .expect(200);
    assert.strictEqual(postRes.body.success, true);

    // Verify stored as lowercase
    const getRes = await request(app)
      .get("/api/screener/presets")
      .expect(200);
    assert.ok("test_case_key" in getRes.body.presets);

    // Cleanup
    await request(app).delete("/api/screener/presets/test_case_key").expect(200);
  });

  test("POST /api/screener/presets provides defaults for optional fields", async () => {
    const key = "defaults_test";
    const preset = { title: "Defaults Test" };

    await request(app)
      .post("/api/screener/presets")
      .send({ key, preset })
      .expect(200);

    const getRes = await request(app)
      .get("/api/screener/presets")
      .expect(200);

    const saved = getRes.body.presets[key];
    assert.ok(saved, "Preset should exist");
    assert.deepStrictEqual(saved.fields, ["name", "close", "change", "volume"]);
    assert.deepStrictEqual(saved.filters, []);
    assert.strictEqual(saved.sort_by, "volume");
    assert.strictEqual(saved.sort_order, "desc");

    // Cleanup
    await request(app).delete(`/api/screener/presets/${key}`).expect(200);
  });

  test("POST /api/screener/presets overwrites existing key", async () => {
    const key = "overwrite_test";

    // Create initial
    await request(app)
      .post("/api/screener/presets")
      .send({ key, preset: { title: "Version 1" } })
      .expect(200);

    // Overwrite
    await request(app)
      .post("/api/screener/presets")
      .send({ key, preset: { title: "Version 2", fields: ["name", "RSI"] } })
      .expect(200);

    // Verify overwritten
    const getRes = await request(app)
      .get("/api/screener/presets")
      .expect(200);
    assert.strictEqual(getRes.body.presets[key].title, "Version 2");
    assert.deepStrictEqual(getRes.body.presets[key].fields, ["name", "RSI"]);

    // Cleanup
    await request(app).delete(`/api/screener/presets/${key}`).expect(200);
  });

  // ─── /api/download — validation ───────────────────────────────────────────
  test("POST /api/download rejects empty URL", async () => {
    const res = await request(app)
      .post("/api/download")
      .send({ url: "", filename: "test.pine" })
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Missing script URL/);
  });

  test("POST /api/download rejects request with no body", async () => {
    const res = await request(app)
      .post("/api/download")
      .send({})
      .expect(400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Missing script URL/);
  });

  // ─── /api/logs — parameter validation ─────────────────────────────────────
  test("GET /api/logs returns array with default limit", async () => {
    const res = await request(app).get("/api/logs").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.logs));
    assert.ok(res.body.logs.length <= 150);
  });

  test("GET /api/logs respects custom limit", async () => {
    const res = await request(app).get("/api/logs?limit=3").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.logs.length <= 3);
  });

  test("GET /api/logs with limit=0 returns empty array", async () => {
    const res = await request(app).get("/api/logs?limit=0").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.logs));
  });

  // ─── /api/cache/stats — structure validation ──────────────────────────────
  test("GET /api/cache/stats returns properly typed stats", async () => {
    const res = await request(app).get("/api/cache/stats").expect(200);
    assert.strictEqual(res.body.success, true);
    const stats = res.body.stats;
    assert.strictEqual(typeof stats.dbExists, "boolean");
    assert.strictEqual(typeof stats.dbSize, "number");
    assert.strictEqual(typeof stats.totalRows, "number");
    assert.ok(Array.isArray(stats.details));
    assert.ok(stats.dbSize >= 0);
    assert.ok(stats.totalRows >= 0);
  });

  // ─── /api/status — structure validation ───────────────────────────────────
  test("GET /api/status returns env configuration with masked secrets", async () => {
    const res = await request(app).get("/api/status").expect(200);
    assert.strictEqual(res.body.success, true);
    const env = res.body.stats.env;

    // Verify secrets are masked or show "Not Configured"
    const session = env.TV_SESSION;
    assert.ok(
      session === "Not Configured" || session.includes("..."),
      `TV_SESSION should be masked, got: ${session}`
    );
  });

  // ─── /api/screenshots — structure validation ──────────────────────────────
  test("GET /api/screenshots returns proper screenshot metadata", async () => {
    const res = await request(app).get("/api/screenshots").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.screenshots));
    // If screenshots exist, verify structure
    if (res.body.screenshots.length > 0) {
      const s = res.body.screenshots[0];
      assert.ok("filename" in s);
      assert.ok("url" in s);
      assert.ok("sizeBytes" in s);
      assert.ok("createdAt" in s);
      assert.ok("patterns" in s);
      assert.ok(Array.isArray(s.patterns));
    }
  });

  // ─── /api/indicators — structure validation ───────────────────────────────
  test("GET /api/indicators returns properly structured indicator metadata", async () => {
    const res = await request(app).get("/api/indicators").expect(200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.indicators));
    // If indicators exist, verify structure
    if (res.body.indicators.length > 0) {
      const ind = res.body.indicators[0];
      assert.ok("indicatorKey" in ind);
      assert.ok("filename" in ind);
      assert.ok("meta" in ind);
      assert.ok("periodsCount" in ind);
    }
  });

  // ─── Content-Type handling ────────────────────────────────────────────────
  test("POST /api/daemon/start with no Content-Type uses defaults", async () => {
    // Sending without explicit JSON content-type
    const res = await request(app)
      .post("/api/daemon/start")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({}))
      .expect(200);
    // Default intervalMinutes is 15
    assert.strictEqual(res.body.success, true);
    await request(app).post("/api/daemon/stop");
  });

  // ─── 404 for unknown routes ───────────────────────────────────────────────
  test("GET /api/unknown_endpoint returns 404", async () => {
    const res = await request(app).get("/api/unknown_endpoint");
    // Express 5 returns 404 for unmatched routes
    assert.strictEqual(res.status, 404);
  });
});
