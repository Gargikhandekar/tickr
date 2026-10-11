/**
 * All prices and amounts in the app are integer paise (₹1 = 100 paise).
 * Floats like 0.1 + 0.2 !== 0.3 are unacceptable when showing someone their money,
 * so we only convert to rupees at the very edge: formatting for display.
 */
export type Paise = number;

/** NSE equity tick size: ₹0.05 */
export const TICK_SIZE: Paise = 5;

const twoDp = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(p: Paise): string {
  return twoDp.format(p / 100);
}

export function formatINR(p: Paise): string {
  return (p < 0 ? '−' : '') + '₹' + twoDp.format(Math.abs(p) / 100);
}

export function formatSigned(p: Paise): string {
  if (p === 0) return twoDp.format(0);
  return (p > 0 ? '+' : '−') + twoDp.format(Math.abs(p) / 100);
}

export function formatPct(pct: number): string {
  const abs = Math.abs(pct).toFixed(2);
  if (abs === '0.00') return '0.00%';
  return (pct > 0 ? '+' : '−') + abs + '%';
}

export function roundToTick(p: number, tick: Paise = TICK_SIZE): Paise {
  return Math.round(p / tick) * tick;
}

export function isOnTick(p: Paise, tick: Paise = TICK_SIZE): boolean {
  return Number.isInteger(p) && p % tick === 0;
}

/**
 * Parses user input like "1,412.5" into paise without ever going through a float.
 * Returns null for anything that isn't a plain non-negative amount with ≤ 2 decimals.
 */
export function parseRupees(input: string): Paise | null {
  const s = input.trim().replace(/,/g, '');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const rupees = Number(m[1]);
  const fraction = Number((m[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(rupees * 100)) return null;
  return rupees * 100 + fraction;
}

/** Paise → "1412.50" for prefilling inputs (no grouping separators). */
export function toInputValue(p: Paise): string {
  return (p / 100).toFixed(2);
}

export function pctChange(ltp: Paise, prevClose: Paise): number {
  return prevClose === 0 ? 0 : ((ltp - prevClose) / prevClose) * 100;
}
