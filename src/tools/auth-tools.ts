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
    "Start Schwab OAuth2 authentication. Opens browser automatically, starts callback server, waits for auth to complete. Pass redirect_url to skip browser if you already have the callback URL.",
    {
      redirect_url: z.string().optional().describe("If you already have the redirect URL with the auth code, pass it here to skip the browser flow"),
      open_browser: z.boolean().optional().default(true).describe("Open browser automatically (default true). Set false for headless environments."),
    },
    async ({ redirect_url, open_browser }) => {
      if (redirect_url) {
        const result = await manualOAuth(redirect_url);
        if (result.success) {
          // Restart the refresh loop now that we have tokens
          const { startTokenRefreshLoop } = await import("../auth/tokens.js");
          startTokenRefreshLoop();
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          isError: !result.success,
        };
      }

      const authUrl = getAuthUrl();

      // Start callback server and wait for the auth code (blocks until complete or timeout)
      const result = await startOAuthFlow(open_browser);

      if (result.success && result.message.includes("tokens saved")) {
        // Auth complete — start refresh loop
        const { startTokenRefreshLoop } = await import("../auth/tokens.js");
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
