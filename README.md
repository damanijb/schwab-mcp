# schwab-mcp

MCP server for Charles Schwab brokerage — accounts, trading, and market data for AI agents.

Works with Claude Code, Claude Desktop, or any MCP-compatible client.

## Features

- **OAuth2 authentication** with automatic token refresh (every 25 min)
- **Account management** — balances, positions, preferences with alias support
- **Market data** — real-time quotes, price history, option chains, movers
- **Full trading** — equity orders, options, bracket orders, OCO, trailing stops
- **Safety first** — trading disabled by default, dry-run on all order tools

## Quick Start

### 1. Set credentials

```bash
export SCHWAB_CLIENT_ID="your_client_id"
export SCHWAB_CLIENT_SECRET="your_client_secret"
export SCHWAB_CALLBACK_URL="https://127.0.0.1:8182/callback"
```

### 2. Install dependencies

```bash
cd schwab-mcp
bun install
```

### 3. Authenticate

```bash
bun run auth
```

### 4. Run as MCP server

```bash
bun run start
```

## Claude Code Plugin

Install as a Claude Code plugin:

```json
{
  "extraKnownMarketplaces": {
    "schwab-mcp": {
      "source": {
        "source": "github",
        "repo": "damanijb/schwab-mcp"
      }
    }
  }
}
```

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "schwab": {
      "command": "bun",
      "args": ["run", "/path/to/schwab-mcp/src/index.ts"],
      "env": {
        "SCHWAB_CLIENT_ID": "your_id",
        "SCHWAB_CLIENT_SECRET": "your_secret",
        "SCHWAB_CALLBACK_URL": "https://127.0.0.1:8182/callback",
        "SCHWAB_ENABLE_TRADING": "true"
      }
    }
  }
}
```

## MCP Tools (25)

### Auth (3)
| Tool | Description |
|------|-------------|
| `auth_status` | Check token validity and expiration |
| `refresh_token` | Manually refresh access token |
| `start_oauth` | Start OAuth2 flow or exchange redirect URL |

### Accounts (4)
| Tool | Description |
|------|-------------|
| `get_account_numbers` | List account numbers and hashes |
| `get_accounts` | Balances and info (with alias support) |
| `get_positions` | Portfolio holdings with P&L |
| `get_user_preferences` | Account preferences |

### Market Data (5)
| Tool | Description |
|------|-------------|
| `get_quotes` | Real-time quotes for stocks/ETFs |
| `get_price_history` | OHLCV candles |
| `get_option_chain` | Option chain data |
| `get_market_hours` | Exchange hours |
| `get_movers` | Index top movers |

### Orders & Trading (8)
| Tool | Description |
|------|-------------|
| `get_orders` | List orders (filter by status) |
| `get_order` | Get specific order details |
| `get_transactions` | Transaction history |
| `place_equity_order` | Stock/ETF orders (market, limit, stop) |
| `place_option_order` | Single-leg option orders |
| `place_bracket_order` | Entry + take-profit + stop-loss |
| `place_oco_order` | One-cancels-other pair |
| `place_trailing_stop` | Trailing stop orders |
| `cancel_order` | Cancel pending order |

### Account Aliases

| Alias | Accounts |
|-------|----------|
| `all` | All 6 accounts |
| `damani` / `p1` | brownfam, brownjoint |
| `tarina` | tarina-spec, tarina-roth, tarina-ret1, tarina-ret2 |
| `p2`-`p5` | Individual Tarina accounts |

## Trading Safety

- Trading disabled by default — set `SCHWAB_ENABLE_TRADING=true`
- All order tools default to **dry-run** — pass `live: true` to execute
- Dry-run returns the full order JSON for review before execution

## Configuration

| Env Var | Description | Default |
|---------|-------------|---------|
| `SCHWAB_CLIENT_ID` | Schwab API client ID | (required) |
| `SCHWAB_CLIENT_SECRET` | Schwab API client secret | (required) |
| `SCHWAB_CALLBACK_URL` | OAuth callback URL | `https://127.0.0.1:8182/callback` |
| `SCHWAB_TOKEN_PATH` | Token storage path | `~/.config/schwab-mcp/tokens.json` |
| `SCHWAB_ENABLE_TRADING` | Enable write operations | `false` |

Also supports `~/.config/schwab-mcp/config.json` for persistent configuration.

## License

MIT
