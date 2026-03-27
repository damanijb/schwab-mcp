---
name: portfolio-review
description: Review Schwab portfolio — account balances, positions, P&L, allocation. Use when user asks about their portfolio, holdings, account balances, positions, "how are my accounts doing", "what do I own", or any portfolio status request.
---

# Portfolio Review

Generate a comprehensive portfolio review across Schwab accounts.

## Steps

1. **Get all account balances**: Call `get_accounts` with `accounts: "all"` and `include_positions: false`
2. **Get positions for each account**: Call `get_positions` for each account that has equity holdings (skip empty cash-only accounts)
3. **Present summary table**: For each account show:
   - Account name/alias
   - Cash balance
   - Equity/market value
   - Total liquidation value
   - Day P&L (if available)
4. **Present holdings by account**: For each account with positions:
   - Ticker, quantity, avg cost, current price, market value, unrealized P&L, P&L%, portfolio weight%
   - Sort by market value descending
5. **Cross-account totals**:
   - Grand total across all accounts
   - Top 10 holdings by total value (aggregated across accounts if same ticker held in multiple)
   - Overall cash vs equity allocation %

Format with aligned columns using monospace. Use $ formatting and +/- for P&L.
