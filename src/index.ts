#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAuthTools } from "./tools/auth-tools.js";
import { registerAccountTools } from "./tools/account-tools.js";
import { registerMarketTools } from "./tools/market-tools.js";
import { registerOrderTools } from "./tools/order-tools.js";
import { startTokenRefreshLoop, stopTokenRefreshLoop, loadTokens } from "./auth/tokens.js";
import { getConfig } from "./auth/config.js";

const server = new McpServer({
  name: "schwab-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {},
  },
});

// Register all tool groups
registerAuthTools(server);
registerAccountTools(server);
registerMarketTools(server);
registerOrderTools(server);

// Start token refresh loop if we have tokens
const tokens = loadTokens();
if (tokens) {
  startTokenRefreshLoop();
  console.error("[schwab-mcp] Started with existing tokens — auto-refresh active");
} else {
  console.error("[schwab-mcp] No tokens found — use start_oauth tool to authenticate");
}

const config = getConfig();
if (!config.clientId || !config.clientSecret) {
  console.error("[schwab-mcp] Warning: SCHWAB_CLIENT_ID or SCHWAB_CLIENT_SECRET not set");
}
if (config.enableTrading) {
  console.error("[schwab-mcp] Trading ENABLED");
} else {
  console.error("[schwab-mcp] Trading disabled (read-only mode). Set SCHWAB_ENABLE_TRADING=true to enable.");
}

// Run stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

// Cleanup on exit
process.on("SIGINT", () => {
  stopTokenRefreshLoop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopTokenRefreshLoop();
  process.exit(0);
});
