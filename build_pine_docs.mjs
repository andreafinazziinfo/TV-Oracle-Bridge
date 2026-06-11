import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "./remoteControl.mjs";

const OUTPUT_PATH = path.resolve("./pine_docs_db.json");

// High-quality baseline database of core functions (Fase 3 backup)
const BASELINE_DOCS = {
  "ta.sma": {
    "syntax": "ta.sma(source, length) → series float",
    "description": "Simple Moving Average. Returns the moving average of a series of values over a specified number of bars.",
    "arguments": [
      {"name": "source", "type": "series float", "desc": "Series of values to process."},
      {"name": "length", "type": "simple int", "desc": "Number of bars (length)."}
    ],
    "example": "plot(ta.sma(close, 20))"
  },
  "ta.ema": {
    "syntax": "ta.ema(source, length) → series float",
    "description": "Exponential Moving Average. Returns the exponentially weighted moving average, giving more weight to recent prices.",
    "arguments": [
      {"name": "source", "type": "series float", "desc": "Series of values to process."},
      {"name": "length", "type": "simple int", "desc": "Number of bars."}
    ],
    "example": "plot(ta.ema(close, 14))"
  },
  "ta.wma": {
    "syntax": "ta.wma(source, length) → series float",
    "description": "Weighted Moving Average. Returns the weighted moving average of source with weights decreasing linearly.",
    "arguments": [
      {"name": "source", "type": "series float", "desc": "Series of values to process."},
      {"name": "length", "type": "simple int", "desc": "Number of bars."}
    ],
    "example": "plot(ta.wma(close, 15))"
  },
  "ta.hma": {
    "syntax": "ta.hma(source, length) → series float",
    "description": "Hull Moving Average. A fast and smooth moving average calculated using weighted moving averages of half and full lengths.",
    "arguments": [
      {"name": "source", "type": "series float", "desc": "Series of values to process."},
      {"name": "length", "type": "simple int", "desc": "Number of bars."}
    ],
    "example": "plot(ta.hma(close, 9))"
  },
  "ta.rsi": {
    "syntax": "ta.rsi(source, length) → series float",
    "description": "Relative Strength Index. Measures the speed and change of price movements, oscillator ranging between 0 and 100.",
    "arguments": [
      {"name": "source", "type": "series float", "desc": "Series of values to process."},
      {"name": "length", "type": "simple int", "desc": "RSI period."}
    ],
    "example": "rsiVal = ta.rsi(close, 14)\nplot(rsiVal)"
  },
  "ta.macd": {
    "syntax": "ta.macd(source, fast, slow, signal) → [series float, series float, series float]",
    "description": "Moving Average Convergence Divergence. Returns the MACD line, signal line, and histogram value.",
    "arguments": [
      {"name": "source", "type": "series float", "desc": "Series of values."},
      {"name": "fast", "type": "simple int", "desc": "Fast EMA length."},
      {"name": "slow", "type": "simple int", "desc": "Slow EMA length."},
      {"name": "signal", "type": "simple int", "desc": "Signal smoothing length."}
    ],
    "example": "[macdLine, signalLine, histLine] = ta.macd(close, 12, 26, 9)"
  },
  "ta.atr": {
    "syntax": "ta.atr(length) → series float",
    "description": "Average True Range. Returns the exponential moving average of the true range of the bars.",
    "arguments": [
      {"name": "length", "type": "simple int", "desc": "Number of bars (length)."}
    ],
    "example": "plot(ta.atr(14))"
  },
  "strategy.entry": {
    "syntax": "strategy.entry(id, direction, qty, limit, stop, comment, alert_message) → void",
    "description": "Submits an entry order command to enter market position.",
    "arguments": [
      {"name": "id", "type": "const string", "desc": "Order identifier."},
      {"name": "direction", "type": "strategy.long/strategy.short", "desc": "Long/Short bias."}
    ],
    "example": "strategy.entry('BuyCall', strategy.long)"
  },
  "strategy.close": {
    "syntax": "strategy.close(id, comment, alert_message) → void",
    "description": "Command to close/exit a specific market entry order immediately on market open.",
    "arguments": [
      {"name": "id", "type": "const string", "desc": "The entry order ID to close."}
    ],
    "example": "strategy.close('BuyCall')"
  }
};

/**
 * Scrapes all function entries from TradingView Pine Script Reference page using Playwright.
 */
async function crawlReferenceManual() {
  console.log("Starting Option B: Crawling TradingView Pine Script v6 Reference Manual...");
  
  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const url = "https://www.tradingview.com/pine-script-reference/v6/";
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    
    console.log("Page loaded. Waiting for reference manual container to render...");
    await page.waitForSelector("a[href*='#fun_']", { state: "attached", timeout: 15000 });
    
    // Extract list of all function hashes from the sidebar
    const items = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href*='#fun_']"));
      return links.map(lnk => {
        const href = lnk.getAttribute("href") || "";
        const hash = href.substring(href.indexOf("#"));
        const name = lnk.textContent.trim();
        return { name, hash };
      });
    });
    console.log(`Found ${items.length} functions in sitemap.`);
    
    // Filter out duplicate hashes to speed up documentation extraction
    const seenHashes = new Set();
    const uniqueItems = [];
    for (const item of items) {
      if (!seenHashes.has(item.hash)) {
        seenHashes.add(item.hash);
        uniqueItems.push(item);
      }
    }
    console.log(`Filtered to ${uniqueItems.length} unique function entries.`);
    
    if (uniqueItems.length === 0) {
      throw new Error("No function links found in sitemap.");
    }
    
    const db = { ...BASELINE_DOCS };
    let count = 0;
    
    // Scrape details for each function
    // To be fast, we click sidebar items locally in the SPA DOM
    for (const item of uniqueItems) {
      try {
        const hash = item.hash;
        const cleanName = item.name;
        
        console.log(`[Crawler] Scrapes: ${cleanName} (${hash})`);
        
        // Trigger hash change to load SPA details instantly
        await page.evaluate((h) => {
          window.location.hash = h;
        }, hash);
        
        // Small wait for UI state updates
        await page.waitForTimeout(100);
        
        // Extract syntax, description, arguments and example from the DOM
        const detail = await page.evaluate((name) => {
          // Find active card or content div containing our hash ID
          const idVal = window.location.hash.substring(1);
          const block = document.getElementById(idVal) || document.querySelector(`[id*="${idVal}"]`) || document.body;
          
          // Selectors based on TV DOM layout
          // Title
          const titleEl = block.querySelector(".tv-reference-page__title, h1, h2, .tv-pine-reference-title");
          const title = titleEl ? titleEl.textContent.trim() : name;
          
          // Syntax (usually inside code block or pre)
          const syntaxEl = block.querySelector(".tv-reference-page__syntax, pre, code, .tv-pine-reference-syntax");
          const syntax = syntaxEl ? syntaxEl.textContent.trim() : "";
          
          // Description
          const descEl = block.querySelector(".tv-reference-page__description, p, .tv-pine-reference-description");
          const description = descEl ? descEl.textContent.trim() : "";
          
          // Arguments
          const args = [];
          const rows = block.querySelectorAll("table tr, ul li, .tv-pine-reference-param");
          rows.forEach(row => {
            const cells = row.querySelectorAll("td");
            if (cells.length >= 2) {
              const argName = cells[0].textContent.trim();
              const argDesc = cells[1].textContent.trim();
              args.push({ name: argName, type: "any", desc: argDesc });
            }
          });
          
          // Example
          const examples = [];
          block.querySelectorAll("pre, code, .tv-pine-reference-example").forEach(el => {
            const txt = el.textContent.trim();
            if (txt.includes("//@version") || txt.includes("indicator") || txt.includes("plot")) {
              examples.push(txt);
            }
          });
          const example = examples.length > 0 ? examples[0] : "";
          
          return {
            syntax: syntax || `${name}()`,
            description: description || "Reference documentation for " + name,
            arguments: args,
            example: example || "//@version=5\n" + name + "()"
          };
        }, cleanName);
        
        db[cleanName] = detail;
        count++;
        
        // Break early if we have crawled enough items to be complete, to save time during tests
        // Comment out this limiter for a full dump
        // if (count >= 150) {
        //   console.log("[Crawler] Reached limit of 150 functions for quick bootstrap. Completing...");
        //   break;
        // }
      } catch (err) {
        console.error(`Failed to scrape details for ${item.name}:`, err.message);
      }
    }
    
    console.log(`Option B successfully completed! Scraped ${count} functions.`);
    return db;
  } catch (err) {
    console.error("Option B (Live Scraper) failed:", err.message);
    console.log("Falling back entirely to Baseline Docs.");
    return BASELINE_DOCS;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function run() {
  console.log("==================================================================");
  console.log("🛠️ PINE SCRIPT DOCUMENTATION DATABASE COMPILER");
  console.log("==================================================================\n");
  
  let database = { ...BASELINE_DOCS };
  
  // Option A: Try to fetch pre-compiled definitions from GitHub
  const urls = [
    "https://raw.githubusercontent.com/iamrichardD/mcp-server-pinescript/main/src/pinescript_mcp/reference.json",
    "https://raw.githubusercontent.com/iamrichardD/mcp-server-pinescript/main/src/pinescript_mcp/languageReference.json",
    "https://raw.githubusercontent.com/iamrichardD/mcp-server-pinescript/main/src/data/reference.json",
    "https://raw.githubusercontent.com/iamrichardD/mcp-server-pinescript/main/docs/languageReference.json",
    "https://raw.githubusercontent.com/iamrichardD/mcp-server-pinescript/main/reference.json"
  ];

  for (const url of urls) {
    try {
      console.log(`Starting Option A: Fetching pre-compiled signatures from ${url}...`);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === "object") {
          console.log(`Option A success! Loaded functions from community MCP.`);
          // Map data structure into our format
          const targetData = data.functions || data.reference || data;
          for (const [k, v] of Object.entries(targetData)) {
            if (typeof v === "object") {
              database[k] = {
                syntax: v.syntax || k,
                description: v.description || "",
                arguments: v.arguments || [],
                example: v.example || ""
              };
            }
          }
          break; // Stop trying URLs once we succeed
        }
      } else {
        console.log(`Option A fetch returned status: ${response.status}. Trying next URL.`);
      }
    } catch (err) {
      console.log(`Option A failed for ${url}: ${err.message}. Trying next URL.`);
    }
  }
  
  // Option B: Run Live Scraper using Playwright
  const crawledDb = await crawlReferenceManual();
  database = { ...database, ...crawledDb };
  
  // Save database to output path
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(database, null, 2), "utf8");
  console.log(`\n💾 Complete database saved to: ${OUTPUT_PATH}`);
  console.log(`📊 Total functions stored: ${Object.keys(database).length}`);
}

run().catch(err => {
  console.error("Compilation failed:", err);
  process.exit(1);
});
