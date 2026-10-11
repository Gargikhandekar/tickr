import { describe, expect, it } from 'vitest';
import { formatINR, formatPct, formatSigned, isOnTick, parseRupees, roundToTick } from './money';

describe('parseRupees', () => {
  it.each([
    ['1412.5', 141250],
    ['1,412.50', 141250],
    ['0.05', 5],
    ['  25 ', 2500],
    ['0.1', 10],
  ])('parses %s → %i paise', (input, paise) => expect(parseRupees(input)).toBe(paise));

  it.each(['', 'abc', '1.234', '-5', '1e3', '12.'])('rejects %j', (input) => expect(parseRupees(input)).toBeNull());

  it('avoids float drift that Number("0.1")*100 + Number("0.2")*100 would introduce', () => {
    expect(parseRupees('0.1')! + parseRupees('0.2')!).toBe(parseRupees('0.3'));
  });
});

describe('formatting', () => {
  it('uses Indian digit grouping', () => expect(formatINR(10_00_000_00)).toBe('₹10,00,000.00'));
  it('signs P&L', () => {
    expect(formatSigned(1250)).toBe('+12.50');
    expect(formatSigned(-1250)).toBe('−12.50');
    expect(formatSigned(0)).toBe('0.00');
  });
  it('never shows −0.00%', () => expect(formatPct(-0.001)).toBe('0.00%'));
});

describe('ticks', () => {
  it('rounds to ₹0.05', () => expect(roundToTick(141253)).toBe(141255));
  it('validates tick size', () => {
    expect(isOnTick(141255)).toBe(true);
    expect(isOnTick(141253)).toBe(false);
  });
});
