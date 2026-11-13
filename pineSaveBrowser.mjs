// Save a new version of a PRIVATE Pine script by driving a real Chromium (UI automation, no header spoofing).
//
// Usage: node pineSaveBrowser.mjs --id "USER;..." --file out/new.pine [--yes] [--headed] [--shots dir]
// Dry-run by default: opens the editor, loads the source, stops before saving. --yes presses Ctrl+S.
// Stops (exit 2) on login wall / captcha / challenge. Cookies TV_SESSION / TV_SESSION_SIGN come from .env,
// are never printed. Never publishes, never changes visibility.
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");

export function parseArgs(argv) {
  const o = { yes: false, headed: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes") o.yes = true;
    else if (a === "--headed") o.headed = true;
    else if (["--id", "--file", "--shots"].includes(a)) o[a.slice(2)] = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!o.id || !o.file) throw new Error("Usage: pineSaveBrowser.mjs --id <scriptId> --file <path> [--yes] [--headed] [--shots dir]");
  return o;
}

class Blocked extends Error {}

async function main() {
  await import("dotenv/config");
  const o = parseArgs(process.argv.slice(2));
  const { chromium } = await import("playwright");
  const s = process.env.TV_SESSION, sig = process.env.TV_SESSION_SIGN || "";
  if (!s) throw new Error("TV_SESSION empty in .env");
  const text = fs.readFileSync(o.file, "utf8");
  const shot = async (page, n) => { if (o.shots) { fs.mkdirSync(o.shots, { recursive: true }); await page.screenshot({ path: `${o.shots}/${n}.png` }); } };

  const browser = await chromium.launch({ headless: !o.headed, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const base = { domain: ".tradingview.com", path: "/", secure: true, httpOnly: true, sameSite: "None" };
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://www.tradingview.com" });
    await ctx.addCookies([{ name: "sessionid", value: s, ...base }, ...(sig ? [{ name: "sessionid_sign", value: sig, ...base }] : [])]);
    const page = await ctx.newPage();
    await page.goto(`https://www.tradingview.com/pine/?id=${encodeURIComponent(o.id)}`, { waitUntil: "domcontentloaded" });
    await sleep(8000);
    await shot(page, "1-opened");
    const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
    if (/captcha|verify you are human|are you a robot|two-factor|2fa/.test(body)) throw new Blocked("captcha/2FA/challenge shown");
    // Monaco is not exposed as window.monaco on this page: drive it like a user (focus, select all, insert text).
    const editor = page.locator(".monaco-editor").first();
    try { await editor.waitFor({ timeout: 30000 }); } catch { throw new Blocked("Monaco editor not found (not logged in or UI changed)"); }
    const cookieBtn = page.getByRole("button", { name: "Accept all" });
    if (await cookieBtn.count()) await cookieBtn.first().click().catch(() => {});
    await editor.click({ position: { x: 600, y: 300 } });
    const first = await page.locator(".view-lines").first().innerText();
    if (!/Matassa|strategy\(|indicator\(|@version/.test(first)) throw new Blocked("target script not visible in editor");
    await page.keyboard.press("Control+a");
    // Paste via clipboard (one edit op, verbatim: no auto-indent / auto-close; insertText is far too slow on 200KB).
    await page.evaluate((t) => navigator.clipboard.writeText(t), text);
    await page.keyboard.press("Control+v");
    await sleep(5000);
    console.log(`editor loaded: ${text.length} chars from ${o.file} (sha256 ${sha256(text)})`);
    await shot(page, "2-loaded");
    if (!o.yes) return console.log("DRY-RUN: stopped before saving. Re-run with --yes to save.");
    await page.keyboard.press("Control+s");
    await sleep(10000);
    await shot(page, "3-saved");
    const after = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
    if (/captcha|verify you are human/.test(after)) throw new Blocked("challenge after save");
    console.log("Ctrl+S sent. Verify with: node pineSave.mjs get <id> --out out/after.pine");
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => { console.error(e instanceof Blocked ? "BLOCKED:" : "ERROR:", e.message); process.exit(e instanceof Blocked ? 2 : 1); });
}
