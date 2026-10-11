import type { Paise } from '../lib/money';

export interface Instrument {
  symbol: string;
  name: string;
  /** Previous close used to seed the simulator, in paise. Prices are simulated, not real. */
  basePrice: Paise;
  /** Annualised volatility used by the simulator. */
  vol: number;
  isIndex?: boolean;
}

export const INSTRUMENTS: Instrument[] = [
  { symbol: 'NIFTY 50', name: 'Nifty 50 Index', basePrice: 25_150_00, vol: 0.13, isIndex: true },
  { symbol: 'RELIANCE', name: 'Reliance Industries', basePrice: 1_412_40, vol: 0.24 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', basePrice: 3_088_65, vol: 0.22 },
  { symbol: 'INFY', name: 'Infosys', basePrice: 1_502_10, vol: 0.26 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', basePrice: 968_35, vol: 0.2 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', basePrice: 1_376_80, vol: 0.22 },
  { symbol: 'SBIN', name: 'State Bank of India', basePrice: 872_45, vol: 0.28 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', basePrice: 684_20, vol: 0.34 },
  { symbol: 'ZOMATO', name: 'Zomato (Eternal)', basePrice: 318_75, vol: 0.45 },
];

export const UNDERLYING = 'NIFTY 50';

const bySymbol = new Map(INSTRUMENTS.map((i) => [i.symbol, i]));
export function getInstrument(symbol: string): Instrument | undefined {
  return bySymbol.get(symbol);
}
