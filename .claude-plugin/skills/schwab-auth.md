---
name: schwab-auth
description: Authenticate with Schwab brokerage — check token status, refresh tokens, or start full OAuth flow. Use when user mentions Schwab login, token expired, authentication issues, or when any Schwab MCP tool returns an auth error.
---

# Schwab Authentication

Follow these steps in order. Stop as soon as auth is confirmed.

## Step 1: Check current status
Call the `auth_status` MCP tool. Read the result carefully.

## Step 2: Branch on status

**If `authenticated: true` and access token has >5 min remaining:**
- Report: "Schwab authenticated. Access token: Xm remaining. Refresh token: Xd remaining."
- If refresh token has <2 days remaining, warn: "Refresh token expiring soon — re-authenticate within X days to avoid losing access."
- Done.

**If access token expired but `refresh_token.present: true` and `estimated_days_remaining > 0`:**
- Call `refresh_token` tool
- If success: report new expiration, done
- If fail: proceed to Step 3

**If no tokens, refresh failed, or refresh token expired:**
- Proceed to Step 3

## Step 3: Full OAuth flow
- Call `start_oauth` tool (this opens the browser and blocks until complete)
- Tell the user: "Opening Schwab login in your browser. Complete the login and the tokens will be captured automatically."
- Wait for the tool to return
- If success: call `auth_status` to confirm, report result
- If timeout/fail: show the auth URL and instruct user to open it manually, then call `start_oauth` again with the `redirect_url` parameter once they have it
