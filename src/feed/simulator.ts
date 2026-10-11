import { INSTRUMENTS, type Instrument } from '../data/instruments';
import { roundToTick, TICK_SIZE, type Paise } from '../lib/money';
import type { Candle } from '../lib/candles';
import type { Quote } from './protocol';

/** Small seeded PRNG so tests and history are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng: () => number): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const TRADING_SECONDS_PER_YEAR = 252 * 6.25 * 3600;
/** Real intraday moves are tiny; boost them so the demo visibly moves. */
const DEMO_VOL_BOOST = 8;

export function stepSigma(vol: number, dtSec: number): number {
  return vol * DEMO_VOL_BOOST * Math.sqrt(dtSec / TRADING_SECONDS_PER_YEAR);
}

/**
 * Geometric Brownian motion price simulator. Runs identically in Node (the WebSocket
 * server) and in the browser (the offline/demo transport).
 */
export class MarketSimulator {
  private quotes = new Map<string, Quote>();
  private rng: () => number;

  constructor(
    private instruments: Instrument[] = INSTRUMENTS,
    seed: number = Date.now(),
    now: number = Date.now(),
  ) {
    this.rng = mulberry32(seed);
    for (const inst of instruments) {
      const prevClose = inst.basePrice;
      const open = roundToTick(prevClose * (1 + (this.rng() - 0.5) * 0.01));
      this.quotes.set(
        inst.symbol,
        this.makeQuote(inst, { prevClose, open, high: open, low: open, ltp: open, volume: 0, ts: now }),
      );
    }
  }

  private makeQuote(inst: Instrument, base: Omit<Quote, 'symbol' | 'bid' | 'ask'>): Quote {
    const half = inst.isIndex ? 0 : Math.max(1, Math.round((base.ltp * 0.0001) / TICK_SIZE)) * TICK_SIZE;
    return { ...base, symbol: inst.symbol, bid: base.ltp - half, ask: base.ltp + half };
  }

  /** Advance the market by dtSec. Returns only the quotes that changed. */
  step(dtSec: number, now: number = Date.now()): Quote[] {
    const changed: Quote[] = [];
    for (const inst of this.instruments) {
      if (this.rng() > 0.55) continue; // not every symbol trades every tick
      const q = this.quotes.get(inst.symbol)!;
      const move = Math.exp(stepSigma(inst.vol, dtSec) * gaussian(this.rng));
      const ltp = Math.max(TICK_SIZE, roundToTick(q.ltp * move));
      const next = this.makeQuote(inst, {
        prevClose: q.prevClose,
        open: q.open,
        ltp,
        high: Math.max(q.high, ltp),
        low: Math.min(q.low, ltp),
        volume: inst.isIndex ? 0 : q.volume + 1 + Math.floor(this.rng() * 500),
        ts: now,
      });
      this.quotes.set(inst.symbol, next);
      changed.push(next);
    }
    return changed;
  }

  snapshot(): Quote[] {
    return [...this.quotes.values()];
  }
}

/**
 * Back-fills plausible candles that end exactly at `lastClose`, walking backwards in time,
 * so the chart has history on first load with no jump into live data.
 */
export function generateHistory(
  inst: Instrument,
  lastClose: Paise,
  count: number,
  intervalSec: number,
  currentBucket: number,
  seed = 1,
): Candle[] {
  const rng = mulberry32(seed);
  const sigma = stepSigma(inst.vol, intervalSec);
  const out: Candle[] = new Array(count);
  let close = lastClose;
  for (let i = count - 1; i >= 0; i--) {
    const open = Math.max(TICK_SIZE, roundToTick(close * Math.exp(sigma * gaussian(rng))));
    const wick = () => roundToTick(Math.abs(gaussian(rng)) * sigma * 0.5 * close);
    out[i] = {
      time: currentBucket - (count - i) * intervalSec,
      open,
      close,
      high: Math.max(open, close) + wick(),
      low: Math.max(TICK_SIZE, Math.min(open, close) - wick()),
    };
    close = open;
  }
  return out;
}
