import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { transpilePineScript } from "../../pineTranspilerWrapper.mjs";
import { refreshSession } from "../../session_helper.mjs";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(process.platform === "win32" ? import.meta.url.replace("file:///", "") : import.meta.url.replace("file://", ""), "../../../");

test("apply-lib-patch.mjs execution", async () => {
  // It should run without syntax errors and return success
  const scriptPath = path.join(rootDir, "apply-lib-patch.mjs");
  const { stdout, stderr } = await execFileAsync("node", [scriptPath], { cwd: rootDir });
  assert.match(stdout, /apply-lib-patch:/);
});

test("pineTranspilerWrapper.mjs error handling", async () => {
  // Rejects on non-existent file
  await assert.rejects(
    transpilePineScript("non_existent_file.pine"),
    /Input Pine Script file not found/
  );
});

test("listIndicators.mjs env constraints", async () => {
  const scriptPath = path.join(rootDir, "listIndicators.mjs");
  // Running with TV_SESSION empty should exit with code 1
  await assert.rejects(
    execFileAsync("node", [scriptPath], {
      cwd: rootDir,
      env: { ...process.env, TV_SESSION: "" }
    }),
    (err) => {
      assert.strictEqual(err.code, 1);
      assert.match(err.stderr, /ERROR: TV_SESSION is empty in .env/);
      return true;
    }
  );
});

test("fetchIndicator.mjs validation checks", async () => {
  const scriptPath = path.join(rootDir, "fetchIndicator.mjs");
  
  // Test invalid indicator key
  await assert.rejects(
    execFileAsync("node", [scriptPath, "invalidKey"], { cwd: rootDir }),
    (err) => {
      assert.strictEqual(err.code, 1);
      assert.match(err.stderr, /Unknown key 'invalidKey'/);
      return true;
    }
  );

  // Test missing TV_SESSION.
  // Provide a dummy pineId via env so the pineId resolution check passes and
  // execution reaches the TV_SESSION validation — keeps the test independent of
  // the gitignored indicators.local.json (which holds the private pineId mapping).
  await assert.rejects(
    execFileAsync("node", [scriptPath, "completa"], {
      cwd: rootDir,
      env: { ...process.env, TV_SESSION: "", TV_PINE_ID_COMPLETA: "DUMMY_PINE_ID" }
    }),
    (err) => {
      assert.strictEqual(err.code, 1);
      assert.match(err.stderr, /ERROR: TV_SESSION empty in .env/);
      return true;
    }
  );
});

test("session_helper exports refreshSession", () => {
  assert.strictEqual(typeof refreshSession, "function");
});
