#!/usr/bin/env bun
/**
 * CLI for initial Schwab OAuth authentication.
 * Usage: bun run src/auth/cli.ts
 */
import { getAuthUrl, startOAuthFlow, manualOAuth } from "./oauth.js";
import { loadTokens, isTokenExpired, refreshAccessToken } from "./tokens.js";
import { getConfig } from "./config.js";

const config = getConfig();

if (!config.clientId || !config.clientSecret) {
  console.error("Error: SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET must be set");
  console.error("  export SCHWAB_CLIENT_ID=your_client_id");
  console.error("  export SCHWAB_CLIENT_SECRET=your_client_secret");
  process.exit(1);
}

const cmd = process.argv[2] || "auth";

if (cmd === "status") {
  const tokens = loadTokens();
  if (!tokens) {
    console.log("No tokens found. Run: bun run src/auth/cli.ts auth");
    process.exit(1);
  }
  const expired = isTokenExpired();
  const now = Date.now() / 1000;
  const remaining = Math.max(0, tokens.token.expires_at - now);
  const age = (now - tokens.creation_timestamp) / 86400;
  console.log(`Access token: ${expired ? "EXPIRED" : `valid (${Math.round(remaining / 60)}m remaining)`}`);
  console.log(`Refresh token: ${tokens.token.refresh_token ? "present" : "MISSING"} (~${Math.round((7 - age) * 10) / 10}d remaining)`);
} else if (cmd === "refresh") {
  const result = await refreshAccessToken();
  if (result) {
    console.log("Token refreshed successfully!");
  } else {
    console.error("Refresh failed. Re-authentication required.");
    process.exit(1);
  }
} else if (cmd === "auth") {
  const authUrl = getAuthUrl();
  console.log("\n  SCHWAB OAUTH AUTHENTICATION");
  console.log("  " + "=".repeat(50));
  console.log(`\n  Auth URL: ${authUrl}\n`);
  console.log("  1. Open the URL above in a browser");
  console.log("  2. Log in to Schwab and authorize");
  console.log("  3. Paste the FULL redirect URL below\n");

  process.stdout.write("  Redirect URL: ");
  const reader = Bun.stdin.stream().getReader();
  const { value } = await reader.read();
  const redirectUrl = new TextDecoder().decode(value).trim();
  reader.releaseLock();

  if (!redirectUrl) {
    console.error("No URL provided");
    process.exit(1);
  }

  const result = await manualOAuth(redirectUrl);
  console.log(result.success ? `\n  ${result.message}` : `\n  Error: ${result.message}`);
  if (!result.success) process.exit(1);
} else {
  console.log("Usage: bun run src/auth/cli.ts [auth|status|refresh]");
}
