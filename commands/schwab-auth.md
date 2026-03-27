---
name: schwab-auth
description: Authenticate with Schwab — checks token status, refreshes if possible, or starts full OAuth flow
---

Authenticate with Schwab brokerage. Follow these steps in order:

1. Call the `auth_status` tool to check current token health
2. Based on the result:
   - **If authenticated and tokens valid**: Report status — no action needed
   - **If access token expired but refresh token valid**: Call `refresh_token` tool
   - **If no tokens or refresh expired**: Call `start_oauth` tool (this opens the browser automatically and waits for the user to complete login — do NOT proceed until the tool returns success)
3. After successful auth, call `auth_status` again to confirm and report the result
