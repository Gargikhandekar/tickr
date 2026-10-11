import type { Paise } from '../lib/money';

/** One market data update. Shared by the WebSocket server and the browser client. */
export interface Quote {
  symbol: string;
  ltp: Paise;
  open: Paise;
  high: Paise;
  low: Paise;
  prevClose: Paise;
  bid: Paise;
  ask: Paise;
  volume: number;
  /** Exchange timestamp, ms since epoch */
  ts: number;
}

export type ServerMessage =
  | { type: 'snapshot'; quotes: Quote[] }
  | { type: 'ticks'; quotes: Quote[] }
  | { type: 'heartbeat'; ts: number };

export const TICK_INTERVAL_MS = 100;
export const HEARTBEAT_MS = 1000;
/** No message for this long while "live" → show the feed as stale. */
export const STALE_AFTER_MS = 3000;

const QUOTE_NUMBER_FIELDS = ['ltp', 'open', 'high', 'low', 'prevClose', 'bid', 'ask', 'volume', 'ts'] as const;

function isQuote(x: unknown): x is Quote {
  if (typeof x !== 'object' || x === null) return false;
  const q = x as Record<string, unknown>;
  return typeof q.symbol === 'string' && QUOTE_NUMBER_FIELDS.every((k) => Number.isFinite(q[k]));
}

/** Never trust the wire: malformed messages are dropped instead of corrupting the UI. */
export function parseServerMessage(raw: string): ServerMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.type === 'heartbeat' && Number.isFinite(m.ts)) return { type: 'heartbeat', ts: m.ts as number };
  if ((m.type === 'snapshot' || m.type === 'ticks') && Array.isArray(m.quotes)) {
    return { type: m.type, quotes: m.quotes.filter(isQuote) };
  }
  return null;
}
