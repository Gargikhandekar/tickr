/**
 * Local market-data server. Streams simulated NSE-style ticks over WebSocket using the same
 * protocol the browser's offline simulator speaks.
 *
 *   npm run server     → ws://localhost:8787
 *   npm run dev:ws     → frontend connected to it
 */
import { WebSocketServer, WebSocket } from 'ws';
import { MarketSimulator } from '../src/feed/simulator';
import { HEARTBEAT_MS, TICK_INTERVAL_MS, type ServerMessage } from '../src/feed/protocol';

const PORT = Number(process.env.PORT ?? 8787);
/** Skip sending to a client whose socket buffer is backed up instead of letting memory grow. */
const MAX_BUFFERED_BYTES = 1_000_000;

const sim = new MarketSimulator();
const wss = new WebSocketServer({ port: PORT });

function broadcast(message: ServerMessage): void {
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < MAX_BUFFERED_BYTES) client.send(data);
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'snapshot', quotes: sim.snapshot() } satisfies ServerMessage));
  console.log(`client connected (${wss.clients.size} total)`);
  ws.on('close', () => console.log(`client disconnected (${wss.clients.size} total)`));
});

setInterval(() => {
  const quotes = sim.step(TICK_INTERVAL_MS / 1000);
  if (quotes.length) broadcast({ type: 'ticks', quotes });
}, TICK_INTERVAL_MS);

setInterval(() => broadcast({ type: 'heartbeat', ts: Date.now() }), HEARTBEAT_MS);

console.log(`Tickr market feed streaming on ws://localhost:${PORT}`);
