#!/usr/bin/env node
/**
 * Idempotent patch for @mathieuc/tradingview: make the protocol parser resilient
 * to a malformed/oversized strategyReport blob (bad base64 / jszip "Can't find
 * end of central directory"). Without this the parse throws an *unhandled*
 * rejection that kills the whole study fetch (periods/plots/graphic lost).
 *
 * Re-applied automatically via the package.json `postinstall` hook so it survives
 * `npm install`. Safe to run multiple times.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ROOT = new URL("./node_modules/@mathieuc/tradingview/src/", import.meta.url);

const patches = [
  {
    file: new URL("protocol.js", ROOT),
    find: `  async parseCompressed(data) {
    const zip = new JSZip();
    return JSON.parse(
      await (
        await zip.loadAsync(data, { base64: true })
      ).file('').async('text'),
    );
  },`,
    replace: `  async parseCompressed(data) {
    const zip = new JSZip();
    try {
      return JSON.parse(
        await (
          await zip.loadAsync(data, { base64: true })
        ).file('').async('text'),
      );
    } catch (e) {
      // PATCHED: malformed compressed chunk must not reject/crash the stream.
      return {};
    }
  },`,
    marker: "// PATCHED: malformed compressed chunk",
  },
  {
    file: new URL("chart/study.js", ROOT),
    find: `          if (parsed.dataCompressed) {
            updateStrategyReport((await parseCompressed(parsed.dataCompressed)).report);
          }`,
    replace: `          if (parsed.dataCompressed) {
            try {
              updateStrategyReport((await parseCompressed(parsed.dataCompressed)).report);
            } catch (e) {
              /* PATCHED: skip malformed strategyReport blob, keep stream alive */
            }
          }`,
    marker: "/* PATCHED: skip malformed strategyReport blob",
  },
];

let applied = 0;
let skipped = 0;
for (const p of patches) {
  const path = p.file;
  if (!existsSync(path)) {
    console.warn(`apply-lib-patch: missing ${path.pathname} (lib not installed?)`);
    continue;
  }
  let src = readFileSync(path, "utf8");
  if (src.includes(p.marker)) {
    skipped += 1;
    continue;
  }
  if (!src.includes(p.find)) {
    console.warn(`apply-lib-patch: pattern not found in ${path.pathname} (lib version changed?)`);
    continue;
  }
  src = src.replace(p.find, p.replace);
  writeFileSync(path, src);
  applied += 1;
}
console.log(`apply-lib-patch: applied=${applied} already-patched=${skipped}`);
