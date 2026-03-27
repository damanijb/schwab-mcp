import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadTokens, refreshAccessToken, isTokenExpired, startTokenRefreshLoop } from "../auth/tokens.js";
import { getAuthUrl, startOAuthFlow, manualOAuth } from "../auth/oauth.js";
import { getConfig, isConfigured, saveConfigFile } from "../auth/config.js";

export function registerAuthTools(server: McpServer) {
  server.tool(
    "setup",
    "First-time setup: save Schwab API credentials (client_id and client_secret from developer.schwab.com). This is the first tool to call if the server has never been configured. After setup, call start_oauth to authenticate.",
    {
      client_id: z.string().describe("Schwab API client ID from developer.schwab.com"),
      client_secret: z.string().describe("Schwab API client secret"),
      callback_url: z.string().optional().describe("OAuth callback URL. Default: https://127.0.0.1:8182/callback"),
    },
    async ({ client_id, client_secret, callback_url }) => {
      saveConfigFile({
        clientId: client_id,
        clientSecret: client_secret,
        callbackUrl: callback_url,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: "Credentials saved. Now call start_oauth to authenticate with Schwab.",
              config_path: "~/.config/schwab-mcp/config.json",
              next_step: "Call the start_oauth tool to open the Schwab login page in your browser.",
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "auth_status",
    "Check Schwab authentication status — whether credentials are configured, token validity, and refresh token health. Call this first to see what state the server is in.",
    {},
    async () => {
      const configured = isConfigured();

      if (!configured) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                configured: false,
                authenticated: false,
                message: "No credentials configured. Call the setup tool with your client_id and client_secret from developer.schwab.com first.",
                next_step: "setup",
              }, null, 2),
            },
          ],
        };
      }

      const tokens = loadTokens();
      if (!tokens) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                configured: true,
                authenticated: false,
                message: "Credentials configured but no tokens. Call start_oauth to authenticate.",
                next_step: "start_oauth",
              }, null, 2),
            },
          ],
        };
      }

      const now = Date.now() / 1000;
      const token = tokens.token;
      const accessExpired = isTokenExpired();
      const accessRemaining = Math.max(0, token.expires_at - now);
      const createdAge = (now - tokens.creation_timestamp) / 86400;
      const refreshRemaining = Math.max(0, 7 - createdAge);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              configured: true,
              authenticated: !accessExpired,
              access_token: {
                valid: !accessExpired,
                remaining_minutes: Math.round(accessRemaining / 60),
              },
              refresh_token: {
                present: !!token.refresh_token,
                estimated_days_remaining: Math.round(refreshRemaining * 10) / 10,
                warning: refreshRemaining < 1 ? "Refresh token expiring soon — re-authenticate" : undefined,
              },
              next_step: accessExpired ? "refresh_token" : null,
              token_created: new Date(tokens.creation_timestamp * 1000).toISOString(),
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "refresh_token",
    "Refresh the Schwab access token using the refresh token. Call this when auth_status shows access token expired but refresh token is still valid.",
    {},
    async () => {
      if (!isConfigured()) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: "No credentials configured. Call setup first.", next_step: "setup" }, null, 2) }],
          isError: true,
        };
      }

      const result = await refreshAccessToken();
      if (result) {
        startTokenRefreshLoop();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "Token refreshed successfully",
                expires_at: new Date(result.expires_at * 1000).toISOString(),
              }, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              message: "Refresh failed. Re-authentication required.",
              next_step: "start_oauth",
              authUrl: getAuthUrl(),
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  );

  server.tool(
    "start_oauth",
    "Start Schwab OAuth2 authentication. Opens the Schwab login page in your browser, starts a local callback server to catch the redirect, and waits for auth to complete automatically. Call setup first if credentials aren't configured.",
    {
      redirect_url: z.string().optional().describe("If you already have the callback redirect URL with the auth code, pass it here to skip the browser step"),
      open_browser: z.boolean().optional().default(true).describe("Open browser automatically. Set false for headless/SSH environments — the auth URL will be returned for manual opening."),
    },
    async ({ redirect_url, open_browser }) => {
      if (!isConfigured()) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: false, message: "No credentials configured. Call setup first.", next_step: "setup" }, null, 2) }],
          isError: true,
        };
      }

      if (redirect_url) {
        const result = await manualOAuth(redirect_url);
        if (result.success) startTokenRefreshLoop();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          isError: !result.success,
        };
      }

      const authUrl = getAuthUrl();

      // Start callback server and wait for the auth code (blocks until complete or 5min timeout)
      const result = await startOAuthFlow(open_browser);

      if (result.success && result.message.includes("tokens saved")) {
        startTokenRefreshLoop();
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              authUrl: result.success ? undefined : authUrl,
              instructions: result.success
                ? undefined
                : [
                    "Browser didn't open? Copy this URL manually:",
                    authUrl,
                    "After authorizing, the callback will be captured automatically.",
                    "Or copy the redirect URL and call start_oauth with redirect_url parameter.",
                  ],
            }, null, 2),
          },
        ],
        isError: !result.success,
      };
    }
  );
}
