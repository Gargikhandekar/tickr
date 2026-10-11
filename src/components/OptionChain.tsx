import { Fragment, useEffect, useMemo, useRef } from 'react';
import { UNDERLYING } from '../data/instruments';
import { atmStrike, buildChain, DEFAULT_CHAIN } from '../lib/optionChain';
import { formatPrice } from '../lib/money';
import { useQuote } from '../store/priceStore';

export function OptionChain() {
  const q = useQuote(UNDERLYING);
  const spot = q?.ltp;
  const rows = useMemo(() => (spot ? buildChain(spot) : []), [spot]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const atmRef = useRef<HTMLTableRowElement>(null);
  const hasRows = rows.length > 0;

  // Open centred on the at-the-money strike, which is where traders look first.
  useEffect(() => {
    const wrap = wrapRef.current;
    const row = atmRef.current;
    if (!wrap || !row) return;
    const rowTop = row.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop;
    wrap.scrollTop = rowTop - wrap.clientHeight / 2 + row.clientHeight / 2;
  }, [hasRows]);

  if (!spot) {
    return <div className="empty muted">Loading option chain…</div>;
  }

  const atm = atmStrike(spot, DEFAULT_CHAIN.step);
  const spotIndex = rows.findIndex((r) => r.strike > spot);

  return (
    <div className="table-wrap chain" ref={wrapRef}>
      <p className="muted small chain-note">
        {UNDERLYING} · weekly expiry in {DEFAULT_CHAIN.daysToExpiry} days · Black–Scholes theoretical prices with a
        volatility smile
      </p>
      <table>
        <thead>
          <tr>
            <th className="num">Call Δ</th>
            <th className="num">Call LTP</th>
            <th className="num strike-col">Strike · IV</th>
            <th className="num">Put LTP</th>
            <th className="num">Put Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Fragment key={r.strike}>
              {i === spotIndex && (
                <tr className="spot-row" aria-label="Spot price">
                  <td colSpan={5}>
                    <span className="num">Spot {formatPrice(spot)}</span>
                  </td>
                </tr>
              )}
              <tr className={r.strike === atm ? 'atm' : undefined} ref={r.strike === atm ? atmRef : undefined}>
                <td className={`num ${r.strike < spot ? 'itm' : ''}`}>{r.call.delta.toFixed(2)}</td>
                <td className={`num ${r.strike < spot ? 'itm' : ''}`}>{formatPrice(r.call.price)}</td>
                <td className="num strike-col">
                  <strong>{formatPrice(r.strike).replace(/\.00$/, '')}</strong>
                  <span className="muted small"> {(r.iv * 100).toFixed(1)}%</span>
                </td>
                <td className={`num ${r.strike > spot ? 'itm' : ''}`}>{formatPrice(r.put.price)}</td>
                <td className={`num ${r.strike > spot ? 'itm' : ''}`}>{r.put.delta.toFixed(2)}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
