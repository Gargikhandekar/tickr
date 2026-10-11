import { useEffect, useRef } from 'react';
import {
  createChart,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { getInstrument } from '../data/instruments';
import type { Candle } from '../lib/candles';
import { formatPct, formatPrice, formatSigned, pctChange } from '../lib/money';
import { CANDLE_SEC, getCandles, subscribeCandles } from '../store/candleStore';
import { useQuote } from '../store/priceStore';

const toBar = (c: Candle): CandlestickData<UTCTimestamp> => ({
  time: c.time as UTCTimestamp,
  open: c.open / 100,
  high: c.high / 100,
  low: c.low / 100,
  close: c.close / 100,
});

const istTime = (t: Time, withSeconds: boolean) =>
  new Date((t as number) * 1000).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });

function ChartHeader({ symbol }: { symbol: string }) {
  const q = useQuote(symbol);
  const inst = getInstrument(symbol);
  if (!q) return <div className="chart-head"><span className="skeleton" style={{ width: 220 }} /></div>;
  const change = q.ltp - q.prevClose;
  const dir = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return (
    <div className="chart-head">
      <div>
        <h2 className="chart-sym">{symbol}</h2>
        <span className="muted small">{inst?.name} · {CANDLE_SEC}s candles</span>
      </div>
      <div className="chart-ltp">
        <span className="num big">{formatPrice(q.ltp)}</span>
        <span className={`num ${dir}`}>
          {formatSigned(change)} ({formatPct(pctChange(q.ltp, q.prevClose))})
        </span>
      </div>
      <dl className="ohlc">
        <div><dt>O</dt><dd className="num">{formatPrice(q.open)}</dd></div>
        <div><dt>H</dt><dd className="num">{formatPrice(q.high)}</dd></div>
        <div><dt>L</dt><dd className="num">{formatPrice(q.low)}</dd></div>
        <div><dt>PC</dt><dd className="num">{formatPrice(q.prevClose)}</dd></div>
      </dl>
    </div>
  );
}

export function PriceChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const hasData = useQuote(symbol) !== undefined;

  // Create the chart once. Live updates go straight to the chart's imperative API,
  // never through React state.
  useEffect(() => {
    const chart = createChart(containerRef.current!, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: '#8b97a7', fontFamily: 'Inter, sans-serif' },
      grid: { vertLines: { color: '#1a222d' }, horzLines: { color: '#1a222d' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#232d3a' },
      timeScale: {
        borderColor: '#232d3a',
        timeVisible: true,
        secondsVisible: true,
        tickMarkFormatter: (t: Time) => istTime(t, false),
      },
      localization: { timeFormatter: (t: Time) => istTime(t, true) },
    });
    seriesRef.current = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !hasData) return;
    series.setData(getCandles(symbol).map(toBar));
    chartRef.current?.timeScale().scrollToRealTime();
    return subscribeCandles(symbol, (c) => series.update(toBar(c)));
  }, [symbol, hasData]);

  return (
    <section className="panel chart-panel" aria-label={`${symbol} price chart`}>
      <ChartHeader symbol={symbol} />
      <div className="chart-box">
        <div ref={containerRef} className="chart-canvas" />
        {!hasData && <div className="overlay muted">Loading market data…</div>}
      </div>
    </section>
  );
}
