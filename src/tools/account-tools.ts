import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as api from "../api/schwab-client.js";
import { resolveAccountHash, resolveAccounts, getAccountLabel } from "../utils/accounts.js";

export function registerAccountTools(server: McpServer) {
  server.tool(
    "get_account_numbers",
    "Get all linked Schwab account numbers and their encrypted hashes (needed for other API calls)",
    {},
    async () => {
      const data = await api.getAccountNumbers();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_accounts",
    "Get balances and info for all accounts. Use account alias (brownfam, damani, tarina, p1-p5, all) or omit for all.",
    {
      accounts: z.string().optional().describe("Account alias or 'all'. Examples: brownfam, damani, tarina, p1, all"),
      include_positions: z.boolean().optional().default(false).describe("Include holdings/positions"),
    },
    async ({ accounts, include_positions }) => {
      if (accounts && accounts !== "all") {
        const resolved = resolveAccounts([accounts]);
        const results = [];
        for (const acct of resolved) {
          const data = await api.getAccount(acct.hash, include_positions);
          results.push({ account: acct.label, ...data });
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
      }

      const data = await api.getAccounts(include_positions);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_positions",
    "Get portfolio positions/holdings for an account. Includes cost basis, P&L, weight.",
    {
      account: z.string().describe("Account alias (brownfam, damani, tarina, p1-p5, all) or account hash"),
    },
    async ({ account }) => {
      const resolved = resolveAccounts([account]);
      const results = [];
      for (const acct of resolved) {
        const data = await api.getAccount(acct.hash, true);
        results.push({ account: acct.label, data });
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "get_user_preferences",
    "Get user preferences for all linked accounts",
    {},
    async () => {
      const data = await api.getUserPreferences();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
