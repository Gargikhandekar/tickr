import { useSyncExternalStore } from 'react';
import { priceStore, type PriceStore } from '../store/priceStore';
import { MarketSimulator } from './simulator';
import { HEARTBEAT_MS, parseServerMessage, STALE_AFTER_MS, TICK_INTERVAL_MS, type ServerMessage } from './protocol';

export type FeedStatus = 'connecting' | 'live' | 'stale' | 'reconnecting';

interface TransportHandlers {
  onOpen(): void;
  onMessage(m: ServerMessage): void;
  onClose(): void;
}

export interface Transport {
  readonly kind: 'websocket' | 'simulated';
  open(h: TransportHandlers): void;
  /** Intentional shutdown: no reconnect. */
  close(): void;
  /** Simulate an unexpected network drop (for demoing reconnect). */
  drop(): void;
}

export class WebSocketTransport implements Transport {
  readonly kind = 'websocket' as const;
  private ws?: WebSocket;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  open(h: TransportHandlers): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => h.onOpen();
    ws.onmessage = (e) => {
      const m = parseServerMessage(String(e.data));
      if (m) h.onMessage(m);
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => h.onClose();
  }

  close(): void {
    if (!this.ws) return;
    this.ws.onclose = null;
    this.ws.close();
    this.ws = undefined;
  }

  drop(): void {
    this.ws?.close();
  }
}

/** Same protocol as the server, generated in the browser. Used when no VITE_FEED_URL is set. */
export class SimulatedTransport implements Transport {
  readonly kind = 'simulated' as const;
  private sim = new MarketSimulator();
  private timers: ReturnType<typeof setInterval>[] = [];
  private handlers?: TransportHandlers;

  open(h: TransportHandlers): void {
    this.handlers = h;
    this.timers.push(
      setTimeout(() => {
        h.onOpen();
        h.onMessage({ type: 'snapshot', quotes: this.sim.snapshot() });
        this.timers.push(
          setInterval(() => {
            const quotes = this.sim.step(TICK_INTERVAL_MS / 1000);
            if (quotes.length) h.onMessage({ type: 'ticks', quotes });
          }, TICK_INTERVAL_MS),
          setInterval(() => h.onMessage({ type: 'heartbeat', ts: Date.now() }), HEARTBEAT_MS),
        );
      }, 400),
    );
  }

  close(): void {
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.handlers = undefined;
  }

  drop(): void {
    const h = this.handlers;
    this.close();
    h?.onClose();
  }
}

/** Exponential backoff with jitter, so thousands of clients don't reconnect in lockstep. */
export function backoffDelay(attempt: number, rand: () => number = Math.random): number {
  const base = Math.min(15_000, 500 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.5 + rand() * 0.5));
}

export class MarketFeed {
  status: FeedStatus = 'connecting';
  attempt = 0;
  private lastMessageAt = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private staleTimer?: ReturnType<typeof setInterval>;
  private statusListeners = new Set<() => void>();
  private running = false;
  private transport: Transport;
  private store: PriceStore;

  constructor(transport: Transport, store: PriceStore = priceStore) {
    this.transport = transport;
    this.store = store;
  }

  get kind(): Transport['kind'] {
    return this.transport.kind;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
    this.staleTimer = setInterval(() => {
      if (this.status === 'live' && Date.now() - this.lastMessageAt > STALE_AFTER_MS) this.setStatus('stale');
    }, 500);
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.retryTimer);
    clearInterval(this.staleTimer);
    this.transport.close();
  }

  simulateDrop(): void {
    this.transport.drop();
  }

  onStatus = (l: () => void): (() => void) => {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  };

  private setStatus(s: FeedStatus): void {
    if (s === this.status) return;
    this.status = s;
    this.statusListeners.forEach((l) => l());
  }

  private connect(): void {
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');
    this.transport.open({
      onOpen: () => {
        this.attempt = 0;
        this.lastMessageAt = Date.now();
        this.setStatus('live');
      },
      onMessage: (m) => {
        this.lastMessageAt = Date.now();
        if (this.status === 'stale') this.setStatus('live');
        if (m.type !== 'heartbeat') this.store.ingest(m.quotes);
      },
      onClose: () => {
        if (!this.running) return;
        this.attempt++;
        this.setStatus('reconnecting');
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.connect(), backoffDelay(this.attempt));
      },
    });
  }
}

const feedUrl = import.meta.env.VITE_FEED_URL as string | undefined;
export const feed = new MarketFeed(feedUrl ? new WebSocketTransport(feedUrl) : new SimulatedTransport());

export function useFeedStatus(): FeedStatus {
  return useSyncExternalStore(feed.onStatus, () => feed.status);
}
