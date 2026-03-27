#!/bin/bash
# Find bun and launch the schwab-mcp server
# This script exists because GUI apps (Claude Desktop, Cowork) don't inherit shell PATH

DIR="$(cd "$(dirname "$0")" && pwd)"

# Check common bun locations
for BUN in \
  "$(command -v bun 2>/dev/null)" \
  "$HOME/.bun/bin/bun" \
  "/usr/local/bin/bun" \
  "/opt/homebrew/bin/bun" \
  "$HOME/.local/bin/bun"; do
  if [ -x "$BUN" ] 2>/dev/null; then
    exec "$BUN" "$DIR/dist/index.js"
  fi
done

# Try node as fallback (won't work for OAuth browser flow, but basic tools work)
for NODE in \
  "$(command -v node 2>/dev/null)" \
  "/usr/local/bin/node" \
  "/opt/homebrew/bin/node"; do
  if [ -x "$NODE" ] 2>/dev/null; then
    exec "$NODE" "$DIR/dist/index.js"
  fi
done

echo "Error: bun not found. Install bun: curl -fsSL https://bun.sh/install | bash" >&2
exit 1
