---
name: market-research
description: Research market data via Schwab — quotes, price history, option chains, market hours, movers. Use when user asks for stock prices, "what's AAPL at", price history, option chains, market movers, "is the market open", or any market data lookup.
---

# Market Research

Retrieve and present market data from Schwab.

## Quote lookup
When asked about current prices:
1. Call `get_quotes` with the requested symbols
2. Present: symbol, last price, change ($), change (%), volume, bid/ask if available
3. For multiple symbols, present as an aligned table

## Price history
When asked about historical prices or charts:
1. Call `get_price_history` with appropriate parameters:
   - Intraday: `period_type: "day"`, `frequency_type: "minute"`, `frequency: 5`
   - Daily (1 month): `period_type: "month"`, `period: 1`, `frequency_type: "daily"`
   - Weekly (1 year): `period_type: "year"`, `period: 1`, `frequency_type: "weekly"`
2. Summarize: open, high, low, close for the period, % change, volume trend

## Option chains
When asked about options:
1. Call `get_option_chain` with the underlying symbol
2. Use `strike_count` to limit results (default 5 strikes above/below ATM)
3. Present: strike, bid, ask, last, volume, open interest, delta/gamma if available
4. Separate calls and puts clearly

## Market hours
When asked if markets are open:
1. Call `get_market_hours` with `markets: "equity"`
2. Report current status and next open/close time

## Top movers
When asked about market movers:
1. Call `get_movers` with the relevant index ($SPX, $DJI, $COMPX)
2. Present top gainers and losers with % change
