#!/usr/bin/env node
/**
 * Idempotent patch for @mathieuc/tradingview's strategyReport parsing.
 *
 * The report blob is a raw **zlib** stream (magic 0x78 0x9c), but the lib feeds
 * it to JSZip (which expects a "PK" zip) -> "Can't find end of central directory"
 * -> the parse throws an *unhandled* rejection that killed the whole study fetch.
 * Fix #1 (protocol.js): inflate the blob with zlib (zip fallback kept) so
 * strategyReport.trades/performance actually populate. Fix #2 (study.js): keep
 * the call wrapped in try/catch so any future malformed chunk can't crash the stream.
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
    try {
      const buf = Buffer.from(data, 'base64');
      // TV streams the strategy report as a raw zlib stream (magic 0x78 0x9c),
      // NOT a zip archive — jszip throws "Can't find end of central directory".
      // Inflate it directly, then JSON.parse. Fall back to the legacy zip path
      // for any payload that really is a zip ("PK" = 0x50 0x4b).
      if (buf[0] === 0x78) {
        const zlib = require('zlib');
        return JSON.parse(zlib.inflateSync(buf).toString('utf8'));
      }
      const zip = new JSZip();
      return JSON.parse(
        await (await zip.loadAsync(data, { base64: true })).file('').async('text'),
      );
    } catch (e) {
      // PATCHED: malformed compressed chunk must not reject/crash the stream.
      return {};
    }
  },`,
    marker: "raw zlib stream (magic 0x78",
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
