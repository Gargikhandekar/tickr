import { describe, expect, it } from 'vitest';
import { applyPrice, type Candle } from './candles';

const T0 = 1_700_000_000_000; // ms, aligned to a 5s bucket

describe('applyPrice', () => {
  it('opens a candle on the first tick', () => {
    const s: Candle[] = [];
    applyPrice(s, 100, T0, 5);
    expect(s).toEqual([{ time: T0 / 1000, open: 100, high: 100, low: 100, close: 100 }]);
  });

  it('extends high/low/close within the same bucket', () => {
    const s: Candle[] = [];
    applyPrice(s, 100, T0, 5);
    applyPrice(s, 110, T0 + 1000, 5);
    applyPrice(s, 95, T0 + 2000, 5);
    applyPrice(s, 102, T0 + 4999, 5);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ open: 100, high: 110, low: 95, close: 102 });
  });

  it('opens the next candle at the previous close (no gaps)', () => {
    const s: Candle[] = [];
    applyPrice(s, 100, T0, 5);
    applyPrice(s, 120, T0 + 5000, 5);
    expect(s[1]).toMatchObject({ time: T0 / 1000 + 5, open: 100, high: 120, low: 100, close: 120 });
  });

  it('ignores a late tick for a closed bucket', () => {
    const s: Candle[] = [];
    applyPrice(s, 100, T0 + 5000, 5);
    applyPrice(s, 999, T0, 5);
    expect(s).toHaveLength(1);
    expect(s[0].high).toBe(100);
  });
});
