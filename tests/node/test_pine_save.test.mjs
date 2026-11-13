import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient, runSave, runGet, lineDiffStats } from "../../pineSave.mjs";

const SRC_OLD = "//@version=5\nindicator('x')\nplot(close)\n";
const SRC_NEW = "//@version=5\nindicator('x')\nplot(open)\nplot(high)\n";

function mockFetch({ owned = true, status = 200 } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", body: init.body?.toString() });
    const json = (d, s = status) => ({ ok: s >= 200 && s < 300, status: s, json: async () => d });
    if (url.includes("/list")) return json(owned ? [{ scriptIdPart: "USER;abc", scriptName: "Mine" }] : []);
    if (url.includes("/get/")) return json({ scriptSource: SRC_OLD });
    if (url.includes("/save/next/")) return json({ success: true });
    return json({}, 404);
  };
  return { fn, calls };
}
const mk = (m) => createClient({ cookie: "c=x", fetchFn: m.fn, delayMs: 0 });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "pinesave-"));

test("diff stats", () => {
  assert.deepStrictEqual(lineDiffStats(SRC_OLD, SRC_NEW), { added: 2, removed: 1 });
});

test("dry-run: backs up, no POST, no source in report", async () => {
  const d = tmp(), f = path.join(d, "n.pine"); fs.writeFileSync(f, SRC_NEW);
  const m = mockFetch();
  const r = await runSave(mk(m), { id: "USER;abc", file: f, backupDir: d });
  assert.strictEqual(r.dryRun, true);
  assert.ok(!m.calls.some((c) => c.method === "POST"));
  assert.strictEqual(fs.readFileSync(r.backup, "utf8"), SRC_OLD);
  assert.ok(!JSON.stringify(r).includes("plot("));
});

test("--yes: POSTs source only, no visibility fields", async () => {
  const d = tmp(), f = path.join(d, "n.pine"); fs.writeFileSync(f, SRC_NEW);
  const m = mockFetch();
  const r = await runSave(mk(m), { id: "USER;abc", file: f, backupDir: d, yes: true });
  assert.strictEqual(r.saved, true);
  const post = m.calls.find((c) => c.method === "POST");
  assert.match(post.url, /save\/next\/USER%3Babc/);
  assert.deepStrictEqual([...new URLSearchParams(post.body).keys()], ["source"]);
  assert.ok(!/public|publish|visib/i.test(post.url + post.body.replace(/source=[^&]*/, "")));
});

test("refuses non-owned script, no POST", async () => {
  const d = tmp(), f = path.join(d, "n.pine"); fs.writeFileSync(f, SRC_NEW);
  const m = mockFetch({ owned: false });
  await assert.rejects(runSave(mk(m), { id: "PUB;zzz", file: f, backupDir: d, yes: true }), /refusing/);
  assert.ok(!m.calls.some((c) => c.method === "POST"));
});

test("aborts on non-2xx", async () => {
  const m = mockFetch({ status: 403 });
  await assert.rejects(mk(m).listSaved(), /HTTP 403/);
});

test("get resolves by name and writes file", async () => {
  const d = tmp(), out = path.join(d, "o.pine");
  const r = await runGet(mk(mockFetch()), "Mine", out);
  assert.strictEqual(fs.readFileSync(out, "utf8"), SRC_OLD);
  assert.strictEqual(r.id, "USER;abc");
});
