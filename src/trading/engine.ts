import { getInstrument } from '../data/instruments';
import type { Quote } from '../feed/protocol';
import { formatINR, formatPrice, isOnTick, roundToTick, type Paise } from '../lib/money';

/**
 * A pure, framework-free paper-trading engine. Every function takes state and returns new
 * state, which makes it trivial to unit test and impossible for the UI to half-apply a fill.
 */

export type Side = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus = 'OPEN' | 'FILLED' | 'CANCELLED' | 'REJECTED';

export interface OrderRequest {
  symbol: string;
  side: Side;
  type: OrderType;
  qty: number;
  limitPrice?: Paise;
}

export interface Order extends OrderRequest {
  id: string;
  status: OrderStatus;
  fillPrice?: Paise;
  reason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Position {
  symbol: string;
  qty: number;
  /** Total cost of the open quantity. avg price = cost / qty. Kept as a total to avoid rounding drift. */
  cost: Paise;
  realized: Paise;
}

export interface Account {
  cash: Paise;
  orders: Order[];
  positions: Record<string, Position>;
}

export const INITIAL_CASH: Paise = 10_00_000_00; // ₹10,00,000
export const MAX_QTY = 1_00_000;
export const PRICE_BAND = 0.2; // ±20% of previous close

export function createAccount(cash: Paise = INITIAL_CASH): Account {
  return { cash, orders: [], positions: {} };
}

const openOrders = (a: Account) => a.orders.filter((o) => o.status === 'OPEN');

/** Cash held back for open buy limit orders. */
export function blockedCash(a: Account): Paise {
  return openOrders(a)
    .filter((o) => o.side === 'BUY')
    .reduce((sum, o) => sum + o.qty * (o.limitPrice ?? 0), 0);
}

export function availableCash(a: Account): Paise {
  return a.cash - blockedCash(a);
}

/** Shares you hold minus shares already promised to open sell orders. */
export function sellableQty(a: Account, symbol: string): number {
  const held = a.positions[symbol]?.qty ?? 0;
  const reserved = openOrders(a)
    .filter((o) => o.side === 'SELL' && o.symbol === symbol)
    .reduce((sum, o) => sum + o.qty, 0);
  return held - reserved;
}

export function avgPrice(p: Position): Paise {
  return p.qty === 0 ? 0 : Math.round(p.cost / p.qty);
}

export function priceBand(prevClose: Paise): { lower: Paise; upper: Paise } {
  return {
    lower: roundToTick(prevClose * (1 - PRICE_BAND)),
    upper: roundToTick(prevClose * (1 + PRICE_BAND)),
  };
}

/** Returns a human-readable reason the order can't be placed, or null if it's valid. */
export function validateOrder(a: Account, req: OrderRequest, quote: Quote | undefined): string | null {
  if (getInstrument(req.symbol)?.isIndex) return 'Indices can’t be traded directly';
  if (!quote) return 'Waiting for a live price';
  if (!Number.isInteger(req.qty) || req.qty <= 0) return 'Quantity must be a whole number above 0';
  if (req.qty > MAX_QTY) return 'Quantity can’t exceed 1,00,000 shares per order';

  let price: Paise;
  if (req.type === 'LIMIT') {
    if (req.limitPrice == null || req.limitPrice <= 0) return 'Enter a limit price';
    if (!isOnTick(req.limitPrice)) return 'Price must be a multiple of ₹0.05';
    const { lower, upper } = priceBand(quote.prevClose);
    if (req.limitPrice < lower || req.limitPrice > upper) {
      return `Price must be between ₹${formatPrice(lower)} and ₹${formatPrice(upper)}`;
    }
    price = req.limitPrice;
  } else {
    price = req.side === 'BUY' ? quote.ask : quote.bid;
  }

  if (req.side === 'BUY') {
    const needed = price * req.qty;
    const available = availableCash(a);
    if (needed > available) return `Insufficient funds: need ${formatINR(needed)}, available ${formatINR(available)}`;
  } else {
    const sellable = sellableQty(a, req.symbol);
    if (sellable <= 0) return `You don’t hold any ${req.symbol} to sell`;
    if (req.qty > sellable) return `You can sell at most ${sellable} ${req.symbol}`;
  }
  return null;
}

function applyFill(a: Account, order: Order, price: Paise, now: number): Account {
  const value = price * order.qty;
  const pos = a.positions[order.symbol] ?? { symbol: order.symbol, qty: 0, cost: 0, realized: 0 };
  let next: Position;
  let cash = a.cash;
  if (order.side === 'BUY') {
    next = { ...pos, qty: pos.qty + order.qty, cost: pos.cost + value };
    cash -= value;
  } else {
    const costOut = Math.round((pos.cost * order.qty) / pos.qty);
    next = { ...pos, qty: pos.qty - order.qty, cost: pos.cost - costOut, realized: pos.realized + value - costOut };
    cash += value;
  }
  const filled: Order = { ...order, status: 'FILLED', fillPrice: price, updatedAt: now };
  return {
    cash,
    positions: { ...a.positions, [order.symbol]: next },
    orders: a.orders.map((o) => (o.id === order.id ? filled : o)),
  };
}

/** Price an order would fill at right now, or null if a limit order isn't marketable. */
function executablePrice(order: OrderRequest, quote: Quote): Paise | null {
  if (order.type === 'MARKET') return order.side === 'BUY' ? quote.ask : quote.bid;
  const limit = order.limitPrice!;
  if (order.side === 'BUY') return quote.ask <= limit ? quote.ask : null;
  return quote.bid >= limit ? quote.bid : null;
}

export function placeOrder(
  a: Account,
  req: OrderRequest,
  quote: Quote | undefined,
  now: number,
  id: string,
): { account: Account; order: Order } {
  const base: Order = { ...req, id, status: 'OPEN', createdAt: now, updatedAt: now };
  const reason = validateOrder(a, req, quote);
  if (reason) {
    const rejected: Order = { ...base, status: 'REJECTED', reason };
    return { account: { ...a, orders: [rejected, ...a.orders] }, order: rejected };
  }
  const withOrder: Account = { ...a, orders: [base, ...a.orders] };
  const price = executablePrice(req, quote!);
  if (price === null) return { account: withOrder, order: base };
  const account = applyFill(withOrder, base, price, now);
  return { account, order: account.orders[0] };
}

/** Called on every tick: fills any open limit orders the new price crosses. */
export function matchOpenOrders(a: Account, quote: Quote, now: number): Account {
  let next = a;
  for (const o of a.orders) {
    if (o.status !== 'OPEN' || o.symbol !== quote.symbol) continue;
    const price = executablePrice(o, quote);
    if (price !== null) next = applyFill(next, o, price, now);
  }
  return next;
}

export function cancelOrder(a: Account, id: string, now: number): Account {
  return {
    ...a,
    orders: a.orders.map((o) => (o.id === id && o.status === 'OPEN' ? { ...o, status: 'CANCELLED', updatedAt: now } : o)),
  };
}

export function unrealizedPnl(p: Position, ltp: Paise): Paise {
  return p.qty * ltp - p.cost;
}
