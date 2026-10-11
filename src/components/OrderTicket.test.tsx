import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Quote } from '../feed/protocol';
import { priceStore } from '../store/priceStore';
import { tradeStore } from '../store/tradeStore';
import { OrderTicket } from './OrderTicket';

const infy: Quote = {
  symbol: 'INFY', ltp: 1500_00, open: 1500_00, high: 1500_00, low: 1500_00, prevClose: 1500_00,
  bid: 1499_95, ask: 1500_05, volume: 0, ts: Date.now(),
};

describe('OrderTicket', () => {
  beforeEach(() => {
    tradeStore.reset();
    priceStore.reset();
    act(() => {
      priceStore.ingest([{ ...infy, ts: Date.now() }]);
      priceStore.flush();
    });
  });
  afterEach(cleanup);

  it('places a market buy and confirms the fill price', async () => {
    render(<OrderTicket symbol="INFY" side="BUY" onSideChange={() => {}} />);
    const qty = screen.getByLabelText('Quantity');
    await userEvent.clear(qty);
    await userEvent.type(qty, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Buy INFY' }));

    expect(screen.getByRole('status').textContent).toBe('Bought 5 INFY @ ₹1,500.05');
    expect(tradeStore.get().positions.INFY.qty).toBe(5);
  });

  it('shows a clear error instead of placing an order the user can’t afford', async () => {
    render(<OrderTicket symbol="INFY" side="BUY" onSideChange={() => {}} />);
    const qty = screen.getByLabelText('Quantity');
    await userEvent.clear(qty);
    await userEvent.type(qty, '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Buy INFY' }));

    expect(screen.getByRole('alert').textContent).toMatch(/Insufficient funds/);
    expect(tradeStore.get().orders).toHaveLength(0);
  });

  it('strips non-digits from quantity', async () => {
    render(<OrderTicket symbol="INFY" side="BUY" onSideChange={() => {}} />);
    const qty = screen.getByLabelText('Quantity') as HTMLInputElement;
    await userEvent.clear(qty);
    await userEvent.type(qty, '1.5e');
    expect(qty.value).toBe('15');
  });
});
