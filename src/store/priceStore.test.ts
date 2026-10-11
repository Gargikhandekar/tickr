import { describe, expect, it, vi } from 'vitest';
import type { Quote } from '../feed/protocol';
import { backoffDelay } from '../feed/client';
import { parseServerMessage } from '../feed/protocol';
import { PriceStore } from './priceStore';

const q = (symbol: string, ltp: number, ts: number): Quote => ({
  symbol, ltp, ts, open: ltp, high: ltp, low: ltp, prevClose: ltp, bid: ltp, ask: ltp, volume: 0,
});

function manualStore() {
  const queue: (() => void)[] = [];
  const store = new PriceStore((cb) => queue.push(cb));
  return { store, frame: () => queue.splice(0).forEach((cb) => cb()) };
}

describe('PriceStore', () => {
  it('coalesces a burst of ticks into one notification per frame', () => {
    const { store, frame } = manualStore();
    const listener = vi.fn();
    store.subscribe('TCS', listener);

    store.ingest([q('TCS', 100, 1)]);
    store.ingest([q('TCS', 101, 2)]);
    store.ingest([q('TCS', 102, 3)]);
    expect(listener).not.toHaveBeenCalled();

    frame();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get('TCS')?.ltp).toBe(102);
  });

  it('only notifies subscribers of symbols that changed', () => {
    const { store, frame } = manualStore();
    const tcs = vi.fn();
    const infy = vi.fn();
    store.subscribe('TCS', tcs);
    store.subscribe('INFY', infy);
    store.ingest([q('TCS', 100, 1)]);
    frame();
    expect(tcs).toHaveBeenCalledTimes(1);
    expect(infy).not.toHaveBeenCalled();
  });

  it('drops out-of-order ticks', () => {
    const { store, frame } = manualStore();
    store.ingest([q('TCS', 100, 5)]);
    store.ingest([q('TCS', 90, 4)]);
    frame();
    expect(store.get('TCS')?.ltp).toBe(100);
  });

  it('still shows every tick to raw listeners', () => {
    const { store } = manualStore();
    const raw = vi.fn();
    store.onRawTick(raw);
    store.ingest([q('TCS', 100, 1), q('TCS', 101, 2)]);
    expect(raw).toHaveBeenCalledTimes(2);
  });
});

describe('feed helpers', () => {
  it('backs off exponentially with a cap', () => {
    expect(backoffDelay(1, () => 1)).toBe(500);
    expect(backoffDelay(3, () => 1)).toBe(2000);
    expect(backoffDelay(20, () => 1)).toBe(15000);
    expect(backoffDelay(3, () => 0)).toBe(1000); // jitter floor is 50%
  });

  it('rejects malformed server messages', () => {
    expect(parseServerMessage('not json')).toBeNull();
    expect(parseServerMessage('{"type":"ticks"}')).toBeNull();
    const m = parseServerMessage(JSON.stringify({ type: 'ticks', quotes: [q('TCS', 1, 1), { symbol: 'BAD' }] }));
    expect(m?.type === 'ticks' && m.quotes).toHaveLength(1);
  });
});
