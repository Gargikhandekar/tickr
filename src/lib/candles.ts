import type { Paise } from './money';

export interface Candle {
  /** Bucket start, seconds since epoch */
  time: number;
  open: Paise;
  high: Paise;
  low: Paise;
  close: Paise;
}

export function bucketStart(tsMs: number, intervalSec: number): number {
  return Math.floor(tsMs / 1000 / intervalSec) * intervalSec;
}

/**
 * Folds one traded price into a candle series and returns the candle it landed in.
 * - Same bucket: extend high/low, move close.
 * - New bucket: open at the previous close so the chart has no gaps.
 * - Late (out-of-order) tick for an older bucket: ignored, the closed candle stays as it was.
 */
export function applyPrice(series: Candle[], price: Paise, tsMs: number, intervalSec: number): Candle {
  const t = bucketStart(tsMs, intervalSec);
  const last = series[series.length - 1];

  if (last && t < last.time) return last;

  if (last && t === last.time) {
    const updated: Candle = {
      ...last,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
    };
    series[series.length - 1] = updated;
    return updated;
  }

  const open = last ? last.close : price;
  const candle: Candle = {
    time: t,
    open,
    high: Math.max(open, price),
    low: Math.min(open, price),
    close: price,
  };
  series.push(candle);
  return candle;
}
