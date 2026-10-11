import { formatPrice } from '../lib/money';
import { tradeStore, useAccount } from '../store/tradeStore';

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' });

export function Orders() {
  const { orders } = useAccount();

  if (orders.length === 0) {
    return (
      <div className="empty">
        <p>No orders today</p>
        <p className="muted small">Market orders fill instantly; limit orders wait here until the price crosses.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Symbol</th>
            <th>Side</th>
            <th>Type</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="num muted">{time(o.createdAt)}</td>
              <td className="sym">{o.symbol}</td>
              <td className={o.side === 'BUY' ? 'up' : 'down'}>{o.side}</td>
              <td>{o.type}</td>
              <td className="num">{o.qty}</td>
              <td className="num">
                {o.fillPrice != null ? formatPrice(o.fillPrice) : o.limitPrice != null ? formatPrice(o.limitPrice) : '—'}
              </td>
              <td>
                <span className={`badge ${o.status.toLowerCase()}`} title={o.reason}>
                  {o.status}
                </span>
                {o.reason && <span className="muted small reason">{o.reason}</span>}
              </td>
              <td className="actions">
                {o.status === 'OPEN' && (
                  <button className="link-btn" onClick={() => tradeStore.cancel(o.id)}>
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
