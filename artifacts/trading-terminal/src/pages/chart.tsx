import React, { useState, useEffect, useRef } from "react";
import { useGetMarketHistory, useGetQuote } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, PriceChange } from "@/components/terminal-ui";
import { formatPrice } from "@/lib/utils";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
const PERIODS = ['1D', '5D', '1M', '3M', '6M', '1Y'] as const;

const CHART_COLORS = {
  background: "#0a0e1a",
  text: "#8892a4",
  grid: "#1a2035",
  border: "#1e2d45",
  crosshair: "#3b82f6",
  upColor: "#22c55e",
  downColor: "#ef4444",
  wickUp: "#22c55e",
  wickDown: "#ef4444",
  volumeUp: "rgba(34,197,94,0.4)",
  volumeDown: "rgba(239,68,68,0.4)",
};

function formatCandleTime(timestamp: string | number): number {
  const d = new Date(timestamp);
  return Math.floor(d.getTime() / 1000);
}

export default function ChartPage() {
  const { selectedSymbol } = useAppState();
  const [timeframe, setTimeframe] = useState<string>('1d');
  const [period, setPeriod] = useState<string>('3M');

  const { data: quote } = useGetQuote(selectedSymbol, { query: { refetchInterval: 10000 } });
  const { data: history, isLoading, error } = useGetMarketHistory(selectedSymbol, { timeframe, period });

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: "#1e3a5f" },
        horzLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: "#1e3a5f" },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
      watermark: { visible: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderUpColor: CHART_COLORS.upColor,
      borderDownColor: CHART_COLORS.downColor,
      wickUpColor: CHART_COLORS.wickUp,
      wickDownColor: CHART_COLORS.wickDown,
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!history || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const seen = new Set<number>();
    const candleData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];

    const sorted = [...history].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    for (const bar of sorted) {
      const t = formatCandleTime(bar.time);
      if (seen.has(t)) continue;
      seen.add(t);

      const open = bar.open ?? bar.close;
      const high = bar.high ?? bar.close;
      const low = bar.low ?? bar.close;
      const close = bar.close;

      if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) continue;

      candleData.push({ time: t as any, open, high, low, close });
      volumeData.push({
        time: t as any,
        value: bar.volume ?? 0,
        color: close >= open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      });
    }

    if (candleData.length === 0) return;

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [history]);

  return (
    <PageTransition>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 font-mono">
            {selectedSymbol}
            {quote && <span className="font-mono text-xl">{formatPrice(quote.price)}</span>}
            {quote && <PriceChange value={quote.changePercent} className="text-lg" />}
          </h1>
          <p className="text-sm text-muted-foreground">{quote?.name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${
                  timeframe === tf
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${
                  period === p
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TerminalCard className="flex-1 min-h-[600px] p-0 relative overflow-hidden">
        {error && <div className="absolute inset-0 p-6 z-10"><ErrorPanel error={error} /></div>}
        {isLoading && !error && <TerminalSkeleton className="absolute inset-0 z-10" />}
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
      </TerminalCard>

      <div className="flex gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className="w-3 h-3 rounded-sm bg-bullish inline-block" />
          Bullish candle
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className="w-3 h-3 rounded-sm bg-bearish inline-block" />
          Bearish candle
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className="w-8 h-px bg-muted-foreground inline-block" />
          Volume histogram
        </div>
        <span className="ml-auto text-xs text-muted-foreground">TradingView Lightweight Charts • Paper Trading Only</span>
      </div>
    </PageTransition>
  );
}
