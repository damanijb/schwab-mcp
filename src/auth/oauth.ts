import { getConfig, SCHWAB_AUTH_URL } from "./config.js";
import { exchangeCodeForTokens } from "./tokens.js";

export function getAuthUrl(): string {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
  });
  return `${SCHWAB_AUTH_URL}?${params}`;
}

interface OAuthResult {
  success: boolean;
  message: string;
  authUrl?: string;
}

/**
 * Start OAuth flow:
 * 1. Return the auth URL for the user to open
 * 2. Start a temporary callback server to catch the redirect
 * 3. Exchange the code for tokens
 */
export async function startOAuthFlow(): Promise<OAuthResult> {
  const config = getConfig();
  const authUrl = getAuthUrl();

  // Parse callback URL to get host/port
  const callbackParsed = new URL(config.callbackUrl);
  const port = parseInt(callbackParsed.port) || 8182;
  const pathname = callbackParsed.pathname || "/callback";

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      server.stop();
      resolve({
        success: false,
        message: "OAuth timeout — no callback received within 5 minutes",
        authUrl,
      });
    }, 5 * 60 * 1000);

    const server = Bun.serve({
      port,
      hostname: "0.0.0.0",
      async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === pathname) {
          const code = url.searchParams.get("code");
          if (!code) {
            return new Response("Missing authorization code", { status: 400 });
          }

          try {
            const tokens = await exchangeCodeForTokens(code);
            clearTimeout(timeout);
            server.stop();

            if (tokens) {
              resolve({
                success: true,
                message: "OAuth complete — tokens saved successfully",
              });
              return new Response(
                "<html><body><h1>Authorization Successful</h1><p>You can close this window.</p><script>setTimeout(()=>window.close(),2000)</script></body></html>",
                { headers: { "Content-Type": "text/html" } }
              );
            } else {
              resolve({
                success: false,
                message: "Token exchange failed",
                authUrl,
              });
              return new Response("Token exchange failed", { status: 500 });
            }
          } catch (err) {
            clearTimeout(timeout);
            server.stop();
            resolve({
              success: false,
              message: `OAuth error: ${err}`,
              authUrl,
            });
            return new Response("Internal error", { status: 500 });
          }
        }

        return new Response("Not found", { status: 404 });
      },
    });

    resolve({
      success: true,
      message: `OAuth server listening on port ${port}. Open the auth URL to authenticate.`,
      authUrl,
    });
  });
}

/**
 * Manual OAuth: user provides the redirect URL containing the code
 */
export async function manualOAuth(redirectUrl: string): Promise<OAuthResult> {
  let code: string | null = null;

  if (redirectUrl.includes("code=")) {
    const parsed = new URL(redirectUrl);
    code = parsed.searchParams.get("code");
  } else {
    code = redirectUrl.trim();
  }

  if (!code) {
    return { success: false, message: "Could not extract authorization code" };
  }

  const tokens = await exchangeCodeForTokens(code);
  if (tokens) {
    return { success: true, message: "Tokens saved successfully" };
  }
  return { success: false, message: "Token exchange failed" };
}
