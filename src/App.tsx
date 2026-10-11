import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OptionChain } from './components/OptionChain';
import { OrderTicket } from './components/OrderTicket';
import { Orders } from './components/Orders';
import { Positions, useTotalPnl } from './components/Positions';
import { PriceChart } from './components/PriceChart';
import { StatusBar } from './components/StatusBar';
import { Watchlist } from './components/Watchlist';
import { feed } from './feed/client';
import { formatINR } from './lib/money';
import { tradeStore, useAccount } from './store/tradeStore';
import { availableCash, type Side } from './trading/engine';

type Tab = 'positions' | 'orders' | 'chain';

function AccountSummary() {
  const account = useAccount();
  const { unrealized, realized } = useTotalPnl();
  const total = unrealized + realized;
  return (
    <div className="account">
      <div>
        <span className="muted small">Available</span>
        <span className="num">{formatINR(availableCash(account))}</span>
      </div>
      <div>
        <span className="muted small">Total P&amp;L</span>
        <span className={`num ${total > 0 ? 'up' : total < 0 ? 'down' : ''}`}>{formatINR(total)}</span>
      </div>
      <button
        className="link-btn"
        onClick={() => {
          if (confirm('Reset paper account to ₹10,00,000 and clear all orders?')) tradeStore.reset();
        }}
      >
        Reset
      </button>
    </div>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [side, setSide] = useState<Side>('BUY');
  const [tab, setTab] = useState<Tab>('positions');
  const { orders } = useAccount();
  const openCount = orders.filter((o) => o.status === 'OPEN').length;

  useEffect(() => {
    feed.start();
    return () => feed.stop();
  }, []);

  const focusQty = () => requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-ticket-qty]')?.select());

  const onTrade = useCallback((s: string, nextSide: Side) => {
    setSymbol(s);
    setSide(nextSide);
    focusQty();
  }, []);

  // Keyboard shortcuts, like a real terminal: B = buy, S = sell (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'b' || k === 's') {
        e.preventDefault();
        setSide(k === 'b' ? 'BUY' : 'SELL');
        focusQty();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">◢</span> Tickr
          <span className="muted small">paper trading terminal</span>
        </div>
        <AccountSummary />
      </header>

      <main className="layout">
        <ErrorBoundary label="Watchlist">
          <Watchlist selected={symbol} onSelect={setSymbol} onTrade={onTrade} />
        </ErrorBoundary>

        <div className="center">
          <ErrorBoundary label="Chart">
            <PriceChart symbol={symbol} />
          </ErrorBoundary>

          <section className="panel bottom">
            <nav className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'positions'} onClick={() => setTab('positions')}>
                Positions
              </button>
              <button role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')}>
                Orders{openCount > 0 && <span className="count">{openCount}</span>}
              </button>
              <button role="tab" aria-selected={tab === 'chain'} onClick={() => setTab('chain')}>
                Option chain
              </button>
            </nav>
            <ErrorBoundary label="Panel">
              <div role="tabpanel" className="tab-body">
                {tab === 'positions' && <Positions />}
                {tab === 'orders' && <Orders />}
                {tab === 'chain' && <OptionChain />}
              </div>
            </ErrorBoundary>
          </section>
        </div>

        <ErrorBoundary label="Order ticket">
          <OrderTicket symbol={symbol} side={side} onSideChange={setSide} />
        </ErrorBoundary>
      </main>

      <StatusBar />
    </div>
  );
}
