import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface SchwabConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  tokenPath: string;
  enableTrading: boolean;
}

const CONFIG_DIR = join(homedir(), ".config", "schwab-mcp");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function loadConfigFile(): Partial<SchwabConfig> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    return {
      clientId: raw.clientId,
      clientSecret: raw.clientSecret,
      callbackUrl: raw.callbackUrl,
      tokenPath: raw.tokenPath,
    };
  } catch {
    return {};
  }
}

export function saveConfigFile(config: {
  clientId: string;
  clientSecret: string;
  callbackUrl?: string;
}): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = loadConfigFile();
  const merged = {
    ...existing,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    callbackUrl: config.callbackUrl || existing.callbackUrl || "https://127.0.0.1:8182/callback",
    tokenPath: existing.tokenPath || join(CONFIG_DIR, "tokens.json"),
  };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function getConfig(): SchwabConfig {
  const file = loadConfigFile();
  return {
    clientId: process.env.SCHWAB_CLIENT_ID || file.clientId || "",
    clientSecret: process.env.SCHWAB_CLIENT_SECRET || file.clientSecret || "",
    callbackUrl:
      process.env.SCHWAB_CALLBACK_URL ||
      file.callbackUrl ||
      "https://127.0.0.1:8182/callback",
    tokenPath:
      process.env.SCHWAB_TOKEN_PATH ||
      file.tokenPath ||
      join(CONFIG_DIR, "tokens.json"),
    enableTrading: process.env.SCHWAB_ENABLE_TRADING === "true",
  };
}

export function isConfigured(): boolean {
  const config = getConfig();
  return !!(config.clientId && config.clientSecret);
}

export const SCHWAB_AUTH_URL = "https://api.schwabapi.com/v1/oauth/authorize";
export const SCHWAB_TOKEN_URL = "https://api.schwabapi.com/v1/oauth/token";
export const CONFIG_DIR_PATH = CONFIG_DIR;
