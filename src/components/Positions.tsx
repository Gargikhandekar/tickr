import { memo } from 'react';
import { formatINR, formatPrice, formatSigned } from '../lib/money';
import { priceStore, usePriceVersion, useQuote } from '../store/priceStore';
import { tradeStore, useAccount } from '../store/tradeStore';
import { avgPrice, unrealizedPnl, type Position } from '../trading/engine';

const tone = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');

const PositionRow = memo(function PositionRow({ p }: { p: Position }) {
  const q = useQuote(p.symbol);
  const unreal = q && p.qty !== 0 ? unrealizedPnl(p, q.ltp) : 0;
  return (
    <tr>
      <td className="sym">{p.symbol}</td>
      <td className="num">{p.qty}</td>
      <td className="num">{p.qty ? formatPrice(avgPrice(p)) : '—'}</td>
      <td className="num">{q ? formatPrice(q.ltp) : '—'}</td>
      <td className={`num ${tone(unreal)}`}>{p.qty ? formatSigned(unreal) : '—'}</td>
      <td className={`num ${tone(p.realized)}`}>{formatSigned(p.realized)}</td>
      <td className="actions">
        {p.qty > 0 && (
          <button
            className="link-btn"
            onClick={() => tradeStore.place({ symbol: p.symbol, side: 'SELL', type: 'MARKET', qty: p.qty })}
          >
            Exit
          </button>
        )}
      </td>
    </tr>
  );
});

/** Total P&L across positions; re-renders at most once per frame. */
export function useTotalPnl(): { unrealized: number; realized: number } {
  const { positions } = useAccount();
  usePriceVersion();
  let unrealized = 0;
  let realized = 0;
  for (const p of Object.values(positions)) {
    realized += p.realized;
    const q = priceStore.get(p.symbol);
    if (q && p.qty) unrealized += unrealizedPnl(p, q.ltp);
  }
  return { unrealized, realized };
}

export function Positions() {
  const { positions } = useAccount();
  const list = Object.values(positions).filter((p) => p.qty !== 0 || p.realized !== 0);
  const { unrealized, realized } = useTotalPnl();

  if (list.length === 0) {
    return (
      <div className="empty">
        <p>No positions yet</p>
        <p className="muted small">Place an order from the ticket and it’ll show up here with live P&amp;L.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th className="num">Qty</th>
            <th className="num">Avg</th>
            <th className="num">LTP</th>
            <th className="num">Unrealised</th>
            <th className="num">Realised</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <PositionRow key={p.symbol} p={p} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Total</td>
            <td className={`num ${tone(unrealized)}`}>{formatSigned(unrealized)}</td>
            <td className={`num ${tone(realized)}`}>{formatSigned(realized)}</td>
            <td className={`num ${tone(unrealized + realized)}`}>{formatINR(unrealized + realized)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
