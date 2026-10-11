import { describe, expect, it } from 'vitest';
import { blackScholes } from './blackScholes';
import { buildChain } from './optionChain';

const base = { spot: 100, strike: 100, t: 1, r: 0.05, iv: 0.2 };

describe('blackScholes', () => {
  it('matches textbook values (S=K=100, T=1, r=5%, σ=20%)', () => {
    expect(blackScholes({ ...base, type: 'CE' }).price).toBeCloseTo(10.4506, 3);
    expect(blackScholes({ ...base, type: 'PE' }).price).toBeCloseTo(5.5735, 3);
  });

  it('satisfies put–call parity', () => {
    for (const strike of [80, 95, 100, 120]) {
      const c = blackScholes({ ...base, strike, type: 'CE' }).price;
      const p = blackScholes({ ...base, strike, type: 'PE' }).price;
      expect(c - p).toBeCloseTo(base.spot - strike * Math.exp(-base.r * base.t), 6);
    }
  });

  it('returns intrinsic value at expiry', () => {
    expect(blackScholes({ ...base, strike: 90, t: 0, type: 'CE' })).toEqual({ price: 10, delta: 1 });
    expect(blackScholes({ ...base, strike: 90, t: 0, type: 'PE' })).toEqual({ price: 0, delta: 0 });
  });
});

describe('buildChain', () => {
  const rows = buildChain(25_150_00);
  it('centres 21 strikes on the ATM strike', () => {
    expect(rows).toHaveLength(21);
    expect(rows[10].strike).toBe(25_150_00);
  });
  it('call prices fall and put prices rise as strike increases', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].call.price).toBeLessThanOrEqual(rows[i - 1].call.price);
      expect(rows[i].put.price).toBeGreaterThanOrEqual(rows[i - 1].put.price);
    }
  });
  it('prices are on the ₹0.05 tick', () => {
    for (const r of rows) expect(r.call.price % 5).toBe(0);
  });
});
