---
name: order-management
description: Manage Schwab orders — view open orders, check order status, cancel orders, review transaction history. Use when user asks about open orders, order status, "cancel my order", transaction history, recent trades, or any order management request.
---

# Order Management

## View open orders
1. Call `get_orders` with the account and `status: "WORKING"`
2. Present each order: order ID, instruction (BUY/SELL), symbol, quantity, order type, price, status, filled quantity, entered time
3. If no account specified, check all accounts

## Check specific order
1. Call `get_order` with account and order_id
2. Present full order details including execution info if filled

## Cancel an order
1. Call `get_orders` to show working orders first (so user can identify the right one)
2. Confirm with user which order to cancel (by order ID)
3. Call `cancel_order` with the account and order_id
4. Verify cancellation by calling `get_order` to confirm status changed

## Transaction history
1. Call `get_transactions` with account, days (default 30), and type
2. Present: date, action (BUY/SELL), symbol, quantity, price, net amount
3. Sort by date descending
4. Summarize: total trades, net buys vs sells, most traded symbols

## Order status filter options
- WORKING: Active/pending orders
- FILLED: Completed orders
- CANCELLED: Cancelled orders
- EXPIRED: Expired orders
- ALL: Everything
