import { test, describe } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "../../dashboard/server.mjs";

describe("Dashboard API Endpoints", () => {
  test("GET /api/health returns 200 and health info", async () => {
    const res = await request(app)
      .get("/api/health")
      .expect(200);
      
    assert.strictEqual(res.body.status, "ok");
    assert.strictEqual(typeof res.body.uptime, "number");
    assert.strictEqual(res.body.version, "1.2.0");
  });

  test("GET /api/session/validate runs successfully", async () => {
    const res = await request(app)
      .get("/api/session/validate")
      .expect(200);
      
    assert.strictEqual(res.body.success, true);
    assert.ok("valid" in res.body);
  });

  test("POST /api/daemon/start rejects invalid intervalMinutes", async () => {
    // intervalMinutes too large
    const resMax = await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: 2000 })
      .expect(400);
      
    assert.strictEqual(resMax.body.success, false);
    assert.match(resMax.body.error, /intervalMinutes must be between 1 and 1440/);

    // intervalMinutes zero
    const resZero = await request(app)
      .post("/api/daemon/start")
      .send({ intervalMinutes: 0 })
      .expect(400);
      
    assert.strictEqual(resZero.body.success, false);
    assert.match(resZero.body.error, /intervalMinutes must be between 1 and 1440/);
  });

  test("GET /api/indicators/:key rejects invalid keys (S3 Path Traversal check)", async () => {
    // Invalid key with path traversal characters
    const resTraversal = await request(app)
      .get("/api/indicators/..%2Fserver.mjs")
      .expect(400);
      
    assert.strictEqual(resTraversal.body.success, false);
    assert.match(resTraversal.body.error, /Invalid indicator key/);

    // Invalid key with special characters
    const resSpec = await request(app)
      .get("/api/indicators/completa$key")
      .expect(400);
      
    assert.strictEqual(resSpec.body.success, false);
    assert.match(resSpec.body.error, /Invalid indicator key/);
  });

  test("GET /api/cache/stats returns 200 and stats structure", async () => {
    const res = await request(app)
      .get("/api/cache/stats")
      .expect(200);
      
    assert.ok("dbExists" in res.body.stats);
    assert.ok("dbSize" in res.body.stats);
    assert.ok("totalRows" in res.body.stats);
    assert.ok(Array.isArray(res.body.stats.details));
  });

  test("GET /api/status returns system configuration and cache stats", async () => {
    const res = await request(app)
      .get("/api/status")
      .expect(200);
      
    assert.strictEqual(res.body.success, true);
    assert.ok("dbExists" in res.body.stats);
    assert.ok("cachedBars" in res.body.stats);
    assert.ok("env" in res.body.stats);
  });

  test("GET /api/screenshots returns list of screenshots", async () => {
    const res = await request(app)
      .get("/api/screenshots")
      .expect(200);
      
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.screenshots));
  });

  test("GET /api/indicators returns cached JSON indicator details", async () => {
    const res = await request(app)
      .get("/api/indicators")
      .expect(200);
      
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.indicators));
  });

  test("GET /api/docs performs documentation search", async () => {
    const res = await request(app)
      .get("/api/docs?q=ema")
      .expect(200);
      
    assert.strictEqual(res.body.success, true);
    assert.ok("docs" in res.body);
  });

  test("GET /api/daemon/status returns auto-refresher status", async () => {
    const res = await request(app)
      .get("/api/daemon/status")
      .expect(200);
      
    assert.strictEqual(res.body.success, true);
    assert.ok("isRunning" in res.body);
    assert.ok("intervalMinutes" in res.body);
    assert.ok(Array.isArray(res.body.logs));
  });

  test("POST /api/daemon/stop stops the daemon", async () => {
    const res = await request(app)
      .post("/api/daemon/stop")
      .expect(200);
      
    assert.strictEqual(res.body.success, true);
  });

  test("POST /api/download rejects request with missing URL", async () => {
    const res = await request(app)
      .post("/api/download")
      .send({ filename: "test.pine" })
      .expect(400);
      
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Missing script URL/);
  });
});
