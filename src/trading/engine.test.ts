import { describe, expect, it } from 'vitest';
import type { Quote } from '../feed/protocol';
import {
  availableCash,
  avgPrice,
  cancelOrder,
  createAccount,
  matchOpenOrders,
  placeOrder,
  sellableQty,
  type Account,
  type OrderRequest,
} from './engine';

const quote = (ltp: number, over: Partial<Quote> = {}): Quote => ({
  symbol: 'INFY', ltp, open: ltp, high: ltp, low: ltp, prevClose: 1500_00,
  bid: ltp - 5, ask: ltp + 5, volume: 0, ts: 0, ...over,
});

let n = 0;
const place = (a: Account, req: Partial<OrderRequest>, q = quote(1500_00)) =>
  placeOrder(a, { symbol: 'INFY', side: 'BUY', type: 'MARKET', qty: 10, ...req }, q, 0, `o${++n}`);

describe('market orders', () => {
  it('buys at the ask and debits cash', () => {
    const { account, order } = place(createAccount(), {});
    expect(order).toMatchObject({ status: 'FILLED', fillPrice: 1500_05 });
    expect(account.cash).toBe(10_00_000_00 - 10 * 1500_05);
    expect(account.positions.INFY).toMatchObject({ qty: 10, cost: 10 * 1500_05 });
  });

  it('rejects when funds are insufficient', () => {
    const { order } = place(createAccount(1000_00), {});
    expect(order.status).toBe('REJECTED');
    expect(order.reason).toMatch(/Insufficient funds/);
  });

  it('rejects selling shares you do not own', () => {
    const { order } = place(createAccount(), { side: 'SELL' });
    expect(order.reason).toMatch(/don’t hold any INFY/);
  });

  it('rejects index orders', () => {
    const { order } = place(createAccount(), { symbol: 'NIFTY 50' });
    expect(order.status).toBe('REJECTED');
  });
});

describe('positions & P&L', () => {
  it('tracks weighted average and realised P&L without rounding drift', () => {
    let a = createAccount();
    a = place(a, { qty: 10 }, quote(1000_00, { ask: 1000_00 })).account;
    a = place(a, { qty: 20 }, quote(1003_00, { ask: 1003_00 })).account;
    expect(avgPrice(a.positions.INFY)).toBe(1002_00); // (10×1000 + 20×1003)/30

    a = place(a, { side: 'SELL', qty: 15 }, quote(1010_00, { bid: 1010_00 })).account;
    expect(a.positions.INFY.qty).toBe(15);
    expect(a.positions.INFY.realized).toBe(15 * (1010_00 - 1002_00));

    a = place(a, { side: 'SELL', qty: 15 }, quote(1010_00, { bid: 1010_00 })).account;
    expect(a.positions.INFY).toMatchObject({ qty: 0, cost: 0, realized: 30 * 8_00 });
    expect(a.cash).toBe(10_00_000_00 + 30 * 8_00);
  });
});

describe('limit orders', () => {
  it('blocks cash, then fills when the ask crosses the limit', () => {
    let a = place(createAccount(), { type: 'LIMIT', limitPrice: 1490_00 }).account;
    expect(a.orders[0].status).toBe('OPEN');
    expect(availableCash(a)).toBe(10_00_000_00 - 10 * 1490_00);

    a = matchOpenOrders(a, quote(1495_00), 1); // ask 1495.05 > limit: no fill
    expect(a.orders[0].status).toBe('OPEN');

    a = matchOpenOrders(a, quote(1489_00), 2); // ask 1489.05 ≤ limit: fills at the better price
    expect(a.orders[0]).toMatchObject({ status: 'FILLED', fillPrice: 1489_05 });
    expect(availableCash(a)).toBe(10_00_000_00 - 10 * 1489_05);
  });

  it('fills a marketable limit immediately at the market price', () => {
    const { order } = place(createAccount(), { type: 'LIMIT', limitPrice: 1510_00 });
    expect(order).toMatchObject({ status: 'FILLED', fillPrice: 1500_05 });
  });

  it('reserves shares for open sells so you cannot oversell', () => {
    let a = place(createAccount(), { qty: 10 }).account;
    a = place(a, { side: 'SELL', type: 'LIMIT', limitPrice: 1600_00, qty: 6 }).account;
    expect(sellableQty(a, 'INFY')).toBe(4);
    expect(place(a, { side: 'SELL', qty: 5 }).order.reason).toMatch(/at most 4/);
  });

  it('cancelling releases blocked cash', () => {
    let a = place(createAccount(), { type: 'LIMIT', limitPrice: 1490_00 }).account;
    a = cancelOrder(a, a.orders[0].id, 1);
    expect(a.orders[0].status).toBe('CANCELLED');
    expect(availableCash(a)).toBe(10_00_000_00);
  });

  it('enforces tick size and price band', () => {
    expect(place(createAccount(), { type: 'LIMIT', limitPrice: 1490_03 }).order.reason).toMatch(/multiple of ₹0.05/);
    expect(place(createAccount(), { type: 'LIMIT', limitPrice: 2000_00 }).order.reason).toMatch(/between/);
  });
});
