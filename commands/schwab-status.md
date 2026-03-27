---
name: schwab-status
description: Check Schwab authentication and account status
---

Check Schwab authentication status and account connectivity:

1. Call the `auth_status` tool to check token health
2. If authenticated, call `get_accounts` with `include_positions=false` to verify API connectivity
3. Report: token status, number of accounts accessible, trading enabled/disabled
