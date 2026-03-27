---
name: schwab-auth
description: Authenticate with Schwab brokerage — check token status, refresh, or start OAuth flow. Use when user mentions Schwab login, token expired, or authentication issues.
---

# Schwab Authentication

Check the current auth status using the `auth_status` MCP tool first. Based on the result:

1. **Tokens valid** — report status, no action needed
2. **Access token expired, refresh token valid** — call `refresh_token` tool
3. **No tokens or refresh expired** — call `start_oauth` tool, give user the auth URL

The MCP server auto-refreshes tokens every 25 minutes while running. This skill is for manual intervention when auto-refresh fails.
