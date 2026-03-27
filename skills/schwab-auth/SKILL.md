---
name: schwab-auth
description: Authenticate with Schwab brokerage — full setup from scratch, token refresh, or OAuth flow. Use when user mentions Schwab login, token expired, authentication issues, first-time setup, or when any Schwab MCP tool returns an auth error.
---

# Schwab Authentication

Follow these steps in order. Stop as soon as auth is confirmed.

## Step 1: Check current status
Call the `auth_status` tool. Read the `next_step` field to know what to do.

## Step 2: Branch on the response

### If `configured: false` (first-time setup)
1. Ask the user for their Schwab API credentials (client_id and client_secret from developer.schwab.com)
2. Call `setup` with those credentials
3. Then call `start_oauth` — this opens the browser automatically and blocks until login completes
4. Tell the user: "Schwab login is opening in your browser. Log in and authorize the app — I'll wait."
5. Wait for the tool to return, then call `auth_status` to confirm

### If `configured: true, authenticated: false` and no tokens
- Call `start_oauth` — tell user the browser is opening
- Wait for it to complete
- Call `auth_status` to confirm

### If `next_step: "refresh_token"`
- Call `refresh_token`
- If success: done
- If fail: call `start_oauth`

### If `authenticated: true`
- Report: "Schwab authenticated. Access token: Xm remaining. Refresh token: Xd remaining."
- If refresh token <2 days, warn about upcoming expiration
- Done.

## Important
- `start_oauth` BLOCKS until auth completes (up to 5 min) — do NOT call other tools while waiting
- If the user is on a headless server, pass `open_browser: false` and give them the auth URL to open manually
- After any successful auth, the server auto-refreshes tokens every 25 minutes
