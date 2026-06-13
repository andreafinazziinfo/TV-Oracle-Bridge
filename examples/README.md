# Examples

Practical, copy-pasteable examples for the two entry points of TV-Oracle-Bridge:

- **REST dashboard API** (`dashboard/server.mjs`, default port `5000`)
- **MCP server** (`mcp_server.py`, for AI clients like Claude Desktop)

Start the dashboard first for the REST examples:

```bash
npm run dashboard        # serves http://localhost:5000
```

| File | What it shows |
|------|---------------|
| [`rest_api.sh`](./rest_api.sh) | Health, status, docs search, indicators, transpile, extract |
| [`screener_request.sh`](./screener_request.sh) | Screener presets CRUD + live preview proxy |
| [`alert_ingestion.sh`](./alert_ingestion.sh) | Posting TradingView-style alert webhooks |
| [`mcp_config.json`](./mcp_config.json) | Registering the MCP server in an AI client |

All endpoints are documented in [`../docs/INTEGRATION_CONTRACT.md`](../docs/INTEGRATION_CONTRACT.md).
Set up credentials first by copying [`../.env.example`](../.env.example) to `.env`.
