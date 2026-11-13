// Read / save-new-version of a PRIVATE Pine script on the owner's TradingView account.
//
// Usage:
//   node pineSave.mjs get  <scriptId|name> [--out <file>]
//   node pineSave.mjs save <scriptId> --file <path> [--name <title>] [--yes] [--delay <ms>]
//
// `save` is DRY-RUN unless --yes is given. It never publishes or changes visibility.
// Credentials: TV_SESSION / TV_SESSION_SIGN from .env (never printed or logged).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE = "https://pine-facade.tradingview.com/pine-facade";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function lineDiffStats(oldSrc, newSrc) {
  const count = (s) => {
    const m = new Map();
    for (const l of s.split(/\r?\n/)) m.set(l, (m.get(l) || 0) + 1);
    return m;
  };
  const a = count(oldSrc), b = count(newSrc);
  let added = 0, removed = 0;
  for (const [l, n] of b) added += Math.max(0, n - (a.get(l) || 0));
  for (const [l, n] of a) removed += Math.max(0, n - (b.get(l) || 0));
  return { added, removed };
}

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Sequential HTTP client: one request at a time, delay between, abort on non-2xx.
export function createClient({ cookie, fetchFn = fetch, delayMs = 1000 }) {
  let last = 0;
  async function req(url, init = {}) {
    const wait = last + delayMs - Date.now();
    if (last && wait > 0) await sleep(wait);
    const res = await fetchFn(url, { ...init, headers: { cookie, ...(init.headers || {}) } });
    last = Date.now();
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).pathname}`);
    return res.json();
  }
  return {
    // VERIFIED (used by @mathieuc/tradingview getPrivateIndicators)
    listSaved: () => req(`${BASE}/list?filter=saved`),
    // VERIFIED live 2026-11-13 (GET /get/<id>/last returns `source`)
    getSource: async (id, version = "last") => {
      const d = await req(`${BASE}/get/${encodeURIComponent(id)}/${version}?no_4xx=true`);
      const src = d?.source ?? d?.scriptSource; // VERIFIED live 2026-11-13: field is `source`
      if (typeof src !== "string") throw new Error("Unexpected get response: no source");
      return src;
    },
    // ASSUMED (web-editor endpoint). Only `source` (+ optional name) is sent: no visibility fields.
    saveNext: (id, source, name) => {
      const qs = new URLSearchParams({ allow_overwrite: "true" });
      if (name) qs.set("name", name);
      const body = new URLSearchParams({ source });
      return req(`${BASE}/save/next/${encodeURIComponent(id)}?${qs}`, { method: "POST", body });
    },
  };
}

export async function resolveOwned(client, idOrName) {
  const list = await client.listSaved();
  const hit = list.find((s) => s.scriptIdPart === idOrName || s.scriptName === idOrName);
  if (!hit) throw new Error("Script not found among the account's saved (owned) scripts: refusing.");
  return { id: hit.scriptIdPart, name: hit.scriptName };
}

export async function runGet(client, idOrName, outFile) {
  const { id } = await resolveOwned(client, idOrName);
  const src = await client.getSource(id);
  const out = outFile || path.join("out", `${id.replace(/\W/g, "_")}.pine`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, src);
  return { id, out, bytes: Buffer.byteLength(src), sha256: sha256(src) };
}

export async function runSave(client, { id: idArg, file, name, yes = false, backupDir = path.join("out", "backups"), now = () => new Date() }) {
  const newSrc = fs.readFileSync(file, "utf8");
  const { id } = await resolveOwned(client, idArg);
  const current = await client.getSource(id);
  fs.mkdirSync(backupDir, { recursive: true });
  const ts = now().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(backupDir, `${id.replace(/\W/g, "_")}_${ts}.pine`);
  fs.writeFileSync(backup, current);
  const report = {
    id, backup, dryRun: !yes,
    bytes: Buffer.byteLength(newSrc), sha256: sha256(newSrc),
    diff: lineDiffStats(current, newSrc),
  };
  if (yes) report.saved = Boolean(await client.saveNext(id, newSrc, name));
  return report;
}

function parseArgs(argv) {
  const [mode, target, ...rest] = argv;
  const o = { mode, target, yes: false };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--yes") o.yes = true;
    else if (["--out", "--file", "--name", "--delay"].includes(rest[i])) o[rest[i].slice(2)] = rest[++i];
    else throw new Error(`Unknown argument: ${rest[i]}`);
  }
  return o;
}

async function main() {
  await import("dotenv/config");
  const o = parseArgs(process.argv.slice(2));
  const s = process.env.TV_SESSION, sig = process.env.TV_SESSION_SIGN || "";
  if (!s) throw new Error("TV_SESSION empty in .env");
  if (!["get", "save"].includes(o.mode) || !o.target) throw new Error("Usage: pineSave.mjs get|save <scriptId> [--file p] [--out p] [--name n] [--yes]");
  const cookie = `sessionid=${s}` + (sig ? `; sessionid_sign=${sig}` : "");
  const client = createClient({ cookie, delayMs: parseInt(o.delay || "1000", 10) });
  if (o.mode === "get") return console.log(await runGet(client, o.target, o.out));
  if (!o.file) throw new Error("save requires --file");
  const r = await runSave(client, { id: o.target, file: o.file, name: o.name, yes: o.yes });
  console.log(r);
  if (r.dryRun) console.log("DRY-RUN: nothing sent. Re-run with --yes to save.");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
}
