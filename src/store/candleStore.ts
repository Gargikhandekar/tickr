import { getInstrument } from '../data/instruments';
import type { Quote } from '../feed/protocol';
import { generateHistory, hashString } from '../feed/simulator';
import { applyPrice, bucketStart, type Candle } from '../lib/candles';
import { priceStore } from './priceStore';

export const CANDLE_SEC = 5;
const HISTORY_CANDLES = 240;
const MAX_CANDLES = 720;

const series = new Map<string, Candle[]>();
const dirty = new Set<string>();
const listeners = new Map<string, Set<(c: Candle) => void>>();

function ensureSeries(q: Quote): Candle[] {
  let s = series.get(q.symbol);
  if (!s) {
    const inst = getInstrument(q.symbol);
    s = inst
      ? generateHistory(inst, q.ltp, HISTORY_CANDLES, CANDLE_SEC, bucketStart(q.ts, CANDLE_SEC), hashString(q.symbol))
      : [];
    series.set(q.symbol, s);
  }
  return s;
}

/**
 * Candles are built for every symbol in the background from *every* tick (not the
 * per-frame coalesced quote) so highs and lows are exact, but the chart is only
 * notified once per frame.
 */
export function startCandleStore(): () => void {
  const offRaw = priceStore.onRawTick((q) => {
    const s = ensureSeries(q);
    applyPrice(s, q.ltp, q.ts, CANDLE_SEC);
    if (s.length > MAX_CANDLES) s.splice(0, s.length - MAX_CANDLES);
    dirty.add(q.symbol);
  });
  const offFlush = priceStore.onFlush(() => {
    for (const symbol of dirty) {
      const s = series.get(symbol);
      const last = s?.[s.length - 1];
      if (last) listeners.get(symbol)?.forEach((l) => l(last));
    }
    dirty.clear();
  });
  return () => {
    offRaw();
    offFlush();
  };
}

export function getCandles(symbol: string): Candle[] {
  const s = series.get(symbol);
  if (s) return s;
  const q = priceStore.get(symbol);
  return q ? ensureSeries(q) : [];
}

export function subscribeCandles(symbol: string, listener: (c: Candle) => void): () => void {
  let set = listeners.get(symbol);
  if (!set) listeners.set(symbol, (set = new Set()));
  set.add(listener);
  return () => set!.delete(listener);
}
