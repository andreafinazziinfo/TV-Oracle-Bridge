// Safe programmatic wrapper for executing PineTS (AGPL-3.0) 
// without including any copyleft code directly within our repository.
import { PineTS, Provider } from "pinets";
import fs from "node:fs";
import path from "node:path";

/**
 * Transpiles a local Pine Script file to JavaScript using the PineTS library.
 * 
 * @param {string} pineFilePath - Path to the input .pine file.
 * @returns {Promise<string>} - The transpiled JS code output.
 */
export function transpilePineScript(pineFilePath) {
  return new Promise((resolve, reject) => {
    const absPath = path.resolve(pineFilePath);
    if (!fs.existsSync(absPath)) {
      reject(new Error(`Input Pine Script file not found at: ${absPath}`));
      return;
    }

    console.log(`[PineTS Wrapper] Compiling Pine Script: ${absPath}`);
    try {
      const codeText = fs.readFileSync(absPath, "utf8");
      const p = new PineTS(Provider.Binance, "BTCUSDT", "1h", 1);
      p.run(codeText)
        .then(() => {
          resolve(p.transpiledCode ? p.transpiledCode.toString() : "");
        })
        .catch((err) => {
          reject(new Error(err.message));
        });
    } catch (err) {
      reject(new Error(`Failed to compile script: ${err.message}`));
    }
  });
}

// Self-run for testing
if (process.argv[1] && process.argv[1].endsWith("pineTranspilerWrapper.mjs")) {
  const targetFile = process.argv[2];
  if (!targetFile) {
    console.error("Usage: node pineTranspilerWrapper.mjs <file.pine>");
    process.exit(1);
  }

  transpilePineScript(targetFile)
    .then((jsCode) => {
      console.log("Transpilation successful! Output:\n");
      console.log(jsCode);
    })
    .catch((err) => {
      console.error("Transpilation failed:", err.message);
      process.exit(1);
    });
}
