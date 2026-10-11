import { blackScholes } from './blackScholes';
import { roundToTick, TICK_SIZE, type Paise } from './money';

export interface OptionQuote {
  price: Paise;
  delta: number;
}

export interface ChainRow {
  strike: Paise;
  iv: number;
  call: OptionQuote;
  put: OptionQuote;
}

export interface ChainOptions {
  step: Paise;
  strikesEachSide: number;
  daysToExpiry: number;
  rate: number;
  baseIV: number;
}

export const DEFAULT_CHAIN: ChainOptions = {
  step: 50_00,
  strikesEachSide: 10,
  daysToExpiry: 7,
  rate: 0.065,
  baseIV: 0.12,
};

/** Simple volatility smile with put skew: OTM puts carry higher IV than OTM calls. */
export function smileIV(spot: number, strike: number, baseIV: number): number {
  const m = Math.log(strike / spot);
  return baseIV + 0.9 * m * m + (m < 0 ? -0.15 * m : 0);
}

export function atmStrike(spot: Paise, step: Paise): Paise {
  return Math.round(spot / step) * step;
}

export function buildChain(spot: Paise, opts: ChainOptions = DEFAULT_CHAIN): ChainRow[] {
  const atm = atmStrike(spot, opts.step);
  const t = opts.daysToExpiry / 365;
  const rows: ChainRow[] = [];
  for (let i = -opts.strikesEachSide; i <= opts.strikesEachSide; i++) {
    const strike = atm + i * opts.step;
    const iv = smileIV(spot, strike, opts.baseIV);
    const quote = (type: 'CE' | 'PE'): OptionQuote => {
      const { price, delta } = blackScholes({ spot, strike, t, r: opts.rate, iv, type });
      return { price: Math.max(TICK_SIZE, roundToTick(price)), delta };
    };
    rows.push({ strike, iv, call: quote('CE'), put: quote('PE') });
  }
  return rows;
}
