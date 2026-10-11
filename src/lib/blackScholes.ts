/** Standard normal CDF (Abramowitz & Stegun 26.2.17, max error ~7.5e-8). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

export interface BSInput {
  spot: number;
  strike: number;
  /** Years to expiry */
  t: number;
  /** Risk-free rate, e.g. 0.065 */
  r: number;
  /** Implied volatility, e.g. 0.14 */
  iv: number;
  type: 'CE' | 'PE';
}

export interface BSOutput {
  price: number;
  delta: number;
}

/** Black–Scholes price and delta for a European option. Units of price follow `spot`. */
export function blackScholes({ spot, strike, t, r, iv, type }: BSInput): BSOutput {
  if (t <= 0 || iv <= 0) {
    const intrinsic = type === 'CE' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    const delta = type === 'CE' ? (spot > strike ? 1 : 0) : spot < strike ? -1 : 0;
    return { price: intrinsic, delta };
  }
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(spot / strike) + (r + (iv * iv) / 2) * t) / (iv * sqrtT);
  const d2 = d1 - iv * sqrtT;
  const discount = Math.exp(-r * t);
  if (type === 'CE') {
    return { price: spot * normCdf(d1) - strike * discount * normCdf(d2), delta: normCdf(d1) };
  }
  return { price: strike * discount * normCdf(-d2) - spot * normCdf(-d1), delta: normCdf(d1) - 1 };
}
