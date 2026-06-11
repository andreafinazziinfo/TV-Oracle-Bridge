// Safe subprocess wrapper for executing PineTS (AGPL-3.0) 
// without including any copyleft code directly within our repository.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Transpiles a local Pine Script file to JavaScript using the external PineTS CLI.
 * Runs in an isolated subprocess via 'npx' to comply with licensing constraints.
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

    console.log(`[PineTS Wrapper] Launching transpiler for: ${absPath}`);

    // Execute 'npx -y @luxalgo/pinets transpile <file>'
    // -y automatically installs the package if not already cached
    const child = spawn("npx", ["-y", "@luxalgo/pinets", absPath], {
      shell: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Transpiler process exited with code ${code}.\nStderr:\n${stderr}`));
        return;
      }
      resolve(stdout);
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start transpiler subprocess: ${err.message}`));
    });
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
