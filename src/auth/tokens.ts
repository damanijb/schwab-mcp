import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { getConfig, SCHWAB_TOKEN_URL } from "./config.js";

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface StoredTokens {
  creation_timestamp: number;
  token: TokenData;
}

let cachedTokens: StoredTokens | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function loadTokens(): StoredTokens | null {
  const { tokenPath } = getConfig();
  if (cachedTokens) return cachedTokens;
  if (!existsSync(tokenPath)) return null;
  try {
    cachedTokens = JSON.parse(readFileSync(tokenPath, "utf-8"));
    return cachedTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokenData: TokenData): void {
  const { tokenPath } = getConfig();
  const stored: StoredTokens = {
    creation_timestamp: Math.floor(Date.now() / 1000),
    token: tokenData,
  };
  mkdirSync(dirname(tokenPath), { recursive: true });
  writeFileSync(tokenPath, JSON.stringify(stored, null, 2));
  cachedTokens = stored;

  // Also write to the legacy schwab-py location for backward compat
  const legacyPath = `${process.env.HOME}/.config/schwab-portfolio-manager/schwab_token.json`;
  try {
    mkdirSync(dirname(legacyPath), { recursive: true });
    writeFileSync(legacyPath, JSON.stringify(stored, null, 2));
  } catch {
    // best-effort
  }
}

export function isTokenExpired(): boolean {
  const tokens = loadTokens();
  if (!tokens) return true;
  return Date.now() / 1000 > tokens.token.expires_at - 60;
}

export function getAccessToken(): string | null {
  const tokens = loadTokens();
  if (!tokens) return null;
  if (isTokenExpired()) return null;
  return tokens.token.access_token;
}

export async function refreshAccessToken(): Promise<TokenData | null> {
  const tokens = loadTokens();
  if (!tokens?.token.refresh_token) return null;

  const config = getConfig();
  const auth = btoa(`${config.clientId}:${config.clientSecret}`);

  try {
    const resp = await fetch(SCHWAB_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.token.refresh_token,
      }),
    });

    if (!resp.ok) {
      console.error(`Token refresh failed: ${resp.status} ${await resp.text()}`);
      return null;
    }

    const data = await resp.json();
    const tokenData: TokenData = {
      ...data,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 1800),
    };
    saveTokens(tokenData);
    return tokenData;
  } catch (err) {
    console.error("Token refresh error:", err);
    return null;
  }
}

export async function exchangeCodeForTokens(code: string): Promise<TokenData | null> {
  const config = getConfig();
  const auth = btoa(`${config.clientId}:${config.clientSecret}`);

  const resp = await fetch(SCHWAB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.callbackUrl,
    }),
  });

  if (!resp.ok) {
    console.error(`Token exchange failed: ${resp.status} ${await resp.text()}`);
    return null;
  }

  const data = await resp.json();
  const tokenData: TokenData = {
    ...data,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 1800),
  };
  saveTokens(tokenData);
  return tokenData;
}

export async function ensureValidToken(): Promise<string | null> {
  let token = getAccessToken();
  if (token) return token;

  const refreshed = await refreshAccessToken();
  if (refreshed) return refreshed.access_token;

  return null;
}

export function startTokenRefreshLoop(): void {
  if (refreshTimer) return;

  const doRefresh = async () => {
    if (isTokenExpired()) {
      const result = await refreshAccessToken();
      if (result) {
        console.error("[schwab-mcp] Token refreshed automatically");
      } else {
        console.error("[schwab-mcp] Auto-refresh failed — token may need re-auth");
      }
    }
  };

  // Refresh every 25 minutes (tokens last 30 min)
  refreshTimer = setInterval(doRefresh, 25 * 60 * 1000);
  // Also try immediately on start
  doRefresh();
}

export function stopTokenRefreshLoop(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
