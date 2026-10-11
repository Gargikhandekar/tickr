import { memo, useEffect, useRef } from 'react';
import { INSTRUMENTS, type Instrument } from '../data/instruments';
import { formatPct, formatPrice, formatSigned, pctChange } from '../lib/money';
import { useQuote } from '../store/priceStore';
import type { Side } from '../trading/engine';

interface RowProps {
  inst: Instrument;
  selected: boolean;
  onSelect: (symbol: string) => void;
  onTrade: (symbol: string, side: Side) => void;
}

/** Flashes the price green/red on change by toggling a class directly — no extra React render. */
function useFlash(value: number | undefined) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    const before = prev.current;
    prev.current = value;
    if (!el || value === undefined || before === undefined || before === value) return;
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(value > before ? 'flash-up' : 'flash-down');
  }, [value]);
  return ref;
}

const WatchRow = memo(function WatchRow({ inst, selected, onSelect, onTrade }: RowProps) {
  const q = useQuote(inst.symbol);
  const flashRef = useFlash(q?.ltp);

  if (!q) {
    return (
      <li className="watch-row" aria-busy="true">
        <div className="watch-main">
          <span className="skeleton" style={{ width: 84 }} />
          <span className="skeleton" style={{ width: 64 }} />
        </div>
      </li>
    );
  }

  const change = q.ltp - q.prevClose;
  const dir = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  return (
    <li className={`watch-row${selected ? ' is-selected' : ''}`}>
      <button className="watch-main" onClick={() => onSelect(inst.symbol)} aria-pressed={selected}>
        <span className="watch-name">
          <span className="sym">{inst.symbol}</span>
          <span className="muted small">{inst.isIndex ? 'INDEX' : 'NSE'}</span>
        </span>
        <span className="watch-price">
          <span ref={flashRef} className="num ltp">
            {formatPrice(q.ltp)}
          </span>
          <span className={`num small ${dir}`}>
            {formatSigned(change)} ({formatPct(pctChange(q.ltp, q.prevClose))})
          </span>
        </span>
      </button>
      {!inst.isIndex && (
        <div className="watch-actions">
          <button className="chip buy" onClick={() => onTrade(inst.symbol, 'BUY')} aria-label={`Buy ${inst.symbol}`}>
            B
          </button>
          <button className="chip sell" onClick={() => onTrade(inst.symbol, 'SELL')} aria-label={`Sell ${inst.symbol}`}>
            S
          </button>
        </div>
      )}
    </li>
  );
});

export function Watchlist(props: Omit<RowProps, 'inst' | 'selected'> & { selected: string }) {
  return (
    <section className="panel watchlist" aria-label="Watchlist">
      <header className="panel-head">
        <h2>Watchlist</h2>
        <span className="muted small">{INSTRUMENTS.length} symbols</span>
      </header>
      <ul>
        {INSTRUMENTS.map((inst) => (
          <WatchRow
            key={inst.symbol}
            inst={inst}
            selected={inst.symbol === props.selected}
            onSelect={props.onSelect}
            onTrade={props.onTrade}
          />
        ))}
      </ul>
    </section>
  );
}
