import { useEffect, useState } from 'react';
import { feed, useFeedStatus, type FeedStatus } from '../feed/client';
import { priceStore } from '../store/priceStore';

const LABEL: Record<FeedStatus, string> = {
  connecting: 'Connecting',
  live: 'Live',
  stale: 'Stale — no data',
  reconnecting: 'Reconnecting',
};

/** Ticks received vs. frames actually rendered — shows the coalescing at work. */
function useThroughput() {
  const [rate, setRate] = useState({ ticks: 0, flushes: 0 });
  useEffect(() => {
    let last = { ...priceStore.stats };
    const id = setInterval(() => {
      const now = { ...priceStore.stats };
      setRate({ ticks: now.ticks - last.ticks, flushes: now.flushes - last.flushes });
      last = now;
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return rate;
}

export function StatusBar() {
  const status = useFeedStatus();
  const { ticks, flushes } = useThroughput();

  return (
    <footer className="statusbar">
      <span className={`dot ${status}`} aria-hidden="true" />
      <span role="status" aria-live="polite">
        {LABEL[status]}
        {status === 'reconnecting' && feed.attempt > 0 ? ` (attempt ${feed.attempt})` : ''}
      </span>
      <span className="muted">· {feed.kind === 'websocket' ? 'WebSocket feed' : 'In-browser simulated feed'}</span>
      <span className="muted num">· {ticks} ticks/s → {flushes} renders/s</span>
      <span className="spacer" />
      <button className="link-btn" onClick={() => feed.simulateDrop()} disabled={status !== 'live'}>
        Simulate disconnect
      </button>
      <span className="muted">Simulated prices · not investment advice</span>
    </footer>
  );
}
