import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as api from "../api/schwab-client.js";

export function registerMarketTools(server: McpServer) {
  server.tool(
    "get_quotes",
    "Get real-time quotes for stocks, ETFs, indices. Returns price, change, volume, fundamentals.",
    {
      symbols: z.string().describe("Comma-separated symbols, e.g. 'AAPL,MSFT,SPY'"),
      fields: z.string().optional().default("quote").describe("Data fields: quote, fundamental, extended, reference, regular"),
    },
    async ({ symbols, fields }) => {
      const syms = symbols.split(",").map((s) => s.trim().toUpperCase());
      const data = await api.getQuotes(syms, fields);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_price_history",
    "Get OHLCV price history candles for a symbol",
    {
      symbol: z.string().describe("Ticker symbol"),
      period_type: z.enum(["day", "month", "year", "ytd"]).optional().describe("Period type"),
      period: z.number().optional().describe("Number of periods"),
      frequency_type: z.enum(["minute", "daily", "weekly", "monthly"]).optional().describe("Frequency type"),
      frequency: z.number().optional().describe("Frequency value (1, 5, 10, 15, 30 for minute)"),
      start_date: z.number().optional().describe("Start date as epoch ms"),
      end_date: z.number().optional().describe("End date as epoch ms"),
    },
    async ({ symbol, period_type, period, frequency_type, frequency, start_date, end_date }) => {
      const data = await api.getPriceHistory(symbol.toUpperCase(), {
        periodType: period_type,
        period,
        frequencyType: frequency_type,
        frequency,
        startDate: start_date,
        endDate: end_date,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_option_chain",
    "Get option chain data for a symbol",
    {
      symbol: z.string().describe("Underlying ticker symbol"),
      contract_type: z.enum(["CALL", "PUT", "ALL"]).optional().describe("Contract type filter"),
      strike_count: z.number().optional().describe("Number of strikes above/below ATM"),
      include_underlying_quote: z.boolean().optional().describe("Include quote for underlying"),
      strategy: z.string().optional().describe("Option strategy: SINGLE, ANALYTICAL, COVERED, VERTICAL, etc."),
      range: z.string().optional().describe("Strike range: ITM, NTM, OTM, SAK, SBK, SNK, ALL"),
      from_date: z.string().optional().describe("Expiration from date (YYYY-MM-DD)"),
      to_date: z.string().optional().describe("Expiration to date (YYYY-MM-DD)"),
    },
    async ({ symbol, contract_type, strike_count, include_underlying_quote, strategy, range, from_date, to_date }) => {
      const data = await api.getOptionChain(symbol.toUpperCase(), {
        contractType: contract_type,
        strikeCount: strike_count,
        includeUnderlyingQuote: include_underlying_quote,
        strategy,
        range,
        fromDate: from_date,
        toDate: to_date,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_market_hours",
    "Get market hours for equity, option, bond, or future markets",
    {
      markets: z.string().describe("Comma-separated: equity, option, bond, future, forex"),
      date: z.string().optional().describe("Date (YYYY-MM-DD), defaults to today"),
    },
    async ({ markets, date }) => {
      const data = await api.getMarketHours(markets.split(",").map((m) => m.trim()), date);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_movers",
    "Get top movers for an index ($DJI, $COMPX, $SPX)",
    {
      index: z.string().describe("Index symbol: $DJI, $COMPX, $SPX"),
      sort: z.enum(["VOLUME", "TRADES", "PERCENT_CHANGE_UP", "PERCENT_CHANGE_DOWN"]).optional(),
      frequency: z.number().optional().describe("0=all, 1=1min, 5=5min, etc."),
    },
    async ({ index, sort, frequency }) => {
      const data = await api.getMovers(index, { sort, frequency });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
