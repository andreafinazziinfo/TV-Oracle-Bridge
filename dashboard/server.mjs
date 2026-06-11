import express from "express";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import sqlite3 from "sqlite3"; // Use sqlite3 for database status check since we just installed it or can load it

const execPromise = promisify(exec);
const app = express();
const PORT = process.env.PORT || 5000;

// Resolve paths
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// On Windows, pathname might have a leading slash like /C:/path, we need to sanitize it
const rootDir = path.resolve(process.platform === "win32" ? import.meta.url.replace("file:///", "") : import.meta.url.replace("file://", ""), "../../");
const outDir = path.join(rootDir, "out");
const screenshotsDir = path.join(outDir, "screenshots");
const dbPath = path.join(outDir, "tv_oracle_cache.db");
const docsDbPath = path.join(rootDir, "pine_docs_db.json");

// Middleware
app.use(express.json());
// Serve static client assets
app.use(express.static(path.join(rootDir, "dashboard/public")));
// Serve screenshots directly under /screenshots
app.use("/screenshots", express.static(screenshotsDir));

// Helper: Mask session cookie
function maskSession(session) {
  if (!session) return "Not Configured";
  if (session.length <= 12) return "Configured (Too Short)";
  return `${session.substring(0, 6)}...${session.substring(session.length - 6)}`;
}

// 1. GET /api/status - Retrieve system configuration and cache stats
app.get("/api/status", async (req, res) => {
  try {
    const stats = {
      dbExists: fs.existsSync(dbPath),
      dbSize: 0,
      cachedBars: 0,
      env: {
        TV_SYMBOL: process.env.TV_SYMBOL || "Not Configured",
        TV_TIMEFRAME: process.env.TV_TIMEFRAME || "Not Configured",
        TV_BROWSER_TYPE: process.env.TV_BROWSER_TYPE || "chromium",
        TV_BROWSER_HEADLESS: process.env.TV_BROWSER_HEADLESS || "true",
        TV_SESSION: maskSession(process.env.TV_SESSION),
        TV_SESSION_SIGN: maskSession(process.env.TV_SESSION_SIGN)
      }
    };

    if (stats.dbExists) {
      const fsStats = fs.statSync(dbPath);
      stats.dbSize = fsStats.size;

      // Connect to SQLite to count records in the bars table
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
      const getBarsCount = () => {
        return new Promise((resolve) => {
          db.get("SELECT COUNT(*) as count FROM bars", (err, row) => {
            if (err) resolve(0);
            else resolve(row ? row.count : 0);
          });
        });
      };
      stats.cachedBars = await getBarsCount();
      db.close();
    }

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/screenshots - List screenshots in out/screenshots/
app.get("/api/screenshots", (req, res) => {
  try {
    if (!fs.existsSync(screenshotsDir)) {
      return res.json({ success: true, screenshots: [] });
    }

    const files = fs.readdirSync(screenshotsDir);
    const screenshots = files
      .filter(f => f.endsWith(".png") || f.endsWith(".jpg"))
      .map(f => {
        const filePath = path.join(screenshotsDir, f);
        const stat = fs.statSync(filePath);
        return {
          filename: f,
          url: `/screenshots/${f}`,
          sizeBytes: stat.size,
          createdAt: stat.birthtime || stat.mtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Newest first

    res.json({ success: true, screenshots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET /api/indicators - List indicator JSON data files in out/
app.get("/api/indicators", (req, res) => {
  try {
    if (!fs.existsSync(outDir)) {
      return res.json({ success: true, indicators: [] });
    }

    const files = fs.readdirSync(outDir);
    const indicators = [];

    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      // Exclude config or packages
      if (["package.json", "package-lock.json", "indicators.json", "indicators.local.json", "indicators.local.example.json"].includes(f)) {
        continue;
      }

      const filePath = path.join(outDir, f);
      try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(fileContent);
        
        // Basic duck-typing check to verify it contains TV oracle indicator structure
        if (data.chartOhlc || data.meta || data.periods) {
          indicators.push({
            indicatorKey: f.replace(".json", ""),
            filename: f,
            meta: data.meta || {},
            periodsCount: data.periodsCount || (data.periods ? data.periods.length : 0),
            inputs: data.inputs || {},
            lastUpdated: fs.statSync(filePath).mtime
          });
        }
      } catch (e) {
        // Skip malformed JSON
      }
    }

    res.json({ success: true, indicators });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper route to serve a specific indicator's full JSON
app.get("/api/indicators/:key", (req, res) => {
  try {
    const key = req.params.key;
    const filePath = path.join(outDir, `${key}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "Indicator cache file not found." });
    }
    const content = fs.readFileSync(filePath, "utf8");
    res.json({ success: true, data: JSON.parse(content) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET /api/docs - Search the Pine Script documentation database
app.get("/api/docs", (req, res) => {
  try {
    const query = (req.query.q || "").trim().toLowerCase();
    
    if (!fs.existsSync(docsDbPath)) {
      return res.json({ 
        success: true, 
        warning: "Documentation database not compiled yet.", 
        docs: {} 
      });
    }

    const dbContent = fs.readFileSync(docsDbPath, "utf8");
    const docsDb = JSON.parse(dbContent);

    if (!query) {
      // Return a subset of documentation (first 30 entries)
      const keys = Object.keys(docsDb).slice(0, 30);
      const docs = {};
      keys.forEach(k => { docs[k] = docsDb[k]; });
      return res.json({ success: true, total: Object.keys(docsDb).length, docs });
    }

    // Filter keys
    const matchedDocs = {};
    let count = 0;
    for (const [funcName, details] of Object.entries(docsDb)) {
      const matchName = funcName.toLowerCase().includes(query);
      const matchDesc = details.description && details.description.toLowerCase().includes(query);
      
      if (matchName || matchDesc) {
        matchedDocs[funcName] = details;
        count++;
        if (count >= 50) break; // Limit search results to avoid sending massive payloads
      }
    }

    res.json({ success: true, query, totalMatches: count, docs: matchedDocs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST /api/download - Download a public script using remoteControl.mjs
app.post("/api/download", async (req, res) => {
  try {
    const { url, filename } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: "Missing script URL." });
    }

    const scriptName = filename || `script_${Date.now()}.pine`;
    console.log(`[Dashboard API] Requesting download for URL: ${url} -> ${scriptName}`);

    // Command to execute remoteControl.mjs in download mode
    const cmd = `node remoteControl.mjs download "${url}" "${scriptName}"`;
    const { stdout, stderr } = await execPromise(cmd, { cwd: rootDir });

    if (stderr && stderr.includes("Error")) {
      return res.json({ success: false, error: stderr });
    }

    const savedPath = path.join(outDir, "downloads", scriptName);
    
    res.json({ 
      success: true, 
      message: "Script downloaded successfully.",
      filename: scriptName,
      path: savedPath,
      output: stdout
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 TV-Oracle-Bridge Dashboard Server running locally`);
  console.log(`🔗 Address: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
