import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadTokens, refreshAccessToken, isTokenExpired } from "../auth/tokens.js";
import { getAuthUrl, startOAuthFlow, manualOAuth } from "../auth/oauth.js";

export function registerAuthTools(server: McpServer) {
  server.tool(
    "auth_status",
    "Check Schwab authentication status — token validity, expiration, refresh token health",
    {},
    async () => {
      const tokens = loadTokens();
      if (!tokens) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                authenticated: false,
                message: "No tokens found. Run start_oauth to authenticate.",
                authUrl: getAuthUrl(),
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
              token_created: new Date(tokens.creation_timestamp * 1000).toISOString(),
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "refresh_token",
    "Manually refresh the Schwab access token using the refresh token",
    {},
    async () => {
      const result = await refreshAccessToken();
      if (result) {
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
    "Start Schwab OAuth2 authentication flow. Returns auth URL to open in browser. Optionally pass redirect_url if you already have the callback URL with the code.",
    { redirect_url: z.string().optional().describe("If you already have the redirect URL with the auth code, pass it here to skip the browser flow") },
    async ({ redirect_url }) => {
      if (redirect_url) {
        const result = await manualOAuth(redirect_url);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          isError: !result.success,
        };
      }

      const authUrl = getAuthUrl();
      // Try to start callback server in the background
      startOAuthFlow().catch(() => {});

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              message: "Open this URL in a browser to authenticate with Schwab",
              authUrl,
              instructions: [
                "1. Open the authUrl in a browser",
                "2. Log in to Schwab and authorize",
                "3. After redirect, tokens will be saved automatically",
                "4. If auto-capture fails, copy the redirect URL and call this tool again with redirect_url parameter",
              ],
            }, null, 2),
          },
        ],
      };
    }
  );
}
