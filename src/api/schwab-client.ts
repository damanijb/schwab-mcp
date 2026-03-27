import { ensureValidToken } from "../auth/tokens.js";

const TRADER_BASE = "https://api.schwabapi.com/trader/v1";
const MARKET_BASE = "https://api.schwabapi.com/marketdata/v1";

export class SchwabApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`Schwab API error ${status}: ${body}`);
    this.name = "SchwabApiError";
  }
}

async function request(url: string, options: RequestInit = {}): Promise<any> {
  const token = await ensureValidToken();
  if (!token) {
    throw new Error(
      "No valid access token. Run the start_oauth tool or refresh_token tool first."
    );
  }

  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...options.headers as Record<string, string>,
  };
  // Schwab rejects GET requests that include Content-Type
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  const resp = await fetch(url, {
    ...options,
    headers,
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new SchwabApiError(resp.status, body);
  }

  const text = await resp.text();
  if (!text) return { success: true, status: resp.status, headers: Object.fromEntries(resp.headers.entries()) };
  return JSON.parse(text);
}

// --- Account endpoints ---

export async function getAccountNumbers(): Promise<any> {
  return request(`${TRADER_BASE}/accounts/accountNumbers`);
}

export async function getAccounts(withPositions = false): Promise<any> {
  const fields = withPositions ? "?fields=positions" : "";
  return request(`${TRADER_BASE}/accounts${fields}`);
}

export async function getAccount(accountHash: string, withPositions = false): Promise<any> {
  const fields = withPositions ? "?fields=positions" : "";
  return request(`${TRADER_BASE}/accounts/${accountHash}${fields}`);
}

export async function getUserPreferences(): Promise<any> {
  return request(`${TRADER_BASE}/userPreference`);
}

// --- Order endpoints ---

export async function getOrders(
  accountHash: string,
  params: {
    maxResults?: number;
    fromEnteredTime?: string;
    toEnteredTime?: string;
    status?: string;
  } = {}
): Promise<any> {
  const searchParams = new URLSearchParams();
  if (params.maxResults) searchParams.set("maxResults", String(params.maxResults));
  if (params.fromEnteredTime) searchParams.set("fromEnteredTime", params.fromEnteredTime);
  if (params.toEnteredTime) searchParams.set("toEnteredTime", params.toEnteredTime);
  if (params.status) searchParams.set("status", params.status);

  // Default to last 60 days if no dates
  if (!params.fromEnteredTime) {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    searchParams.set("fromEnteredTime", d.toISOString().split("T")[0]);
    searchParams.set("toEnteredTime", new Date().toISOString().split("T")[0]);
  }

  const qs = searchParams.toString();
  return request(`${TRADER_BASE}/accounts/${accountHash}/orders${qs ? `?${qs}` : ""}`);
}

export async function getOrder(accountHash: string, orderId: string): Promise<any> {
  return request(`${TRADER_BASE}/accounts/${accountHash}/orders/${orderId}`);
}

export async function placeOrder(accountHash: string, order: any): Promise<any> {
  const token = await ensureValidToken();
  if (!token) throw new Error("No valid access token");

  const resp = await fetch(`${TRADER_BASE}/accounts/${accountHash}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(order),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new SchwabApiError(resp.status, body);
  }

  const location = resp.headers.get("Location") || "";
  const orderId = location.split("/").pop() || "";
  return { success: true, orderId, location, status: resp.status };
}

export async function cancelOrder(accountHash: string, orderId: string): Promise<any> {
  const token = await ensureValidToken();
  if (!token) throw new Error("No valid access token");

  const resp = await fetch(
    `${TRADER_BASE}/accounts/${accountHash}/orders/${orderId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new SchwabApiError(resp.status, body);
  }
  return { success: true, orderId };
}

// --- Transaction endpoints ---

export async function getTransactions(
  accountHash: string,
  params: {
    startDate?: string;
    endDate?: string;
    types?: string;
  } = {}
): Promise<any> {
  const searchParams = new URLSearchParams();
  searchParams.set("types", params.types || "TRADE");
  if (params.startDate) searchParams.set("startDate", params.startDate);
  else {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    searchParams.set("startDate", d.toISOString().split("T")[0]);
  }
  searchParams.set("endDate", params.endDate || new Date().toISOString().split("T")[0]);

  return request(`${TRADER_BASE}/accounts/${accountHash}/transactions?${searchParams}`);
}

// --- Market Data endpoints ---

export async function getQuotes(symbols: string[], fields = "quote"): Promise<any> {
  const params = new URLSearchParams({
    symbols: symbols.join(","),
    fields,
  });
  return request(`${MARKET_BASE}/quotes?${params}`);
}

export async function getPriceHistory(
  symbol: string,
  params: {
    periodType?: string;
    period?: number;
    frequencyType?: string;
    frequency?: number;
    startDate?: number;
    endDate?: number;
  } = {}
): Promise<any> {
  const searchParams = new URLSearchParams();
  if (params.periodType) searchParams.set("periodType", params.periodType);
  if (params.period) searchParams.set("period", String(params.period));
  if (params.frequencyType) searchParams.set("frequencyType", params.frequencyType);
  if (params.frequency) searchParams.set("frequency", String(params.frequency));
  if (params.startDate) searchParams.set("startDate", String(params.startDate));
  if (params.endDate) searchParams.set("endDate", String(params.endDate));

  return request(`${MARKET_BASE}/pricehistory?symbol=${symbol}&${searchParams}`);
}

export async function getOptionChain(
  symbol: string,
  params: {
    contractType?: string;
    strikeCount?: number;
    includeUnderlyingQuote?: boolean;
    strategy?: string;
    range?: string;
    fromDate?: string;
    toDate?: string;
  } = {}
): Promise<any> {
  const searchParams = new URLSearchParams({ symbol });
  if (params.contractType) searchParams.set("contractType", params.contractType);
  if (params.strikeCount) searchParams.set("strikeCount", String(params.strikeCount));
  if (params.includeUnderlyingQuote !== undefined)
    searchParams.set("includeUnderlyingQuote", String(params.includeUnderlyingQuote));
  if (params.strategy) searchParams.set("strategy", params.strategy);
  if (params.range) searchParams.set("range", params.range);
  if (params.fromDate) searchParams.set("fromDate", params.fromDate);
  if (params.toDate) searchParams.set("toDate", params.toDate);

  return request(`${MARKET_BASE}/chains?${searchParams}`);
}

export async function getMarketHours(markets: string[], date?: string): Promise<any> {
  const params = new URLSearchParams({ markets: markets.join(",") });
  if (date) params.set("date", date);
  return request(`${MARKET_BASE}/markets?${params}`);
}

export async function getMovers(index: string, params: { sort?: string; frequency?: number } = {}): Promise<any> {
  const searchParams = new URLSearchParams();
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.frequency) searchParams.set("frequency", String(params.frequency));
  const qs = searchParams.toString();
  return request(`${MARKET_BASE}/movers/${index}${qs ? `?${qs}` : ""}`);
}
