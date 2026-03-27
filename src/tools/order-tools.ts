import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as api from "../api/schwab-client.js";
import { resolveAccountHash, getAccountLabel } from "../utils/accounts.js";
import { getConfig } from "../auth/config.js";

function requireTrading(): void {
  if (!getConfig().enableTrading) {
    throw new Error(
      "Trading is disabled. Set SCHWAB_ENABLE_TRADING=true to enable. All trading tools operate in dry-run mode by default — pass live=true to execute."
    );
  }
}

// --- Order builders ---

function buildEquityOrder(
  instruction: "BUY" | "SELL",
  symbol: string,
  quantity: number,
  orderType: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT",
  price?: number,
  stopPrice?: number,
  session = "NORMAL",
  duration = "DAY"
): any {
  const order: any = {
    orderType,
    session,
    duration,
    orderStrategyType: "SINGLE",
    orderLegCollection: [
      {
        instruction,
        quantity,
        instrument: { symbol: symbol.toUpperCase(), assetType: "EQUITY" },
      },
    ],
  };
  if (orderType === "LIMIT" || orderType === "STOP_LIMIT") order.price = price;
  if (orderType === "STOP" || orderType === "STOP_LIMIT") order.stopPrice = stopPrice;
  return order;
}

function buildOptionOrder(
  instruction: "BUY_TO_OPEN" | "SELL_TO_OPEN" | "BUY_TO_CLOSE" | "SELL_TO_CLOSE",
  symbol: string,
  quantity: number,
  orderType: "MARKET" | "LIMIT",
  price?: number,
  session = "NORMAL",
  duration = "DAY"
): any {
  const order: any = {
    orderType,
    session,
    duration,
    orderStrategyType: "SINGLE",
    orderLegCollection: [
      {
        instruction,
        quantity,
        instrument: { symbol, assetType: "OPTION" },
      },
    ],
  };
  if (orderType === "LIMIT") order.price = price;
  return order;
}

export function registerOrderTools(server: McpServer) {
  // --- Read tools ---

  server.tool(
    "get_orders",
    "Get orders for an account. Filter by status: WORKING, FILLED, CANCELLED, etc.",
    {
      account: z.string().describe("Account alias or hash"),
      status: z.string().optional().default("WORKING").describe("Order status filter: WORKING, FILLED, CANCELLED, EXPIRED, ALL"),
      max_results: z.number().optional().default(50),
    },
    async ({ account, status, max_results }) => {
      const hash = resolveAccountHash(account);
      const data = await api.getOrders(hash, {
        maxResults: max_results,
        status: status === "ALL" ? undefined : status,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_order",
    "Get details for a specific order",
    {
      account: z.string().describe("Account alias or hash"),
      order_id: z.string().describe("Order ID"),
    },
    async ({ account, order_id }) => {
      const hash = resolveAccountHash(account);
      const data = await api.getOrder(hash, order_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_transactions",
    "Get transaction history for an account",
    {
      account: z.string().describe("Account alias or hash"),
      days: z.number().optional().default(30).describe("Number of days of history"),
      types: z.string().optional().default("TRADE").describe("Transaction type: TRADE, RECEIVE_AND_DELIVER, DIVIDEND_OR_INTEREST, ACH_RECEIPT, etc."),
    },
    async ({ account, days, types }) => {
      const hash = resolveAccountHash(account);
      const start = new Date();
      start.setDate(start.getDate() - days);
      const data = await api.getTransactions(hash, {
        startDate: start.toISOString().split("T")[0],
        types,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  // --- Write tools ---

  server.tool(
    "place_equity_order",
    "Place an equity (stock/ETF) order. Dry-run by default — set live=true to execute.",
    {
      account: z.string().describe("Account alias or hash"),
      instruction: z.enum(["BUY", "SELL"]),
      symbol: z.string().describe("Ticker symbol"),
      quantity: z.number().int().positive().describe("Number of shares"),
      order_type: z.enum(["MARKET", "LIMIT", "STOP", "STOP_LIMIT"]).default("MARKET"),
      price: z.number().optional().describe("Limit price (required for LIMIT/STOP_LIMIT)"),
      stop_price: z.number().optional().describe("Stop price (required for STOP/STOP_LIMIT)"),
      session: z.enum(["NORMAL", "AM", "PM", "SEAMLESS"]).optional().default("NORMAL"),
      duration: z.enum(["DAY", "GOOD_TILL_CANCEL", "FILL_OR_KILL"]).optional().default("DAY"),
      live: z.boolean().optional().default(false).describe("Set true to actually place the order. Default is dry-run."),
    },
    async ({ account, instruction, symbol, quantity, order_type, price, stop_price, session, duration, live }) => {
      requireTrading();

      const order = buildEquityOrder(instruction, symbol, quantity, order_type, price, stop_price, session, duration);
      const hash = resolveAccountHash(account);
      const label = getAccountLabel(hash);
      const desc = `${instruction} ${quantity} ${symbol.toUpperCase()} @ ${order_type}${price ? ` $${price}` : ""}${stop_price ? ` stop $${stop_price}` : ""}`;

      if (!live) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                dry_run: true,
                description: desc,
                account: label,
                order,
                message: "This is a preview. Set live=true to execute.",
              }, null, 2),
            },
          ],
        };
      }

      const result = await api.placeOrder(hash, order);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              description: desc,
              account: label,
              orderId: result.orderId,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "place_option_order",
    "Place a single-leg option order. Dry-run by default.",
    {
      account: z.string().describe("Account alias or hash"),
      instruction: z.enum(["BUY_TO_OPEN", "SELL_TO_OPEN", "BUY_TO_CLOSE", "SELL_TO_CLOSE"]),
      symbol: z.string().describe("Option symbol (e.g. AAPL  260620C00200000)"),
      quantity: z.number().int().positive().describe("Number of contracts"),
      order_type: z.enum(["MARKET", "LIMIT"]).default("LIMIT"),
      price: z.number().optional().describe("Limit price per contract"),
      session: z.enum(["NORMAL", "AM", "PM", "SEAMLESS"]).optional().default("NORMAL"),
      duration: z.enum(["DAY", "GOOD_TILL_CANCEL", "FILL_OR_KILL"]).optional().default("DAY"),
      live: z.boolean().optional().default(false),
    },
    async ({ account, instruction, symbol, quantity, order_type, price, session, duration, live }) => {
      requireTrading();

      const order = buildOptionOrder(instruction, symbol, quantity, order_type, price, session, duration);
      const hash = resolveAccountHash(account);
      const label = getAccountLabel(hash);
      const desc = `${instruction} ${quantity}x ${symbol} @ ${order_type}${price ? ` $${price}` : ""}`;

      if (!live) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ dry_run: true, description: desc, account: label, order, message: "Preview. Set live=true to execute." }, null, 2) }],
        };
      }

      const result = await api.placeOrder(hash, order);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, description: desc, account: label, orderId: result.orderId }, null, 2) }],
      };
    }
  );

  server.tool(
    "place_bracket_order",
    "Place a bracket order: entry + take-profit + stop-loss. Dry-run by default.",
    {
      account: z.string().describe("Account alias or hash"),
      instruction: z.enum(["BUY", "SELL"]),
      symbol: z.string(),
      quantity: z.number().int().positive(),
      entry_type: z.enum(["MARKET", "LIMIT"]).default("LIMIT"),
      entry_price: z.number().optional().describe("Entry limit price"),
      take_profit_price: z.number().describe("Take profit limit price"),
      stop_loss_price: z.number().describe("Stop loss price"),
      session: z.enum(["NORMAL", "AM", "PM", "SEAMLESS"]).optional().default("NORMAL"),
      duration: z.enum(["DAY", "GOOD_TILL_CANCEL"]).optional().default("GOOD_TILL_CANCEL"),
      live: z.boolean().optional().default(false),
    },
    async ({ account, instruction, symbol, quantity, entry_type, entry_price, take_profit_price, stop_loss_price, session, duration, live }) => {
      requireTrading();

      const exitInstruction = instruction === "BUY" ? "SELL" : "BUY";
      const sym = symbol.toUpperCase();

      const entryOrder = buildEquityOrder(instruction, sym, quantity, entry_type, entry_price, undefined, session, duration);

      const bracketOrder = {
        ...entryOrder,
        orderStrategyType: "TRIGGER",
        childOrderStrategies: [
          {
            orderStrategyType: "OCO",
            childOrderStrategies: [
              buildEquityOrder(exitInstruction, sym, quantity, "LIMIT", take_profit_price, undefined, session, duration),
              buildEquityOrder(exitInstruction, sym, quantity, "STOP", undefined, stop_loss_price, session, duration),
            ],
          },
        ],
      };

      const hash = resolveAccountHash(account);
      const label = getAccountLabel(hash);
      const desc = `BRACKET: ${instruction} ${quantity} ${sym} entry@${entry_price || "MKT"} TP@${take_profit_price} SL@${stop_loss_price}`;

      if (!live) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ dry_run: true, description: desc, account: label, order: bracketOrder, message: "Preview. Set live=true to execute." }, null, 2) }],
        };
      }

      const result = await api.placeOrder(hash, bracketOrder);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, description: desc, account: label, orderId: result.orderId }, null, 2) }],
      };
    }
  );

  server.tool(
    "place_oco_order",
    "Place a one-cancels-other order pair (e.g., take-profit + stop-loss). Dry-run by default.",
    {
      account: z.string(),
      symbol: z.string(),
      quantity: z.number().int().positive(),
      instruction: z.enum(["BUY", "SELL"]),
      limit_price: z.number().describe("Limit price for take-profit leg"),
      stop_price: z.number().describe("Stop price for stop-loss leg"),
      session: z.enum(["NORMAL", "AM", "PM", "SEAMLESS"]).optional().default("NORMAL"),
      duration: z.enum(["DAY", "GOOD_TILL_CANCEL"]).optional().default("GOOD_TILL_CANCEL"),
      live: z.boolean().optional().default(false),
    },
    async ({ account, symbol, quantity, instruction, limit_price, stop_price, session, duration, live }) => {
      requireTrading();

      const sym = symbol.toUpperCase();
      const ocoOrder = {
        orderStrategyType: "OCO",
        childOrderStrategies: [
          buildEquityOrder(instruction, sym, quantity, "LIMIT", limit_price, undefined, session, duration),
          buildEquityOrder(instruction, sym, quantity, "STOP", undefined, stop_price, session, duration),
        ],
      };

      const hash = resolveAccountHash(account);
      const label = getAccountLabel(hash);

      if (!live) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ dry_run: true, description: `OCO: ${instruction} ${quantity} ${sym} limit@${limit_price} stop@${stop_price}`, account: label, order: ocoOrder }, null, 2) }],
        };
      }

      const result = await api.placeOrder(hash, ocoOrder);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, account: label, orderId: result.orderId }, null, 2) }],
      };
    }
  );

  server.tool(
    "place_trailing_stop",
    "Place a trailing stop order. Dry-run by default.",
    {
      account: z.string(),
      instruction: z.enum(["BUY", "SELL"]),
      symbol: z.string(),
      quantity: z.number().int().positive(),
      offset_type: z.enum(["VALUE", "PERCENT"]).describe("Trailing offset type"),
      offset: z.number().positive().describe("Trailing offset amount (dollar or percent)"),
      session: z.enum(["NORMAL", "AM", "PM", "SEAMLESS"]).optional().default("NORMAL"),
      duration: z.enum(["DAY", "GOOD_TILL_CANCEL"]).optional().default("GOOD_TILL_CANCEL"),
      live: z.boolean().optional().default(false),
    },
    async ({ account, instruction, symbol, quantity, offset_type, offset, session, duration, live }) => {
      requireTrading();

      const sym = symbol.toUpperCase();
      const order: any = {
        orderType: "TRAILING_STOP",
        session,
        duration,
        orderStrategyType: "SINGLE",
        complexOrderStrategyType: "NONE",
        stopPriceLinkBasis: "LAST",
        stopPriceLinkType: offset_type === "PERCENT" ? "PERCENT" : "VALUE",
        stopPriceOffset: offset,
        orderLegCollection: [
          {
            instruction,
            quantity,
            instrument: { symbol: sym, assetType: "EQUITY" },
          },
        ],
      };

      const hash = resolveAccountHash(account);
      const label = getAccountLabel(hash);
      const desc = `TRAILING STOP: ${instruction} ${quantity} ${sym} offset ${offset}${offset_type === "PERCENT" ? "%" : "$"}`;

      if (!live) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ dry_run: true, description: desc, account: label, order }, null, 2) }],
        };
      }

      const result = await api.placeOrder(hash, order);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, description: desc, account: label, orderId: result.orderId }, null, 2) }],
      };
    }
  );

  server.tool(
    "cancel_order",
    "Cancel a pending order",
    {
      account: z.string().describe("Account alias or hash"),
      order_id: z.string().describe("Order ID to cancel"),
    },
    async ({ account, order_id }) => {
      requireTrading();
      const hash = resolveAccountHash(account);
      const result = await api.cancelOrder(hash, order_id);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
