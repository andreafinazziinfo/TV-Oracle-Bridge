#!/usr/bin/env bash
# Screener examples: manage presets and run a live preview.
# Prereq: `npm run dashboard` (http://localhost:5000).
set -euo pipefail

BASE="${BRIDGE_BASE_URL:-http://localhost:5000}"

echo "# List saved screener presets"
curl -s "$BASE/api/screener/presets"

echo "# Create / overwrite a preset"
curl -s -X POST "$BASE/api/screener/presets" \
  -H "Content-Type: application/json" \
  -d '{"key":"oversold_crypto","preset":{"market":"crypto","condition":"RSI<30","limit":25}}'

echo "# Live preview (proxies screener.py: market, condition, limit)"
curl -s "$BASE/api/screener/preview?market=crypto&condition=RSI%3C30&limit=10"

echo "# Delete the preset"
curl -s -X DELETE "$BASE/api/screener/presets/oversold_crypto"
