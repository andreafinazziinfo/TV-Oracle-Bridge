import express from "express";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sqlite3 from "sqlite3"; // Use sqlite3 for database status check since we just installed it or can load it

const execFileAsync = promisify(execFile);
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
const localCfgPath = path.join(rootDir, "indicators.local.json");

// Middleware
app.use(express.json());
// Serve static client assets
app.use(express.static(path.join(rootDir, "dashboard/public")));
// Serve screenshots directly under /screenshots
app.use("/screenshots", express.static(screenshotsDir));

const statePath = path.join(rootDir, "daemon_state.json");

// Helper to save daemon state to disk
async function saveDaemonState() {
  try {
    const state = {
      isRunning: isDaemonRunning,
      intervalMinutes: currentIntervalMinutes
    };
    await fs.promises.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save daemon state:", err);
  }
}

// Helper: Mask session cookie
function maskSession(session) {
  if (!session) return "Not Configured";
  if (session.length <= 12) return "Configured (Too Short)";
  return `${session.substring(0, 6)}...${session.substring(session.length - 6)}`;
}

// Helper: Validate indicator key to prevent path traversal
function sanitizeKey(key) {
  if (!key || /[^a-zA-Z0-9_\-]/.test(key)) {
    return null;
  }
  return key;
}

// 0. GET /api/health - Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    node: process.version
  });
});

// GET /api/session/validate - Validate TradingView session cookie validity
app.get("/api/session/validate", async (req, res) => {
  try {
    const tvSession = process.env.TV_SESSION;
    const tvSessionSign = process.env.TV_SESSION_SIGN;
    
    if (!tvSession || tvSession === "Not Configured") {
      return res.json({
        success: true,
        valid: false,
        reason: "No TV_SESSION cookie configured in .env",
        countdownHtml: "<span class='badge badge-red'>Expired / Missing</span>"
      });
    }
    
    const signinUrl = "https://www.tradingview.com/accounts/signin/status/";
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Cookie": `sessionid=${tvSession}${tvSessionSign && tvSessionSign !== "Not Configured" ? '; sessionid_sign=' + tvSessionSign : ''}`
    };
    
    const response = await fetch(signinUrl, { headers });
    if (!response.ok) {
      return res.json({
        success: true,
        valid: false,
        reason: `TradingView API returned HTTP status ${response.status}`,
        countdownHtml: "<span class='badge badge-red'>Expired</span>"
      });
    }
    
    const data = await response.json();
    const username = data.user?.username;
    
    if (!username) {
      return res.json({
        success: true,
        valid: false,
        reason: "Invalid session cookie (unauthorized response from TradingView)",
        countdownHtml: "<span class='badge badge-red'>Expired</span>"
      });
    }
    
    let remainingDays = 90;
    const envPath = path.resolve("./.env");
    if (fs.existsSync(envPath)) {
      const stat = fs.statSync(envPath);
      const mtime = stat.mtime;
      const elapsedMs = Date.now() - mtime.getTime();
      const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
      remainingDays = Math.max(0, 90 - elapsedDays);
    }
    
    let colorClass = "green";
    if (remainingDays <= 1) {
      colorClass = "red";
    } else if (remainingDays <= 7) {
      colorClass = "yellow";
    }
    
    res.json({
      success: true,
      valid: true,
      username,
      remainingDays,
      countdownHtml: `<span class="badge badge-${colorClass}">${remainingDays.toFixed(1)} days remaining (${username})</span>`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/screener/preview - Proxy for screener preset queries
app.get("/api/screener/preview", async (req, res) => {
  try {
    const market = req.query.market || "crypto";
    const condition = req.query.condition || "top_volume";
    const limit = parseInt(req.query.limit || "15", 10);
    
    const { stdout } = await execFileAsync('python', ['screener.py', market, condition, limit.toString()], { cwd: rootDir });
    res.json({ success: true, markdown: stdout });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifier/test - Send a test notification to webhooks
app.post("/api/notifier/test", async (req, res) => {
  try {
    const msg = "🔔 [Test] This is a test notification from the TV-Oracle-Bridge Dashboard Technical Console.";
    await execFileAsync('python', ['notifier.py', msg], { cwd: rootDir });
    res.json({ success: true, message: "Test notification sent successfully." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/cache/stats - Retrieve database details
app.get("/api/cache/stats", async (req, res) => {
  try {
    const stats = {
      dbExists: fs.existsSync(dbPath),
      dbSize: 0,
      totalRows: 0,
      details: []
    };
    
    if (stats.dbExists) {
      const fsStats = fs.statSync(dbPath);
      stats.dbSize = fsStats.size;
      
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
      
      const getStats = () => {
        return new Promise((resolve, reject) => {
          db.all(`
            SELECT indicator_key, symbol, timeframe, COUNT(*) as count, MIN(time) as min_time, MAX(time) as max_time 
            FROM bars 
            GROUP BY indicator_key, symbol, timeframe
          `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      };
      
      const rows = await getStats();
      db.close();
      
      stats.details = rows.map(r => {
        stats.totalRows += r.count;
        return {
          indicatorKey: r.indicator_key,
          symbol: r.symbol,
          timeframe: r.timeframe,
          count: r.count,
          oldest: r.min_time ? new Date(r.min_time * 1000).toISOString() : "N/A",
          newest: r.max_time ? new Date(r.max_time * 1000).toISOString() : "N/A"
        };
      });
    }
    
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
        TV_SESSION_SIGN: maskSession(process.env.TV_SESSION_SIGN),
        TV_NOTIFIER_DISCORD_WEBHOOK: maskSession(process.env.TV_NOTIFIER_DISCORD_WEBHOOK),
        TV_NOTIFIER_TELEGRAM_TOKEN: maskSession(process.env.TV_NOTIFIER_TELEGRAM_TOKEN),
        TV_NOTIFIER_TELEGRAM_CHAT_ID: process.env.TV_NOTIFIER_TELEGRAM_CHAT_ID ? "Configured" : "Not Configured"
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
app.get("/api/indicators", async (req, res) => {
  try {
    if (!fs.existsSync(outDir)) {
      return res.json({ success: true, indicators: [] });
    }

    const files = fs.readdirSync(outDir);
    const indicators = [];

    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      // Exclude config or packages
      if (["package.json", "package-lock.json", "indicators.json", "indicators.local.json", "indicators.local.example.json", "daemon_state.json"].includes(f)) {
        continue;
      }

      const filePath = path.join(outDir, f);
      try {
        const fileContent = await fs.promises.readFile(filePath, "utf8");
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
app.get("/api/indicators/:key", async (req, res) => {
  try {
    const key = sanitizeKey(req.params.key);
    if (!key) {
      return res.status(400).json({ success: false, error: "Invalid indicator key." });
    }
    const filePath = path.join(outDir, `${key}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "Indicator cache file not found." });
    }
    const content = await fs.promises.readFile(filePath, "utf8");
    res.json({ success: true, data: JSON.parse(content) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. GET /api/docs - Search the Pine Script documentation database
app.get("/api/docs", async (req, res) => {
  try {
    const query = (req.query.q || "").trim().toLowerCase();
    
    if (!fs.existsSync(docsDbPath)) {
      return res.json({ 
        success: true, 
        warning: "Documentation database not compiled yet.", 
        docs: {} 
      });
    }

    const dbContent = await fs.promises.readFile(docsDbPath, "utf8");
    const docsDb = JSON.parse(dbContent);

    if (!query) {
      // Return a subset of documentation (first 100 entries)
      const keys = Object.keys(docsDb).slice(0, 100);
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
        if (count >= 150) break; // Limit search results to avoid sending massive payloads
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
    const { stdout, stderr } = await execFileAsync('node', ['remoteControl.mjs', 'download', url, scriptName], { cwd: rootDir });

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

// --- Background Caching Daemon and Notifier ---
let autoRefreshInterval = null;
let isDaemonRunning = false;
let daemonLogs = [];
let nextRunTime = null;
let currentIntervalMinutes = 15;

function logDaemon(msg) {
  const logStr = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(logStr);
  daemonLogs.push(logStr);
  if (daemonLogs.length > 200) daemonLogs.shift();
}

async function sendSystemNotification(msg) {
  try {
    await execFileAsync('python', ['notifier.py', msg], { cwd: rootDir });
  } catch (err) {
    // Ignore notification failures
  }
}

async function runRefreshCycle() {
  logDaemon("Starting background cache refresh cycle...");
  sendSystemNotification("⚡ [Auto-Refresher] Caching cycle started in background.");
  try {
    if (!fs.existsSync(localCfgPath)) {
      logDaemon("No indicators.local.json found. Skipping cycle.");
      sendSystemNotification("⚠️ [Auto-Refresher] Caching skipped: indicators.local.json not found.");
      return;
    }
    const cfgContent = await fs.promises.readFile(localCfgPath, "utf8");
    const cfg = JSON.parse(cfgContent);
    const keys = Object.keys(cfg);
    logDaemon(`Found ${keys.length} indicators in config: ${keys.join(", ")}`);
    
    for (const key of keys) {
      logDaemon(`Refreshing cache for indicator: ${key}...`);
      // We call fetchIndicator.mjs with range 100 and waitMs 8000 for fast delta-sync
      try {
        const { stdout } = await execFileAsync('node', ['fetchIndicator.mjs', key, '100', '8000'], { cwd: rootDir });
        logDaemon(`Success: Refreshed '${key}'.`);
      } catch (err) {
        logDaemon(`Error: Failed refreshing '${key}': ${err.message}`);
        sendSystemNotification(`❌ [Auto-Refresher] Failed refreshing '${key}': ${err.message}`);
      }
    }
    logDaemon("Background cache refresh cycle completed.");
    sendSystemNotification("✅ [Auto-Refresher] Background caching cycle completed successfully.");
  } catch (err) {
    logDaemon(`Refresh cycle error: ${err.message}`);
    sendSystemNotification(`❌ [Auto-Refresher] Caching cycle error: ${err.message}`);
  }
}

// 6. GET /api/daemon/status - Retrieve background auto-refresher status and logs
app.get("/api/daemon/status", (req, res) => {
  res.json({
    success: true,
    isRunning: isDaemonRunning,
    intervalMinutes: currentIntervalMinutes,
    nextRun: nextRunTime ? nextRunTime.toISOString() : null,
    logs: daemonLogs
  });
});

// 7. POST /api/daemon/start - Start the background caching daemon
app.post("/api/daemon/start", async (req, res) => {
  if (isDaemonRunning) {
    return res.json({ success: true, message: "Daemon is already running." });
  }
  const mins = parseInt(req.body.intervalMinutes ?? "15", 10);
  if (isNaN(mins) || mins < 1 || mins > 1440) {
    return res.status(400).json({ success: false, error: "intervalMinutes must be between 1 and 1440." });
  }
  currentIntervalMinutes = mins;
  isDaemonRunning = true;
  logDaemon(`Daemon started. Interval set to: ${mins} minutes.`);
  sendSystemNotification(`⚡ [Auto-Refresher] Background Caching Daemon started (Interval: ${mins}m).`);
  
  await saveDaemonState();
  
  // Run first cycle immediately
  runRefreshCycle();
  
  // Schedule subsequent cycles
  autoRefreshInterval = setInterval(() => {
    runRefreshCycle();
    nextRunTime = new Date(Date.now() + currentIntervalMinutes * 60 * 1000);
  }, currentIntervalMinutes * 60 * 1000);
  
  nextRunTime = new Date(Date.now() + currentIntervalMinutes * 60 * 1000);
  
  res.json({ success: true, message: "Daemon started successfully." });
});

// 8. POST /api/daemon/stop - Stop the background caching daemon
app.post("/api/daemon/stop", async (req, res) => {
  if (!isDaemonRunning) {
    return res.json({ success: true, message: "Daemon is not running." });
  }
  clearInterval(autoRefreshInterval);
  autoRefreshInterval = null;
  isDaemonRunning = false;
  nextRunTime = null;
  logDaemon("Daemon stopped.");
  sendSystemNotification("🛑 [Auto-Refresher] Background Caching Daemon stopped.");
  
  await saveDaemonState();
  
  res.json({ success: true, message: "Daemon stopped successfully." });
});

if (process.argv[1] && (process.argv[1].endsWith("server.mjs") || process.argv[1].endsWith("server.js"))) {
  // Auto-load daemon state
  try {
    if (fs.existsSync(statePath)) {
      const stateContent = fs.readFileSync(statePath, "utf8");
      const state = JSON.parse(stateContent);
      if (state.isRunning) {
        currentIntervalMinutes = state.intervalMinutes || 15;
        isDaemonRunning = true;
        logDaemon(`Daemon auto-resuming from persisted state. Interval: ${currentIntervalMinutes}m`);
        
        // Run first cycle immediately
        runRefreshCycle();
        
        // Schedule subsequent cycles
        autoRefreshInterval = setInterval(() => {
          runRefreshCycle();
          nextRunTime = new Date(Date.now() + currentIntervalMinutes * 60 * 1000);
        }, currentIntervalMinutes * 60 * 1000);
        
        nextRunTime = new Date(Date.now() + currentIntervalMinutes * 60 * 1000);
        sendSystemNotification(`⚡ [Auto-Refresher] Background Caching Daemon auto-resumed (Interval: ${currentIntervalMinutes}m).`);
      }
    }
  } catch (err) {
    console.error("Failed to restore daemon state:", err);
  }
}

// Start listening if run directly
if (process.argv[1] && (process.argv[1].endsWith("server.mjs") || process.argv[1].endsWith("server.js"))) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 TV-Oracle-Bridge Dashboard Server running locally`);
    console.log(`🔗 Address: http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

export { app };
