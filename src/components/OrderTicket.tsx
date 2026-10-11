import { useEffect, useId, useState, type FormEvent } from 'react';
import { getInstrument } from '../data/instruments';
import { formatINR, formatPrice, parseRupees, toInputValue } from '../lib/money';
import { useQuote } from '../store/priceStore';
import { tradeStore, useAccount } from '../store/tradeStore';
import { availableCash, sellableQty, validateOrder, type OrderRequest, type OrderType, type Side } from '../trading/engine';

interface Props {
  symbol: string;
  side: Side;
  onSideChange: (side: Side) => void;
}

type Feedback = { kind: 'ok' | 'err'; text: string } | null;

export function OrderTicket({ symbol, side, onSideChange }: Props) {
  const inst = getInstrument(symbol);
  const q = useQuote(symbol);
  const account = useAccount();
  const ids = useId();

  const [type, setType] = useState<OrderType>('MARKET');
  const [qtyText, setQtyText] = useState('1');
  const [priceText, setPriceText] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // New symbol → clear the limit price and validation state.
  useEffect(() => {
    setPriceText('');
    setAttempted(false);
    setFeedback(null);
  }, [symbol]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  if (inst?.isIndex) {
    return (
      <section className="panel ticket" aria-label="Order ticket">
        <header className="panel-head"><h2>Order</h2></header>
        <div className="empty">
          <p>{symbol} is an index and can’t be bought or sold directly.</p>
          <p className="muted small">Pick a stock from the watchlist, or explore the option chain below.</p>
        </div>
      </section>
    );
  }

  const qty = /^\d+$/.test(qtyText) ? Number(qtyText) : NaN;
  const parsedPrice = type === 'LIMIT' ? parseRupees(priceText) : null;
  const req: OrderRequest = { symbol, side, type, qty, limitPrice: parsedPrice ?? undefined };

  const error =
    type === 'LIMIT' && priceText.trim() !== '' && parsedPrice === null
      ? 'Enter a valid price, e.g. 1412.50'
      : validateOrder(account, req, q);

  const estPrice = type === 'LIMIT' ? parsedPrice : side === 'BUY' ? q?.ask : q?.bid;
  const estValue = estPrice && Number.isFinite(qty) ? estPrice * qty : 0;

  function switchType(next: OrderType) {
    setType(next);
    if (next === 'LIMIT' && priceText === '' && q) setPriceText(toInputValue(q.ltp));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (error) return;
    const order = tradeStore.place(req);
    setAttempted(false);
    if (order.status === 'REJECTED') setFeedback({ kind: 'err', text: order.reason ?? 'Order rejected' });
    else if (order.status === 'FILLED')
      setFeedback({ kind: 'ok', text: `${side === 'BUY' ? 'Bought' : 'Sold'} ${qty} ${symbol} @ ₹${formatPrice(order.fillPrice!)}` });
    else setFeedback({ kind: 'ok', text: `Limit ${side.toLowerCase()} placed @ ₹${formatPrice(order.limitPrice!)}` });
  }

  const showError = attempted && error;

  return (
    <section className={`panel ticket side-${side.toLowerCase()}`} aria-label="Order ticket">
      <header className="panel-head">
        <h2>{symbol}</h2>
        <span className="muted small num">
          {q ? `Bid ${formatPrice(q.bid)} · Ask ${formatPrice(q.ask)}` : 'Waiting for price…'}
        </span>
      </header>

      <form onSubmit={submit} noValidate>
        <div className="segmented" role="radiogroup" aria-label="Side">
          {(['BUY', 'SELL'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              className={`seg ${s.toLowerCase()}${side === s ? ' active' : ''}`}
              onClick={() => onSideChange(s)}
            >
              {s === 'BUY' ? 'Buy' : 'Sell'}
            </button>
          ))}
        </div>

        <div className="segmented subtle" role="radiogroup" aria-label="Order type">
          {(['MARKET', 'LIMIT'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              className={`seg${type === t ? ' active' : ''}`}
              onClick={() => switchType(t)}
            >
              {t === 'MARKET' ? 'Market' : 'Limit'}
            </button>
          ))}
        </div>

        <label className="field" htmlFor={`${ids}-qty`}>
          <span>Quantity</span>
          <input
            id={`${ids}-qty`}
            data-ticket-qty
            inputMode="numeric"
            autoComplete="off"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value.replace(/[^\d]/g, ''))}
          />
        </label>

        <label className="field" htmlFor={`${ids}-price`}>
          <span>Price (₹)</span>
          {type === 'LIMIT' ? (
            <input
              id={`${ids}-price`}
              inputMode="decimal"
              autoComplete="off"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
            />
          ) : (
            <input id={`${ids}-price`} disabled value={q ? `Market (~${formatPrice(estPrice ?? 0)})` : 'Market'} />
          )}
        </label>

        <dl className="ticket-summary">
          <div><dt>Est. value</dt><dd className="num">{formatINR(estValue)}</dd></div>
          {side === 'BUY' ? (
            <div><dt>Available</dt><dd className="num">{formatINR(availableCash(account))}</dd></div>
          ) : (
            <div><dt>Sellable</dt><dd className="num">{Math.max(0, sellableQty(account, symbol))}</dd></div>
          )}
        </dl>

        {showError && <p className="form-error" role="alert">{error}</p>}
        {feedback && (
          <p className={feedback.kind === 'ok' ? 'form-ok' : 'form-error'} role="status">
            {feedback.text}
          </p>
        )}

        <button type="submit" className={`submit ${side.toLowerCase()}`} disabled={!q}>
          {side === 'BUY' ? 'Buy' : 'Sell'} {symbol}
        </button>
        <p className="muted small hint">Shortcuts: <kbd>B</kbd> buy · <kbd>S</kbd> sell</p>
      </form>
    </section>
  );
}
