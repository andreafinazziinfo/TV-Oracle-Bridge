import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

/**
 * Launch a visible browser window to let the user log in to TradingView,
 * then capture the fresh session cookies and save them to .env.
 */
export async function refreshSession() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));
  console.log("\n==================================================================");
  console.log("🔑 TRADINGVIEW SESSION COOKIE REFRESHER");
  console.log("==================================================================\n");

  // Force launching a visible browser window for the user to interact
  console.log("Launching visible browser window...");
  
  // We use chromium launch options directly, overriding headless to false
  const BROWSER_PATH = process.env.TV_BROWSER_PATH || "";
  const BROWSER_TYPE = process.env.TV_BROWSER_TYPE || "chromium";
  
  // Import playwright launcher
  let playwrightBrowser;
  const launchOptions = {
    headless: false, // Must be visible for login
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  };
  
  if (BROWSER_PATH) {
    launchOptions.executablePath = BROWSER_PATH;
  }
  
  // Import dynamically
  const { chromium, firefox, webkit } = await import("playwright");
  
  switch (BROWSER_TYPE.toLowerCase()) {
    case "firefox":
      playwrightBrowser = await firefox.launch(launchOptions);
      break;
    case "webkit":
      playwrightBrowser = await webkit.launch(launchOptions);
      break;
    default:
      playwrightBrowser = await chromium.launch(launchOptions);
      break;
  }

  const context = await playwrightBrowser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  console.log("Navigating to TradingView Sign-in Page...");
  await page.goto("https://www.tradingview.com/#signin", { waitUntil: "domcontentloaded" });
  
  console.log("\n👉 ACTION REQUIRED:");
  console.log("1. In the browser window that just opened, log in to your TradingView account.");
  console.log("2. Solve any Captchas or input your 2FA security codes if prompted.");
  console.log("3. Once you are successfully logged in and see your home page, return here.");
  
  await askQuestion("\nPress [ENTER] here in the console once you have completed the login...");
  
  console.log("\nExtracting fresh session cookies...");
  const cookies = await context.cookies();
  
  const sessionCookie = cookies.find(c => c.name === "sessionid");
  const signCookie = cookies.find(c => c.name === "sessionid_sign");
  
  if (!sessionCookie) {
    console.error("❌ ERROR: Could not find 'sessionid' cookie. Did you log in successfully?");
    await playwrightBrowser.close();
    rl.close();
    process.exit(1);
  }
  
  const sessionVal = sessionCookie.value;
  const signVal = signCookie ? signCookie.value : "";
  
  console.log(`✅ sessionid captured: ${sessionVal.substring(0, 6)}...`);
  if (signVal) {
    console.log(`✅ sessionid_sign captured: ${signVal.substring(0, 6)}...`);
  } else {
    console.log("⚠️ sessionid_sign cookie was not found (optional for some accounts).");
  }

  // Validate session against TradingView API before saving
  console.log("Validating session cookies with TradingView status API...");
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Cookie": `sessionid=${sessionVal}${signVal ? '; sessionid_sign=' + signVal : ''}`
    };
    const checkRes = await fetch("https://www.tradingview.com/accounts/signin/status/", { headers });
    if (!checkRes.ok) {
      throw new Error(`TradingView status API returned HTTP status ${checkRes.status}`);
    }
    const checkData = await checkRes.json();
    const username = checkData.user?.username;
    if (!username) {
      throw new Error("TradingView status API returned empty/unauthorized user payload.");
    }
    console.log(`🎉 Session is VALID! Authenticated as user: ${username}`);
  } catch (err) {
    console.error(`❌ Session validation FAILED: ${err.message}`);
    console.error("The captured session cookies might not be authenticated yet or got blocked.");
    await playwrightBrowser.close();
    rl.close();
    process.exit(1);
  }
  
  // Read and update the .env file
  const envPath = path.resolve("./.env");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }
  
  // Parse and update variables
  let lines = envContent.split("\n");
  let hasSession = false;
  let hasSign = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("TV_SESSION=")) {
      lines[i] = `TV_SESSION=${sessionVal}`;
      hasSession = true;
    } else if (line.startsWith("TV_SESSION_SIGN=")) {
      lines[i] = `TV_SESSION_SIGN=${signVal}`;
      hasSign = true;
    }
  }
  
  if (!hasSession) {
    lines.push(`TV_SESSION=${sessionVal}`);
  }
  if (!hasSign && signVal) {
    lines.push(`TV_SESSION_SIGN=${signVal}`);
  }
  
  fs.writeFileSync(envPath, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
  console.log("\n💾 Local .env file updated successfully!");
  
  await playwrightBrowser.close();
  console.log("Browser window closed. Refresher completed.");
  rl.close();
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("session_helper.mjs")) {
  refreshSession()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Session refresh failed:", err);
      process.exit(1);
    });
}
