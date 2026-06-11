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
 * Launch the configured browser instance.
 */
export async function launchBrowser() {
  const launchOptions = {
    headless: HEADLESS,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process"
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
  
  // Navigate to TradingView chart
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  console.log("Page loaded. Waiting for indicators to render...");

  // Wait for the main chart canvas to be visible
  try {
    await page.waitForSelector("div.chart-markup-table, canvas.interactive-playground", { timeout: 15000 });
  } catch (e) {
    console.warn("Warning: Chart canvas selector timeout. Proceeding anyway.");
  }

  // Sleep an extra 5 seconds to let scripts compute and render fully
  await page.waitForTimeout(5000);

  // Define screenshot folder
  const outDir = path.resolve("./out/screenshots");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  const outputPath = path.join(outDir, outputName);

  // Capture the main chart area
  console.log("Capturing screenshot...");
  await page.screenshot({ path: outputPath, fullPage: false });
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

  return outputPath;
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
  
  if (actionType === "toggle_drawings") {
    console.log(`[Macro Engine] Action: Toggle drawings visibility`);
    // Alt + H is the hotkey to hide/show drawings
    await page.keyboard.press("Alt+H");
    await page.waitForTimeout(2000);
  }

  if (actionType === "save" || actionType === "change_symbol") {
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
  }
}

