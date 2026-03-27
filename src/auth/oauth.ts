import { getConfig, SCHWAB_AUTH_URL } from "./config.js";
import { exchangeCodeForTokens } from "./tokens.js";
import { spawn } from "child_process";
import { platform } from "os";

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

/** Open a URL in the default browser (cross-platform) */
function openBrowser(url: string): void {
  const os = platform();
  try {
    if (os === "darwin") spawn("open", [url], { detached: true, stdio: "ignore" });
    else if (os === "win32") spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" });
    else spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  } catch {
    // Browser open is best-effort — the URL is returned in the result
  }
}

/**
 * Start OAuth flow with callback server.
 * Opens the browser automatically, starts a local server to catch the redirect,
 * and waits up to 5 minutes for the callback with the auth code.
 * Returns only after tokens are exchanged or timeout.
 */
export async function startOAuthFlow(openUrl = true): Promise<OAuthResult> {
  const config = getConfig();
  const authUrl = getAuthUrl();

  const callbackParsed = new URL(config.callbackUrl);
  const port = parseInt(callbackParsed.port) || 8182;
  const pathname = callbackParsed.pathname || "/callback";

  // Open browser before starting server
  if (openUrl) openBrowser(authUrl);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      server.stop();
      resolve({
        success: false,
        message: "OAuth timeout — no callback received within 5 minutes. Open the authUrl manually and try again.",
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
