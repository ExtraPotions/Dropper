# Agent watch harness

Run Dropper inside a headed Chrome session the Cloud Agent can observe. Diagnostics are dumped automatically — no manual copy/paste.

## Start

```bash
cd /path/to/Dropper
npm run build
npm run watch
# or: node scripts/watch-dropper.cjs --url https://www.twitch.tv/drops/inventory
```

## First run — auth (pick one)

### A. Cookie import (recommended for Cloud Agents)

You usually **cannot type into the agent Chrome from your PC**. Export cookies from your real Twitch tab instead:

1. In your normal browser (already logged into Twitch): DevTools → Application → Cookies → `https://www.twitch.tv`
2. Copy `auth-token` (and optionally `unique_id`)
3. On the agent machine:

```bash
mkdir -p artifacts/diagnostics
printf '%s' 'PASTE_AUTH_TOKEN_HERE' > artifacts/diagnostics/auth-token.txt
# optional:
# printf '%s' 'PASTE_UNIQUE_ID_HERE' > artifacts/diagnostics/unique-id.txt
node scripts/watch-import-auth.cjs
```

The harness navigates to Inventory and the next diagnostics poll should show `tokenCaptured: true`.

### B. Type into the agent desktop

Only if you can see and control the Cloud Agent desktop UI: log in on the open `twitch.tv/login` window. Session persists under `.watch-profile/`.

## What the agent reads

| Path | Purpose |
| --- | --- |
| `artifacts/diagnostics/latest.json` | Full Dropper diagnostics dump |
| `artifacts/diagnostics/latest-summary.json` | Compact health summary |
| `artifacts/diagnostics/watch-status.json` | Harness state (logged in, mounted, URL) |
| `http://127.0.0.1:9340/summary` | Live JSON status |
| `http://127.0.0.1:9340/latest` | Live full dump |

Poll interval defaults to 15s (`DROPPER_WATCH_POLL_MS`).

## CDP

Chrome listens on `http://127.0.0.1:9333` for Playwright/`computerUse` attachment.

## Notes

- `.watch-profile/` holds Twitch cookies — do not commit it.
- `artifacts/diagnostics/` is local runtime output — do not commit dumps with account tokens.
- The harness polyfills `GM_xmlhttpRequest` in Node so Dropper GQL works without Violentmonkey.
