#!/usr/bin/env bash
# Alert ingestion: POST a TradingView-style alert payload to the bridge.
# Point your TradingView webhook (or any producer) at POST /api/alerts.
# Prereq: `npm run dashboard` (http://localhost:5000).
set -euo pipefail

BASE="${BRIDGE_BASE_URL:-http://localhost:5000}"

echo "# Ingest an alert (arbitrary JSON body is accepted and stored)"
curl -s -X POST "$BASE/api/alerts" \
  -H "Content-Type: application/json" \
  -d '{"message":"RSI oversold","symbol":"BINANCE:BTCUSDT","value":28.4}'

echo "# Retrieve recently ingested alerts"
curl -s "$BASE/api/alerts"
