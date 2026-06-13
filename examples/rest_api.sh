#!/usr/bin/env bash
# REST API examples for the TV-Oracle-Bridge dashboard.
# Prereq: `npm run dashboard` (serves on http://localhost:5000).
set -euo pipefail

BASE="${BRIDGE_BASE_URL:-http://localhost:5000}"

echo "# Health check"
curl -s "$BASE/api/health" | head

echo "# System status (env config with masked secrets + cache stats)"
curl -s "$BASE/api/status"

echo "# Search the offline Pine Script docs database"
curl -s "$BASE/api/docs?q=ta.rsi"

echo "# List cached indicators (metadata only)"
curl -s "$BASE/api/indicators"

echo "# Transpile a Pine Script indicator to JavaScript"
curl -s -X POST "$BASE/api/transpile/indicator" \
  -H "Content-Type: application/json" \
  -d '{"code":"//@version=5\nindicator(\"EMA\")\nplot(ta.ema(close, 14))"}'

echo "# Extract structured data (options | heatmap | yield-curve | yield)"
curl -s "$BASE/api/extract/yield-curve"
