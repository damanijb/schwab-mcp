---
name: trade-execution
description: Execute trades on Schwab — buy, sell, bracket orders, trailing stops. Use when user wants to place a trade, buy/sell stocks or options, set up bracket orders, trailing stops, or any order placement request. Also triggers on "buy X shares", "sell X", "place order", "enter position", "exit position".
---

# Trade Execution

Guide the user through placing a trade safely.

## Pre-flight checks

1. Call `auth_status` — if not authenticated, invoke the schwab-auth skill first
2. Confirm trading is enabled (if `place_equity_order` returns a trading-disabled error, tell the user to set `SCHWAB_ENABLE_TRADING=true`)

## Gather order details

Determine from the user's request:
- **Account**: Which account alias (brownfam, damani, tarina, p1-p5)? If not specified, ask.
- **Action**: BUY or SELL
- **Symbol**: Ticker
- **Quantity**: Number of shares/contracts
- **Order type**: MARKET, LIMIT, STOP, STOP_LIMIT, BRACKET, TRAILING_STOP
- **Price(s)**: Limit price, stop price, take-profit, stop-loss as needed
- **Session**: NORMAL (default), AM, PM, SEAMLESS
- **Duration**: DAY (default), GOOD_TILL_CANCEL

## Dry-run first (ALWAYS)

Place the order with `live: false` (the default). Present the order preview to the user:
- Full description: "BUY 100 AAPL @ $185.00 LIMIT"
- Account name
- Order JSON structure
- Ask for explicit confirmation: "Confirm to execute this order live?"

## Execute only after confirmation

Once the user confirms, place the same order with `live: true`. Report the order ID.

## Complex order types

- **Bracket**: Use `place_bracket_order` — entry + take-profit + stop-loss
- **OCO**: Use `place_oco_order` — take-profit + stop-loss pair (for existing positions)
- **Trailing stop**: Use `place_trailing_stop` — specify offset type (VALUE or PERCENT) and amount

## Post-trade

After successful placement, call `get_orders` for the account with status "WORKING" to confirm the order appears.
