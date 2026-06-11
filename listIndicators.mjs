// Enumerate the authenticated user's private/invite-only TradingView indicators.
// Output: id + version + name, so we can target each private indicator for the oracle.
// Run: npm run list
import "dotenv/config";
import TradingView from "@mathieuc/tradingview";

const session = (process.env.TV_SESSION || "").trim();
const signature = (process.env.TV_SESSION_SIGN || "").trim();

if (!session) {
  console.error("ERROR: TV_SESSION is empty in .env");
  process.exit(1);
}

try {
  const indicators = await TradingView.getPrivateIndicators(session, signature);
  if (!indicators || indicators.length === 0) {
    console.log("No private indicators found for this session.");
    console.log("Check: (1) sessionid is current, (2) the scripts are saved under this account.");
    process.exit(0);
  }
  console.log(`Found ${indicators.length} private indicator(s):\n`);
  for (const ind of indicators) {
    console.log(JSON.stringify({ id: ind.id, version: ind.version, name: ind.name, author: ind.author }, null, 2));
  }
} catch (err) {
  console.error("Failed to fetch private indicators:", err?.message || err);
  process.exit(2);
}
