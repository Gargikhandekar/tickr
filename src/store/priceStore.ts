import { useSyncExternalStore } from 'react';
import type { Quote } from '../feed/protocol';

type Listener = () => void;
type FlushListener = (changed: Quote[]) => void;
type RawListener = (quote: Quote) => void;
type Scheduler = (cb: () => void) => void;

const defaultScheduler: Scheduler =
  typeof requestAnimationFrame === 'function' ? (cb) => requestAnimationFrame(cb) : (cb) => setTimeout(cb, 16);

/**
 * Holds the latest quote per symbol, outside React.
 *
 * Why not useState/Context? A tick for RELIANCE would re-render every component that reads
 * the context. Here each row subscribes to *its* symbol only, and bursts of ticks are
 * coalesced into a single update per animation frame — at most one render per row per frame,
 * no matter how fast the feed is.
 */
export class PriceStore {
  private quotes = new Map<string, Quote>();
  private pending = new Map<string, Quote>();
  private symbolListeners = new Map<string, Set<Listener>>();
  private flushListeners = new Set<FlushListener>();
  private rawListeners = new Set<RawListener>();
  private scheduled = false;

  /** Increments once per flush; handy for components that need "any price changed". */
  version = 0;
  stats = { ticks: 0, flushes: 0 };

  constructor(private schedule: Scheduler = defaultScheduler) {}

  ingest(quotes: Quote[]): void {
    for (const q of quotes) {
      const prev = this.pending.get(q.symbol) ?? this.quotes.get(q.symbol);
      if (prev && q.ts < prev.ts) continue; // stale / out-of-order update
      this.pending.set(q.symbol, q);
      this.stats.ticks++;
      // Raw listeners see every tick (candles, order matching) so no print is lost to coalescing.
      this.rawListeners.forEach((l) => l(q));
    }
    if (!this.scheduled && this.pending.size > 0) {
      this.scheduled = true;
      this.schedule(this.flush);
    }
  }

  flush = (): void => {
    this.scheduled = false;
    if (this.pending.size === 0) return;
    const changed = [...this.pending.values()];
    this.pending.clear();
    for (const q of changed) this.quotes.set(q.symbol, q);
    this.version++;
    this.stats.flushes++;
    for (const q of changed) this.symbolListeners.get(q.symbol)?.forEach((l) => l());
    this.flushListeners.forEach((l) => l(changed));
  };

  get(symbol: string): Quote | undefined {
    return this.quotes.get(symbol);
  }

  subscribe(symbol: string, listener: Listener): () => void {
    let set = this.symbolListeners.get(symbol);
    if (!set) this.symbolListeners.set(symbol, (set = new Set()));
    set.add(listener);
    return () => set!.delete(listener);
  }

  onFlush(listener: FlushListener): () => void {
    this.flushListeners.add(listener);
    return () => this.flushListeners.delete(listener);
  }

  onRawTick(listener: RawListener): () => void {
    this.rawListeners.add(listener);
    return () => this.rawListeners.delete(listener);
  }

  reset(): void {
    this.quotes.clear();
    this.pending.clear();
    this.version++;
  }
}

export const priceStore = new PriceStore();

/** Re-renders only when this symbol's quote changes. */
export function useQuote(symbol: string): Quote | undefined {
  return useSyncExternalStore(
    (cb) => priceStore.subscribe(symbol, cb),
    () => priceStore.get(symbol),
  );
}

/** Re-renders once per frame in which any price changed. Use sparingly (totals, P&L). */
export function usePriceVersion(): number {
  return useSyncExternalStore(
    (cb) => priceStore.onFlush(() => cb()),
    () => priceStore.version,
  );
}
