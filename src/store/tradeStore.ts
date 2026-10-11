import { useSyncExternalStore } from 'react';
import {
  cancelOrder,
  createAccount,
  matchOpenOrders,
  placeOrder,
  type Account,
  type Order,
  type OrderRequest,
} from '../trading/engine';
import { priceStore } from './priceStore';

const STORAGE_KEY = 'tickr.account.v1';

function load(): Account {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createAccount();
    const parsed = JSON.parse(raw) as Account;
    if (typeof parsed.cash === 'number' && Array.isArray(parsed.orders) && parsed.positions) return parsed;
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return createAccount();
}

function save(a: Account): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    /* storage full or blocked: the session still works in memory */
  }
}

let state: Account = load();
const listeners = new Set<() => void>();
let seq = 0;

function setState(next: Account): void {
  if (next === state) return;
  state = next;
  save(state);
  listeners.forEach((l) => l());
}

export const tradeStore = {
  get: (): Account => state,
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  place(req: OrderRequest): Order {
    const id = `ORD-${Date.now().toString(36).toUpperCase()}-${++seq}`;
    const { account, order } = placeOrder(state, req, priceStore.get(req.symbol), Date.now(), id);
    setState(account);
    return order;
  },
  cancel(id: string): void {
    setState(cancelOrder(state, id, Date.now()));
  },
  reset(): void {
    setState(createAccount());
  },
};

/** Match open limit orders against every tick, not just the coalesced per-frame quote. */
export function startOrderMatching(): () => void {
  return priceStore.onRawTick((q) => {
    if (!state.orders.some((o) => o.status === 'OPEN' && o.symbol === q.symbol)) return;
    setState(matchOpenOrders(state, q, Date.now()));
  });
}

export function useAccount(): Account {
  return useSyncExternalStore(tradeStore.subscribe, tradeStore.get);
}
