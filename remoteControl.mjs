// Remote Control and screenshot utility using Playwright.
// Supports multi-browser (Chromium, Firefox, WebKit) and custom local installations (Brave/Chrome).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";

const BROWSER_TYPE = process.env.TV_BROWSER_TYPE || "chromium";
const BROWSER_PATH = process.env.TV_BROWSER_PATH || "";
const HEADLESS = process.env.TV_BROWSER_HEADLESS !== "false"; // default to true

/**
 * Retry helper utility to execute an operation multiple times on transient failures.
 */
async function withRetry(fn, maxAttempts = 3, delayMs = 2000) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[Retry Engine] Attempt ${attempt} failed: ${err.message}. Retrying in ${delayMs}ms...`);
      if (attempt < maxAttempts) {
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }
  throw lastError;
}

/**
 * Fallback selector chain to find a valid TradingView chart area.
 */
async function waitForChartSelector(page, timeoutMs = 15000) {
  const selectors = [
    "div.chart-markup-table",
    "canvas.interactive-playground",
    "div.layout__area--center",
    "div.chart-container-inner"
  ];
  
  const perSelectorTimeout = Math.floor(timeoutMs / selectors.length);
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: perSelectorTimeout });
      console.log(`[Selector Hardening] Chart canvas detected via selector: ${selector}`);
      return selector;
    } catch (e) {
      console.warn(`[Selector Hardening] Selector '${selector}' timed out. Trying next...`);
    }
  }
  throw new Error("All fallback chart selectors timed out. The TradingView chart DOM structure may have changed.");
}

/**
 * Launch the configured browser instance.
 */
export async function launchBrowser() {
  const launchOptions = {
    headless: HEADLESS,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ]
  };

  if (BROWSER_PATH) {
    launchOptions.executablePath = BROWSER_PATH;
    console.log(`Using custom browser executable: ${BROWSER_PATH}`);
  }

  let browser;
  switch (BROWSER_TYPE.toLowerCase()) {
    case "firefox":
      browser = await firefox.launch(launchOptions);
      break;
    case "webkit":
    case "safari":
      browser = await webkit.launch(launchOptions);
      break;
    case "chromium":
    case "chrome":
    case "brave":
    default:
      browser = await chromium.launch(launchOptions);
      break;
  }

  console.log(`Browser launched: ${BROWSER_TYPE} (headless: ${HEADLESS})`);
  return browser;
}

/**
 * Draw visual annotations on the screenshot using Chromium's HTML5 Canvas.
 */
async function annotateScreenshot(browser, imagePath, annotations) {
  if (!annotations || annotations.length === 0) return;
  console.log(`[Annotator] Drawing ${annotations.length} overlays on screenshot...`);
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const fileData = fs.readFileSync(imagePath);
  const base64Data = fileData.toString("base64");
  const imgDataUrl = `data:image/png;base64,${base64Data}`;
  
  const pageContent = `
    <html>
      <body style="margin:0; padding:0; overflow:hidden;">
        <canvas id="canvas"></canvas>
        <script>
          window.canvasDrawn = false;
          const img = new Image();
          img.src = "${imgDataUrl}";
          img.onload = () => {
            const canvas = document.getElementById("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            
            const annotations = ${JSON.stringify(annotations)};
            const chartStart = 60;
            const chartEnd = img.width - 90;
            const chartWidth = chartEnd - chartStart;
            const totalBars = 80;
            const barWidth = chartWidth / totalBars;
            
            annotations.forEach(ann => {
              const i = ann.barIndexFromRight;
              const x = chartEnd - (i * barWidth) - (barWidth / 2);
              
              ctx.fillStyle = ann.color || "rgba(255, 0, 0, 0.15)";
              ctx.fillRect(x - barWidth/2, 50, barWidth, img.height - 100);
              
              ctx.strokeStyle = ann.borderColor || "rgba(255, 0, 0, 0.6)";
              ctx.lineWidth = 2;
              ctx.strokeRect(x - barWidth/2, 50, barWidth, img.height - 100);
              
              const text = ann.label || "Alert";
              ctx.font = "bold 13px sans-serif";
              const textWidth = ctx.measureText(text).width;
              
              ctx.fillStyle = ann.borderColor || "rgba(255, 0, 0, 0.8)";
              ctx.fillRect(x - textWidth/2 - 5, 20, textWidth + 10, 24);
              
              ctx.fillStyle = "#ffffff";
              ctx.textAlign = "center";
              ctx.fillText(text, x, 36);
            });
            window.canvasDrawn = true;
          };
        </script>
      </body>
    </html>
  `;
  
  await page.setContent(pageContent);
  await page.waitForFunction(() => window.canvasDrawn === true);
  
  const canvasEl = await page.$("canvas");
  await canvasEl.screenshot({ path: imagePath });
  console.log(`[Annotator] Screenshot overwritten with annotations.`);
  await context.close();
}

/**
 * Capture a visual screenshot of a TradingView chart.
 * 
 * @param {string} symbol - E.g. "BINANCE:BTCUSDT"
 * @param {string} timeframe - E.g. "60" (minutes), "D" (day)
 * @param {string} outputName - E.g. "chart_btc.png"
 * @param {Array} annotations - Array of { barIndexFromRight: int, color: string, label: string }
 */
export async function captureChartScreenshot(symbol = "", timeframe = "", outputName = "screenshot.png", annotations = []) {
  const session = (process.env.TV_SESSION || "").trim();
  const signature = (process.env.TV_SESSION_SIGN || "").trim();
  const targetSymbol = symbol || process.env.TV_SYMBOL || "BINANCE:BTCUSDT";
  const targetTimeframe = timeframe || process.env.TV_TIMEFRAME || "60";

  if (!session) {
    throw new Error("TV_SESSION is missing in environment variables.");
  }

  const browser = await launchBrowser();
  
  // Set window size for high resolution capture
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.5 // 1.5x scaling for crisp chart graphics
  });

  // Inject authentication cookies
  const domain = ".tradingview.com";
  const cookies = [
    {
      name: "sessionid",
      value: session,
      domain: domain,
      path: "/",
      secure: true,
      httpOnly: true
    }
  ];

  if (signature) {
    cookies.push({
      name: "sessionid_sign",
      value: signature,
      domain: domain,
      path: "/",
      secure: true,
      httpOnly: true
    });
  }

  await context.addCookies(cookies);
  const page = await context.newPage();

  // URL format to open specific symbol/timeframe on the charting page
  const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(targetSymbol)}&interval=${targetTimeframe}`;
  console.log(`Navigating to: ${url}`);
  
  const outDir = path.resolve("./out/screenshots");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outputPath = path.join(outDir, outputName);

  await withRetry(async () => {
    // Navigate to TradingView chart
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    
    // Check if session is expired or redirects to signin
    const currentUrl = page.url();
    if (currentUrl.includes("/signin") || currentUrl.includes("/login") || await page.$("input[name='username'], input[type='password']")) {
      throw new Error("session expired: TradingView session is invalid or has expired.");
    }
    
    console.log("Page loaded. Waiting for indicators to render...");
    await waitForChartSelector(page, 15000);
    
    // Sleep an extra 5 seconds to let scripts compute and render fully
    await page.waitForTimeout(5000);

    // Capture the main chart area
    console.log("Capturing screenshot...");
    await page.screenshot({ path: outputPath, fullPage: false });
  }, 3, 2000);

  console.log(`Screenshot saved successfully to: ${outputPath}`);

  // Apply overlays if annotations are provided
  if (annotations && annotations.length > 0) {
    try {
      await annotateScreenshot(browser, outputPath, annotations);
    } catch (annErr) {
      console.error("[Annotator] Annotation failed:", annErr.message);
    }
  }

  await context.close();
  await browser.close();

  const sizeBytes = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
  
  // Return structured JSON metadata instead of plain string
  const metadata = {
    path: outputPath,
    symbol: targetSymbol,
    timeframe: targetTimeframe,
    timestamp: new Date().toISOString(),
    annotationsCount: annotations ? annotations.length : 0,
    sizeBytes: sizeBytes
  };

  return JSON.stringify(metadata);
}


/**
 * Open the chart, inject cookies, execute a specific macro (like change symbol, save, toggle drawings),
 * and capture a screenshot of the resulting state.
 */
export async function executeChartMacro(symbol = "", interval = "", actionType = "save", value = "") {
  const session = (process.env.TV_SESSION || "").trim();
  const signature = (process.env.TV_SESSION_SIGN || "").trim();
  const targetSymbol = symbol || process.env.TV_SYMBOL || "BINANCE:BTCUSDT";
  const targetTimeframe = interval || process.env.TV_TIMEFRAME || "60";

  if (!session) {
    throw new Error("TV_SESSION is missing in environment variables.");
  }

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const domain = ".tradingview.com";
  const cookies = [
    { name: "sessionid", value: session, domain, path: "/", secure: true, httpOnly: true }
  ];
  if (signature) {
    cookies.push({ name: "sessionid_sign", value: signature, domain, path: "/", secure: true, httpOnly: true });
  }

  await context.addCookies(cookies);
  const page = await context.newPage();

  const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(targetSymbol)}&interval=${targetTimeframe}`;
  console.log(`[Macro Engine] Opening chart: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  console.log(`[Macro Engine] Waiting for selector...`);
  try {
    await page.waitForSelector("div.chart-markup-table", { timeout: 15000 });
  } catch (e) {
    console.warn("Chart selector not found, attempting to proceed.");
  }
  await page.waitForTimeout(5000);

  // Focus the chart body before typing
  await page.click("body");
  await page.waitForTimeout(1000);

  if (actionType === "change_symbol") {
    const newSymbol = value || targetSymbol;
    console.log(`[Macro Engine] Action: Change symbol to ${newSymbol}`);
    // TradingView registers keyboard typing globally on the page to search symbols
    await page.keyboard.type(newSymbol);
    await page.waitForTimeout(1000);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5000); // Wait for new symbol data
  } 
  
  if (actionType === "change_timeframe") {
    const newInterval = value || interval || targetTimeframe;
    console.log(`[Macro Engine] Action: Change timeframe to ${newInterval}`);
    await page.keyboard.type(newInterval);
    await page.waitForTimeout(1000);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5000); // Wait for new timeframe data to render
  }

  if (actionType === "clear_all_drawings") {
    console.log(`[Macro Engine] Action: Clear all drawings`);
    let clicked = false;
    try {
      const removeBtn = await page.$('[data-name="remove"], [data-tooltip*="Remove"], [data-role="button"][data-name="remove"]');
      if (removeBtn) {
        await removeBtn.click();
        await page.waitForTimeout(1000);
        clicked = true;
        console.log(`[Macro Engine] Clicked remove button.`);
      }
    } catch (e) {
      console.warn(`[Macro Engine] Failed to click remove element:`, e.message);
    }
    if (!clicked) {
      console.log(`[Macro Engine] Trying keyboard shortcut for removing drawings (Alt+Control+Delete)`);
      await page.keyboard.press("Alt+Control+Delete");
      await page.waitForTimeout(1000);
    }
  }

  if (actionType === "toggle_drawings") {
    console.log(`[Macro Engine] Action: Toggle drawings visibility`);
    // Alt + H is the hotkey to hide/show drawings
    await page.keyboard.press("Alt+H");
    await page.waitForTimeout(2000);
  }

  if (actionType === "save" || actionType === "change_symbol" || actionType === "change_timeframe" || actionType === "clear_all_drawings") {
    console.log(`[Macro Engine] Action: Save layout (Ctrl + S)`);
    await page.keyboard.press("Control+S");
    await page.waitForTimeout(3000);
  }

  // Define screenshot folder
  const outDir = path.resolve("./out/screenshots");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const name = `macro_${actionType}_${Date.now()}.png`;
  const outputPath = path.join(outDir, name);

  console.log(`[Macro Engine] Capturing confirmation screenshot...`);
  await page.screenshot({ path: outputPath });
  console.log(`[Macro Engine] Done! Saved screenshot to: ${outputPath}`);

  await context.close();
  await browser.close();

  return { outputPath, screenshotName: name };
}

/**
 * Navigate to TradingView page and extract structured market data (options, heatmaps, or yield curves).
 */
export async function extractStructuredData(type, symbol = "") {
  if (process.env.NODE_ENV === "test") {
    console.log(`[Extractor] Test mode: returning mocked response for ${type}`);
    const mockResponses = {
      options: JSON.stringify({ symbol: symbol || "AAPL", status: "mocked", options: [] }),
      heatmap: JSON.stringify({ type: symbol || "stock", status: "mocked", data: [] }),
      "yield-curve": JSON.stringify({ country: "US", status: "mocked", yields: {} })
    };
    return mockResponses[type] || JSON.stringify({ status: "mocked" });
  }

  const session = (process.env.TV_SESSION || "").trim();
  const signature = (process.env.TV_SESSION_SIGN || "").trim();

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const domain = ".tradingview.com";
  const cookies = [];
  if (session) {
    cookies.push({ name: "sessionid", value: session, domain, path: "/", secure: true, httpOnly: true });
  }
  if (signature) {
    cookies.push({ name: "sessionid_sign", value: signature, domain, path: "/", secure: true, httpOnly: true });
  }
  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }

  const page = await context.newPage();

  let targetUrl = "";
  let pattern = "";

  if (type === "options") {
    const sym = symbol || "NASDAQ-AAPL";
    targetUrl = `https://www.tradingview.com/symbols/${encodeURIComponent(sym)}/options/`;
    pattern = "options-api";
  } else if (type === "heatmap") {
    const cat = symbol || "stock";
    targetUrl = `https://www.tradingview.com/heatmap/${encodeURIComponent(cat)}/`;
    pattern = "scanner.tradingview.com";
  } else if (type === "yield-curve" || type === "yield") {
    targetUrl = "https://www.tradingview.com/yield-curve/";
    pattern = "yield";
  } else {
    throw new Error(`Unsupported extraction type: ${type}`);
  }

  console.log(`[Extractor] Navigating to: ${targetUrl} (listening for response pattern: ${pattern})`);

  let capturedData = null;
  const responsePromise = new Promise((resolve) => {
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes(pattern) || (type === "heatmap" && url.includes("/scan")) || (type === "yield-curve" && (url.includes("yield") || url.includes("bonds")))) {
        try {
          const text = await response.text();
          try {
            JSON.parse(text);
            capturedData = text;
            console.log(`[Extractor] Successfully captured matching response: ${url.substring(0, 100)}`);
            resolve();
          } catch (je) {
            // Not valid JSON, ignore
          }
        } catch (e) {
          // ignore body read errors
        }
      }
    });
  });

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    // Sleep a bit to trigger API request
    await page.waitForTimeout(3000);
    
    await Promise.race([
      responsePromise,
      page.waitForTimeout(12000)
    ]);
  } catch (err) {
    console.warn(`[Extractor] Navigation/extraction warning: ${err.message}`);
  }

  await context.close();
  await browser.close();

  if (!capturedData) {
    throw new Error(`Failed to capture structured data for ${type} (pattern: ${pattern})`);
  }

  return capturedData;
}

/**
 * Navigate to a public TradingView script detail page, extract its Pine Script code,
 * and save it to out/downloads/<outputName>.
 */
export async function downloadPublicScript(scriptUrl, outputName = "downloaded_script.pine") {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  console.log(`[Downloader] Navigating to public script: ${scriptUrl}`);
  await page.goto(scriptUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  
  // Wait for the page code element or state to load
  console.log("[Downloader] Waiting for code element...");
  
  let codeText = "";
  try {
    await page.waitForTimeout(5000); // Wait for React hydration
    
    // Click "Source code" tab to load the code in DOM
    console.log("[Downloader] Clicking Source code tab...");
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("button, a, span, div"));
      const srcBtn = elements.find(el => el.textContent && el.textContent.trim().toLowerCase() === "source code");
      if (srcBtn) {
        srcBtn.click();
      }
    });
    await page.waitForTimeout(2000); // Wait for code panel to open
    
    // Attempt DOM-based source code extraction
    codeText = await page.evaluate(() => {
      // Look for standard code elements first, skipping line number containers
      const elements = Array.from(document.querySelectorAll("pre, code, textarea, div.tv-script-details__code, .script-code, [class*='code'], [class*='source']"));
      for (const el of elements) {
        const className = (el.className || "").toString();
        if (className.includes("Container") || className.includes("num") || className.includes("line")) {
          continue;
        }
        const txt = el.innerText || el.textContent || "";
        const hasPineKeywords = txt.includes("//@version=") || txt.includes("study(") || txt.includes("indicator(") || txt.includes("strategy(") || txt.includes("library(");
        if (hasPineKeywords && txt.length > 100) {
          return txt;
        }
      }
      
      // Fallback 1: search body text for Pine-like blocks
      const bodyText = document.body.innerText || "";
      const match = bodyText.match(/(\/\/@version=|study\(|indicator\(|strategy\()[\s\S]+/);
      if (match) {
        return match[0];
      }
      return "";
    });
    
    // Fallback 2: Check global script tags for json-state sourceCode
    if (!codeText) {
      codeText = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll("script"));
        for (const s of scripts) {
          const txt = s.textContent || "";
          if (txt.includes("sourceCode") && (txt.includes("//@version") || txt.includes("study(") || txt.includes("indicator("))) {
            const match = txt.match(/"sourceCode"\s*:\s*"([^"]+)"/);
            if (match) {
              try {
                return JSON.parse(`"${match[1]}"`);
              } catch (e) {
                // Decode manually if JSON parse fails
                return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
              }
            }
          }
        }
        return "";
      });
    }
    
    // Clean up non-breaking spaces and line-endings
    if (codeText) {
      codeText = codeText.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n");
    }
  } catch (err) {
    console.error("[Downloader] Error evaluating script page:", err.message);
  }
  
  await context.close();
  await browser.close();
  
  if (!codeText) {
    throw new Error("Could not find Pine Script code block starting with '//@version=' on the page. Ensure the script is open-source and has public code visibility.");
  }
  
  const outDir = path.resolve("./out/downloads");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outputPath = path.join(outDir, outputName);
  fs.writeFileSync(outputPath, codeText, "utf8");
  console.log(`[Downloader] Script saved successfully to: ${outputPath}`);
  return outputPath;
}

// Self-run capability for manual command line execution
if (process.argv[1] && process.argv[1].endsWith("remoteControl.mjs")) {
  const action = process.argv[2] || "screenshot";
  const sym = process.argv[3];
  const tf = process.argv[4];
  const name = process.argv[5] || "manual_capture.png";

  if (action === "screenshot") {
    const annotationsJson = process.argv[6] || "[]";
    let annotations = [];
    try {
      annotations = JSON.parse(annotationsJson);
    } catch (e) {
      console.error("Failed to parse annotations JSON:", e.message);
    }
    
    console.log(`Starting manual screenshot: symbol=${sym || "default"}, timeframe=${tf || "default"}, annotations=${annotations.length}`);
    captureChartScreenshot(sym, tf, name, annotations)
      .then((path) => console.log(`Done! Path: ${path}`))
      .catch((err) => {
        console.error("Failed to capture screenshot:", err);
        process.exit(1);
      });
  } else if (action === "macro") {
    const macroType = process.argv[3] || "save";
    const val = process.argv[4] || "";
    console.log(`Starting macro: type=${macroType}, value=${val}`);
    executeChartMacro(sym, tf, macroType, val)
      .then((res) => console.log(`Done! Screenshot saved to: ${res.outputPath}`))
      .catch((err) => {
        console.error("Macro failed:", err);
        process.exit(1);
      });
  } else if (action === "download") {
    const urlVal = process.argv[3];
    const outName = process.argv[4] || "downloaded.pine";
    console.log(`Starting manual public script download: url=${urlVal}, output=${outName}`);
    downloadPublicScript(urlVal, outName)
      .then((path) => console.log(`Done! Path: ${path}`))
      .catch((err) => {
        console.error("Download failed:", err);
        process.exit(1);
      });
  } else if (action === "extract") {
    const typeVal = process.argv[3];
    const sym = process.argv[4] || "";
    console.log(`Starting manual data extraction: type=${typeVal}, symbol=${sym}`);
    extractStructuredData(typeVal, sym)
      .then((res) => {
        console.log(res);
        process.exit(0);
      })
      .catch((err) => {
        console.error("Extraction failed:", err);
        process.exit(1);
      });
  }
}

