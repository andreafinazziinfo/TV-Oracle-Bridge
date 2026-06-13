# Troubleshooting

Common setup and runtime issues, with fixes.

## Node: `node_sqlite3.node: invalid ELF header` / `ERR_DLOPEN_FAILED`

The `sqlite3` native binding was compiled for a different OS than the one
running Node — typically a `node_modules/` installed on Windows but executed
under WSL/Linux (or vice versa), e.g. a shared folder under `/mnt/c`.

**Fix:** reinstall on the platform that runs the code so the binding is rebuilt:

```bash
rm -rf node_modules
npm install        # runs the postinstall patch and rebuilds native modules
```

Do not share a single `node_modules/` across Windows and WSL.

## Windows: phantom diff with every file "modified" (CRLF)

If `git status` shows every text file changed with equal insertions/deletions,
your editor rewrote line endings (CRLF). The repo ships a `.gitattributes`
(`* text=auto eol=lf`) to normalize to LF. To drop a phantom diff:

```bash
git restore .
```

## Playwright: browser launch fails

Screenshot/extraction features (`remoteControl.mjs`) need a browser. Install
Playwright's browsers and OS dependencies once:

```bash
npx playwright install --with-deps chromium
```

To use a local Brave/Chrome instead, set `TV_BROWSER_PATH` in `.env`
(see `.env.example`). Set `TV_BROWSER_HEADLESS=false` to watch the browser.

## Docker: container won't start / port already in use

The dashboard defaults to port `5000` and the MCP server to `8000`. If a port
is taken, override it:

```bash
PORT=5050 npm run dashboard
MCP_PORT=8010 python mcp_server.py
```

For Docker, the `docker-compose.yml` splits `mcp-server` and `dashboard` into
separate services — check `docker compose logs <service>` for the failing one.

## MCP: server not detected by the AI client

- Use an **absolute path** to `mcp_server.py` in the client config
  (see [`../examples/mcp_config.json`](../examples/mcp_config.json)).
- Ensure Python deps are installed: `pip install -r requirements.txt`.
- The client must be able to find `python` on its PATH.

## `No pineId found for indicator '<key>'`

The private indicator → pineId mapping lives in `indicators.local.json`, which
is gitignored (it holds your own TradingView script IDs). Create it from your
own indicators, or set `TV_PINE_ID_<KEY>` env vars. `indicators.json` only
ships the public key/name list, not the IDs.

## `TV_SESSION empty in .env`

Authenticated fetches need TradingView session cookies. Copy `.env.example`
to `.env` and fill `TV_SESSION` / `TV_SESSION_SIGN`, or run the helper:

```bash
node session_helper.mjs   # opens a browser, captures cookies into .env
```

## Pine docs lookups return "not found"

The offline docs database `pine_docs_db.json` ships in the repo. If you removed
it, regenerate it with `node build_pine_docs.mjs`.
